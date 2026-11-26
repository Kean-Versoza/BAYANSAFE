import { Router } from 'express';
import { randomBytes } from 'node:crypto';

import { COOKIE_NAME, getSessionUser, setUserCookie } from '../services/userAuth.js';
import { readCookies } from '../services/cookies.js';
import { describeError } from '../db/pool.js';

const router = Router();

/**
 * Short-lived codes that let the desktop game borrow a website sign-in.
 *
 * The game starts a code and opens the website in the browser. The player
 * signs in there (Google, email + password or RFID), the page completes the
 * code, and the game polls for the session cookie. Nothing secret is exposed:
 * the code is random, single-use and expires after ten minutes.
 */
const codes = new Map();
const CODE_TTL_MS = 10 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [code, entry] of codes) {
    if (now - entry.createdAt > CODE_TTL_MS) codes.delete(code);
  }
}

function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  // In development Vite serves the client on 5173; in production Express
  // serves the built client on the same port as the API.
  return process.env.NODE_ENV === 'production'
    ? `http://localhost:${process.env.PORT || 3000}`
    : 'http://localhost:5173';
}

/** Public details of the signed-in player, safe to hand to the game client. */
function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    playerNumber: user.player_number ?? null,
    card: user.rfid_uid ?? null,
  };
}

/**
 * POST /api/client/device/start
 * Creates a sign-in code and returns the page the player should open.
 */
router.post('/device/start', (req, res) => {
  sweep();
  const code = randomBytes(4).toString('hex').toUpperCase();
  codes.set(code, {
    code,
    createdAt: Date.now(),
    token: null,
    user: null,
  });

  res.json({
    ok: true,
    code,
    url: `${siteUrl()}/game-login?code=${code}`,
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
});

/**
 * POST /api/client/device/complete
 * Called by the website once the player is signed in. Stores a copy of the
 * session token against the code so the game can pick it up.
 */
router.post('/device/complete', async (req, res) => {
  sweep();
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  const entry = codes.get(code);

  if (!entry) {
    return res.status(404).json({ ok: false, error: 'That sign-in code is unknown or has expired.' });
  }

  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Please sign in on the website first.' });
    }

    const token = readCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ ok: false, error: 'No sign-in session was found.' });
    }

    entry.token = token;
    entry.user = publicUser(user);
    res.json({ ok: true, user: entry.user });
  } catch (err) {
    console.error('Could not complete game sign in:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * POST /api/client/device/token
 * Called by the game. While the player is still signing in it answers
 * `{ pending: true }`; once complete it hands over the session cookie.
 */
router.post('/device/token', (req, res) => {
  sweep();
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  const entry = codes.get(code);

  if (!entry) {
    return res.status(404).json({ ok: false, error: 'That sign-in code is unknown or has expired.' });
  }
  if (!entry.token) {
    return res.json({ ok: false, pending: true });
  }

  setUserCookie(res, entry.token);
  const user = entry.user;
  codes.delete(code);                       // one code, one sign-in
  res.json({ ok: true, user });
});

export default router;
