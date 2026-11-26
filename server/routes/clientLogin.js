import { Router } from 'express';
import { randomBytes } from 'node:crypto';

import { COOKIE_NAME, getSessionUser, setUserCookie } from '../services/userAuth.js';
import { readCookies } from '../services/cookies.js';
import { describeError } from '../db/pool.js';

const router = Router();

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
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NODE_ENV === 'production'
    ? `http://localhost:${process.env.PORT || 3001}`
    : 'http://localhost:5173';
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    playerNumber: user.player_number ?? null,
    card: user.rfid_uid ?? null,
  };
}

router.post('/device/start', (req, res) => {
  sweep();
  const code = randomBytes(4).toString('hex').toUpperCase();
  codes.set(code, { code, createdAt: Date.now(), token: null, user: null });

  res.json({
    ok: true,
    code,
    url: `${siteUrl()}/account?code=${code}`,
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
});

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
  codes.delete(code);
  res.json({ ok: true, user });
});

export default router;
