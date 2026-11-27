import { Router } from 'express';
import { randomBytes } from 'node:crypto';

import { COOKIE_NAME, getSessionUser, setUserCookie } from '../services/userAuth.js';
import { readCookies } from '../services/cookies.js';
import { describeError } from '../db/pool.js';
import { query } from '../db/pool.js';

const router = Router();

const CODE_TTL_MS = 10 * 60 * 1000;

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS game_device_codes (
      code         TEXT PRIMARY KEY,
      token        TEXT,
      user_data    JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL
    )
  `);
}

async function sweep() {
  try {
    await ensureTable();
    await query('DELETE FROM game_device_codes WHERE expires_at < NOW()');
  } catch (err) {
    // ignore sweep errors
  }
}

function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
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

router.post('/device/start', async (req, res) => {
  await ensureTable();
  await sweep();
  const code = randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  try {
    await query(
      'INSERT INTO game_device_codes (code, expires_at) VALUES ($1, $2)',
      [code, expiresAt]
    );
    res.json({
      ok: true,
      code,
      url: `${siteUrl()}/account?code=${code}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Could not start game sign in:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

router.post('/device/complete', async (req, res) => {
  await ensureTable();
  await sweep();
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';

  try {
    const { rows } = await query('SELECT * FROM game_device_codes WHERE code = $1', [code]);
    const entry = rows[0];
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'That sign-in code is unknown or has expired.' });
    }
    if (new Date(entry.expires_at) < new Date()) {
      await query('DELETE FROM game_device_codes WHERE code = $1', [code]);
      return res.status(404).json({ ok: false, error: 'That sign-in code is unknown or has expired.' });
    }

    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Please sign in on the website first.' });
    }

    const token = readCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ ok: false, error: 'No sign-in session was found.' });
    }

    await query(
      'UPDATE game_device_codes SET token = $1, user_data = $2 WHERE code = $3',
      [token, publicUser(user), code]
    );
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('Could not complete game sign in:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

router.post('/device/token', async (req, res) => {
  await ensureTable();
  await sweep();
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';

  try {
    const { rows } = await query('SELECT * FROM game_device_codes WHERE code = $1', [code]);
    const entry = rows[0];
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'That sign-in code is unknown or has expired.' });
    }
    if (new Date(entry.expires_at) < new Date()) {
      await query('DELETE FROM game_device_codes WHERE code = $1', [code]);
      return res.status(404).json({ ok: false, error: 'That sign-in code is unknown or has expired.' });
    }
    if (!entry.token) {
      return res.json({ ok: false, pending: true });
    }

    setUserCookie(res, entry.token);
    const user = entry.user_data;
    await query('DELETE FROM game_device_codes WHERE code = $1', [code]);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Could not fetch game token:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

export default router;
