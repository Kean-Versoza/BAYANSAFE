import { Router } from 'express';

import { query, checkDatabase } from '../db/pool.js';
import { describeError } from '../db/pool.js';
import {
  checkPassword,
  clearSessionCookie,
  isAdminConfigured,
  isSignedIn,
  setSessionCookie,
  signToken,
} from '../services/adminAuth.js';
import { checkConnection, isMailConfigured, mailRecipient, provider } from '../services/mailer.js';

const router = Router();

/* ------------------------------------------------------------------
   Signing in
   ------------------------------------------------------------------ */

// A few tries, then a wait. This stops someone guessing the password.
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
    attempts.set(key, { start: Date.now(), count: 1 });
  } else {
    entry.count += 1;
  }
}

/** Everything under /api/admin needs a signed in admin, except login. */
function requireAdmin(req, res, next) {
  if (!isSignedIn(req)) {
    return res.status(401).json({ ok: false, error: 'Please sign in first.' });
  }
  next();
}

/**
 * GET /api/admin/session
 * Tells the front end whether the admin is signed in.
 */
router.get('/session', (req, res) => {
  res.json({
    signedIn: isSignedIn(req),
    configured: isAdminConfigured(),
  });
});

/**
 * POST /api/admin/login
 */
router.post('/login', (req, res) => {
  if (!isAdminConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'No admin password is set. Add ADMIN_PASSWORD to server/.env.',
    });
  }

  const key = req.ip ?? 'unknown';
  if (tooManyTries(key)) {
    return res.status(429).json({
      ok: false,
      error: 'Too many tries. Please wait a few minutes.',
    });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!checkPassword(password)) {
    noteFailedTry(key);
    return res.status(401).json({ ok: false, error: 'That password is not right.' });
  }

  attempts.delete(key);
  setSessionCookie(res, signToken());
  res.json({ ok: true, message: 'Signed in.' });
});

/**
 * POST /api/admin/logout
 */
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------
   The dashboard
   ------------------------------------------------------------------ */

/**
 * GET /api/admin/stats
 * The numbers for the tiles and the chart.
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { rows: totals } = await query(`
      SELECT
        (SELECT count(*)::int FROM users)                              AS accounts,
        (SELECT count(*)::int FROM users WHERE created_at >= date_trunc('day', now())) AS today,
        (SELECT count(*)::int FROM users WHERE created_at >= now() - interval '7 days')  AS week,
        (SELECT count(*)::int FROM email_log)                         AS emails,
        (SELECT count(*)::int FROM email_log WHERE ok = FALSE)        AS emails_failed,
        (SELECT count(*)::int FROM email_log WHERE created_at >= date_trunc('day', now())) AS emails_today
    `);

    // The chart is built in the database, so it uses the same clock and the
    // same time zone as the tiles above.
    const { rows: chart } = await query(`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day, COALESCE(u.count, 0)::int AS count
        FROM generate_series(
               (now() - interval '13 days')::date,
               now()::date,
               interval '1 day'
             ) AS d
        LEFT JOIN (
          SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
            FROM users
           GROUP BY 1
        ) AS u ON u.day = d::date
       ORDER BY d
    `);

    res.json({ ok: true, totals: totals[0], chart });
  } catch (err) {
    console.error('Could not read the stats:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * GET /api/admin/users
 * The list of accounts. Supports ?q= for a search and ?limit=&offset=.
 */
router.get('/users', requireAdmin, async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const pattern = `%${search}%`;

    const { rows } = await query(
      `SELECT id, username, email, created_at
         FROM users
        WHERE ($1 = '' OR username ILIKE $2 OR email ILIKE $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4`,
      [search, pattern, limit, offset],
    );

    const { rows: counts } = await query(
      `SELECT count(*)::int AS count
         FROM users
        WHERE ($1 = '' OR username ILIKE $2 OR email ILIKE $2)`,
      [search, pattern],
    );

    res.json({
      ok: true,
      users: rows.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.created_at,
      })),
      total: counts[0].count,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Could not read the users:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * GET /api/admin/emails
 * The recent emails the site sent.
 */
router.get('/emails', requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  try {
    const { rows } = await query(
      `SELECT id, to_address, subject, kind, ok, error, created_at
         FROM email_log
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
    );
    res.json({ ok: true, emails: rows });
  } catch (err) {
    console.error('Could not read the email log:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * GET /api/admin/status
 * How the system is doing.
 */
router.get('/status', requireAdmin, async (req, res) => {
  const db = await checkDatabase();
  const mail = await checkConnection();

  let version = null;
  try {
    const { rows } = await query('SELECT version() AS version');
    version = rows[0].version.split(' ').slice(0, 2).join(' ');
  } catch {
    /* leave it empty */
  }

  res.json({
    ok: true,
    database: { ok: db.ok, message: db.message, version },
    mail: {
      ok: mail.ok,
      configured: isMailConfigured(),
      provider: provider.label,
      recipient: isMailConfigured() ? mailRecipient() : null,
      message: mail.message,
    },
  });
});

/**
 * DELETE /api/admin/users/:id
 * Removes one account.
 */
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;

  // Only a real UUID can be deleted, so a wrong id cannot touch the wrong row
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ ok: false, error: 'That is not a valid account id.' });
  }

  try {
    const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'That account does not exist.' });
    }
    res.json({ ok: true, message: `${rows[0].username} was removed.` });
  } catch (err) {
    console.error('Could not delete the account:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

export default router;
