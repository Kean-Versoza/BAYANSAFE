import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';

import { getClient, query, describeError } from '../db/pool.js';
import {
  deleteUser,
  findByEmail,
  findById,
  findByRfid,
  findByUsername,
  noteSignIn,
  setPin,
  updatePassword,
  updateUser,
  verifyPassword,
  verifyPin,
} from '../services/users.js';
import {
  clearUserCookie,
  createSession,
  destroySession,
  destroySessionsOf,
  getSessionUser,
  removeOldSessions,
  setUserCookie,
} from '../services/userAuth.js';
import { normalizeCardNumber } from '../../../shared/rfid.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A few tries, then a wait. This stops somebody guessing the password.
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

function tooManyTries(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.start > LOCK_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function noteFailedTry(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.start > LOCK_MS) {
    attempts.set(key, { count: 1, start: Date.now() });
    return;
  }
  entry.count += 1;
}

/**
 * The player number of an account. It never changes, so it can be written
 * on a paper and still mean the same thing tomorrow.
 */
function playerNumber(id) {
  return `BS-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/** The account as the player may see it. The password never leaves the server. */
function publicUser(user) {
  return {
    id: user.id,
    playerNumber: user.player_number ?? null,
    number: playerNumber(user.id),
    username: user.username,
    email: user.email,
    card: user.rfid_uid ?? null,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at ?? null,
  };
}

/** Everything under /api/account needs a signed in player. */
async function requireUser(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Please sign in first.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Could not read the session:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
}

/* ------------------------------------------------------------------
   Signing in
   ------------------------------------------------------------------ */

/**
 * GET /api/account/session
 * Tells the front end whether somebody is signed in.
 */
router.get('/session', async (req, res) => {
  try {
    const user = await getSessionUser(req);
    res.json({ signedIn: Boolean(user), user: user ? publicUser(user) : null });
  } catch (err) {
    console.error('Could not read the session:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * POST /api/account/login
 * Signs a player in with their email and their password.
 */
router.post('/login', async (req, res) => {
  const identifier = typeof req.body?.username === 'string'
    ? req.body.username.trim()
    : (typeof req.body?.email === 'string' ? req.body.email.trim() : '');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!identifier || !password) {
    return res.status(400).json({ ok: false, error: 'Please fill in your username and your password.' });
  }

  const key = req.ip ?? 'unknown';
  if (tooManyTries(key)) {
    return res.status(429).json({ ok: false, error: 'Too many tries. Please wait a few minutes.' });
  }

  try {
    const user = identifier.includes('@')
      ? await findByEmail(identifier)
      : await findByUsername(identifier);
    if (!user || !verifyPassword(password, user.password)) {
      noteFailedTry(key);
      return res.status(401).json({ ok: false, error: 'That username and password do not go together.' });
    }

    attempts.delete(key);
    await removeOldSessions();

    const { token } = await createSession(user.id);
    setUserCookie(res, token);
    await noteSignIn(user.id);

    const fresh = await findById(user.id);
    res.json({ ok: true, message: `Welcome back, ${user.username}!`, user: publicUser(fresh ?? user) });
  } catch (err) {
    console.error('Could not sign in:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * POST /api/account/logout
 */
router.post('/logout', async (req, res) => {
  try {
    await destroySession(req);
  } catch (err) {
    console.error('Could not end the session:', describeError(err));
  }
  clearUserCookie(res);
  res.json({ ok: true });
});

/**
 * POST /api/account/pin
 * Sets a PIN on the signed-in account for RFID quick sign-in security.
 * Requires the user to be signed in.
 */
router.post('/pin', requireUser, async (req, res) => {
  const { pin } = req.body ?? {};

  if (!pin || !/^\d{4,6}$/.test(String(pin))) {
    return res.status(400).json({ ok: false, error: 'PIN must be 4 to 6 digits.' });
  }

  try {
    await setPin(req.user.id, pin);
    res.json({ ok: true, message: 'PIN set successfully.' });
  } catch (err) {
    console.error('Could not set PIN:', describeError(err));
    res.status(503).json({ ok: false, error: 'Could not set PIN.' });
  }
});

/* ------------------------------------------------------------------
   The account
   ------------------------------------------------------------------ */

/**
 * GET /api/account
 * The account of the player that is signed in.
 */
router.get('/', requireUser, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user) });
});

/**
 * PATCH /api/account
 * Changes the name and the email of the account.
 */
router.patch('/', requireUser, async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({
      ok: false,
      error: 'Please use a name of 3 to 32 characters.',
    });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }

  try {
    // The name and the email of somebody else may not be taken
    const sameName = await findByUsername(username);
    if (sameName && sameName.id !== req.user.id) {
      return res.status(409).json({ ok: false, error: 'That name is already taken.' });
    }
    const sameEmail = await findByEmail(email);
    if (sameEmail && sameEmail.id !== req.user.id) {
      return res.status(409).json({ ok: false, error: 'That email is already registered.' });
    }

    const { user, error, status } = await updateUser({ id: req.user.id, username, email });
    if (error) {
      return res.status(status ?? 400).json({ ok: false, error });
    }

    res.json({ ok: true, message: 'Your account was changed.', user: publicUser(user) });
  } catch (err) {
    console.error('Could not change the account:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * POST /api/account/password
 * Sets a new password. The old one is asked for, so nobody can change the
 * password of somebody else who is not there.
 */
router.post('/password', requireUser, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (next.length < 8) {
    return res.status(400).json({ ok: false, error: 'Please use a password of at least 8 characters.' });
  }
  if (next.length > 200) {
    return res.status(400).json({ ok: false, error: 'That password is too long.' });
  }

  try {
    const account = await findById(req.user.id);
    if (!account || !verifyPassword(current, account.password)) {
      return res.status(401).json({ ok: false, error: 'That is not your current password.' });
    }

    await updatePassword(req.user.id, next);

    // Every other sign in of this player is ended, only this one stays.
    await destroySessionsOf(req.user.id);
    const { token } = await createSession(req.user.id);
    setUserCookie(res, token);

    res.json({ ok: true, message: 'Your password was changed.' });
  } catch (err) {
    console.error('Could not change the password:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * POST /api/account/card
 * Links a card to the account, or takes the card away again.
 */
router.post('/card', requireUser, async (req, res) => {
  const typed = typeof req.body?.card === 'string' ? req.body.card.trim() : '';
  const card = typed ? normalizeCardNumber(typed) : '';

  if (typed && !card) {
    return res.status(400).json({
      ok: false,
      error: 'That card number does not look right. Scan the card again or type the full number.',
    });
  }

  try {
    if (card) {
      const used = await findByRfid(card);
      if (used && used.id !== req.user.id) {
        return res.status(409).json({ ok: false, error: 'That card is already linked to another account.' });
      }
    }

    const { rows } = await query(
      'UPDATE users SET rfid_uid = $2 WHERE id = $1 RETURNING id, username, email, rfid_uid, created_at, last_login_at',
      [req.user.id, card || null],
    );

    res.json({
      ok: true,
      message: card ? `Card ${card} is now linked to your account.` : 'The card was taken away.',
      user: publicUser(rows[0]),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'That card is already linked to another account.' });
    }
    console.error('Could not change the card:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/* ------------------------------------------------------------------
   RFID card enrollment (ESP32 quick sign-in)
   ------------------------------------------------------------------ */

/** Bridge token shared with the ESP32. Set RFID_BRIDGE_TOKEN in server/.env. */
const BRIDGE_TOKEN = process.env.RFID_BRIDGE_TOKEN || '';

function checkBridgeToken(req, res) {
  if (!BRIDGE_TOKEN) return true;
  const given = req.get('x-bridge-token') || '';
  if (given !== BRIDGE_TOKEN) {
    res.status(401).json({ ok: false, error: 'Bad bridge token.' });
    return false;
  }
  return true;
}

/**
 * POST /api/account/rfid/enroll/start
 * Creates an enrollment session for the signed-in player.
 */
router.post('/rfid/enroll/start', requireUser, async (req, res) => {
  const sessionId = randomUUID();

  try {
    // Cancel any still-active sessions for this user so only one is live.
    await query(
      `UPDATE rfid_enrollment_sessions
        SET status = 'cancelled', expires_at = NOW()
      WHERE user_id = $1 AND status = 'active'`,
      [req.user.id],
    );

    const { rows } = await query(
      `INSERT INTO rfid_enrollment_sessions (id, user_id, status, expires_at)
         VALUES ($1, $2, 'active', NOW() + INTERVAL '10 minutes')
         RETURNING id, status, expires_at`,
      [sessionId, req.user.id],
    );

    res.json({
      ok: true,
      session: {
        id: rows[0].id,
        status: rows[0].status,
        expiresAt: rows[0].expires_at,
      },
    });
  } catch (err) {
    console.error('Could not start enrollment:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * POST /api/account/rfid/enroll/scan
 * The ESP32 posts a scanned UID against an active enrollment session.
 * Protected by the bridge token (device credential, never sent to the browser).
 */
router.post('/rfid/enroll/scan', (req, res) => {
  if (!checkBridgeToken(req, res)) return;

  const { sessionId, uid } = req.body ?? {};
  const card = typeof uid === 'string' ? normalizeCardNumber(uid) : '';
  if (!sessionId || !card) {
    return res.status(400).json({ ok: false, error: 'Missing session or card UID.' });
  }

  (async () => {
    try {
      const { rows } = await query(
        `SELECT id, user_id, card_uid, status, expires_at
           FROM rfid_enrollment_sessions
          WHERE id = $1`,
        [sessionId],
      );
      const session = rows[0];
      if (!session) {
        return res.status(404).json({ ok: false, error: 'Enrollment session not found.' });
      }
      if (session.status !== 'active') {
        return res.status(410).json({
          ok: false,
          error: 'Enrollment session is no longer active.',
        });
      }
      if (new Date(session.expires_at) < new Date()) {
        await query(
          `UPDATE rfid_enrollment_sessions SET status = 'expired' WHERE id = $1`,
          [sessionId],
        );
        return res.status(410).json({ ok: false, error: 'Enrollment session expired.' });
      }

      // A card already on another account cannot be enrolled.
      const used = await findByRfid(card);
      if (used && used.id !== session.user_id) {
        await query(
          `UPDATE rfid_enrollment_sessions SET status = 'cancelled' WHERE id = $1`,
          [sessionId],
        );
        return res.status(409).json({
          ok: false,
          error: 'That card is already registered to another account.',
        });
      }

      await query(
        `UPDATE rfid_enrollment_sessions
           SET card_uid = $2, status = 'detected'
         WHERE id = $1`,
        [sessionId, card],
      );

      res.json({ ok: true, card, detected: true });
    } catch (err) {
      console.error('Could not record scan:', describeError(err));
      res.status(503).json({ ok: false, error: 'The database could not be reached.' });
    }
  })();
});

/**
 * POST /api/account/rfid/enroll/confirm
 * The player confirms the detected card. Saves it to the account.
 */
router.post('/rfid/enroll/confirm', requireUser, async (req, res) => {
  const { sessionId } = req.body ?? {};
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'Missing enrollment session.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, user_id, card_uid, status, expires_at
         FROM rfid_enrollment_sessions
        WHERE id = $1 FOR UPDATE`,
      [sessionId],
    );
    const session = rows[0];
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Enrollment session not found.' });
    }
    if (session.user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'Not your enrollment session.' });
    }
    if (session.status !== 'detected') {
      await client.query('ROLLBACK');
      return res.status(410).json({
        ok: false,
        error: 'No card detected for this session.',
      });
    }
    if (new Date(session.expires_at) < new Date()) {
      await client.query(
        `UPDATE rfid_enrollment_sessions SET status = 'expired' WHERE id = $1`,
        [sessionId],
      );
      await client.query('COMMIT');
      return res.status(410).json({ ok: false, error: 'Enrollment session expired.' });
    }

    // Double-check the card is still free (another user could have taken it).
    const used = await findByRfid(session.card_uid);
    if (used && used.id !== req.user.id) {
      await client.query(
        `UPDATE rfid_enrollment_sessions SET status = 'cancelled' WHERE id = $1`,
        [sessionId],
      );
      await client.query('COMMIT');
      return res.status(409).json({
        ok: false,
        error: 'That card is already registered to another account.',
      });
    }

    await client.query(
      `UPDATE users SET rfid_uid = $2 WHERE id = $1`,
      [req.user.id, session.card_uid],
    );

    await client.query(
      `UPDATE rfid_enrollment_sessions
         SET status = 'completed', confirmed_at = NOW()
       WHERE id = $1`,
      [sessionId],
    );

    await client.query('COMMIT');

    const fresh = await findById(req.user.id);
    res.json({
      ok: true,
      message: 'RFID card registered successfully.',
      user: publicUser(fresh ?? null),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'That card is already registered.' });
    }
    console.error('Could not confirm enrollment:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/account/rfid/enroll/cancel
 * Cancels the active enrollment session for the signed-in player.
 */
router.post('/rfid/enroll/cancel', requireUser, async (req, res) => {
  try {
    await query(
      `UPDATE rfid_enrollment_sessions
         SET status = 'cancelled', expires_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [req.user.id],
    );
    res.json({ ok: true, message: 'Enrollment cancelled.' });
  } catch (err) {
    console.error('Could not cancel enrollment:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * GET /api/account/rfid/enroll/status
 * Returns the active enrollment session (if any) for the signed-in player.
 */
router.get('/rfid/enroll/status', requireUser, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, card_uid, status, expires_at, confirmed_at
         FROM rfid_enrollment_sessions
        WHERE user_id = $1
          AND status IN ('active', 'detected')
        ORDER BY created_at DESC
        LIMIT 1`,
      [req.user.id],
    );
    res.json({ ok: true, session: rows[0] ?? null });
  } catch (err) {
    console.error('Could not read enrollment status:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * DELETE /api/account
 * Removes the account of the player that is signed in.
 *
 * The password is asked for, so a stolen cookie cannot delete an account.
 */
router.delete('/', requireUser, async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  try {
    const account = await findById(req.user.id);
    if (!account || !verifyPassword(password, account.password)) {
      return res.status(401).json({ ok: false, error: 'That is not your password.' });
    }

    const removed = await deleteUser(req.user.id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'That account does not exist.' });
    }

    clearUserCookie(res);
    res.json({ ok: true, message: `${removed.username} was removed. Your account is gone.` });
  } catch (err) {
    console.error('Could not remove the account:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

export default router;
