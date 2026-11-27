import { Router } from 'express';

import { query, describeError } from '../db/pool.js';
import { getSessionUser } from '../services/userAuth.js';

const router = Router();

// Ensure table exists (auto-create on Vercel)
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS high_scores (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER,
      username    TEXT NOT NULL,
      score       INTEGER NOT NULL,
      level       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * POST /api/scores
 * Submit a high score. Requires sign-in (session cookie).
 */
router.post('/', async (req, res) => {
  await ensureTable();
  try {
    const user = await getSessionUser(req).catch(() => null);
    const score = Number(req.body?.score);
    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ ok: false, error: 'A valid score is required.' });
    }
    const level = typeof req.body?.level === 'string' ? req.body.level.slice(0, 64) : null;
    const username = (user?.username) || (typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 32) : '') || 'Anonymous';

    await query(
      'INSERT INTO high_scores (user_id, username, score, level) VALUES ($1, $2, $3, $4)',
      [user?.id ?? null, username, Math.round(score), level],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Could not save score:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

/**
 * GET /api/scores/leaderboard?limit=20
 * Top scores across all players.
 */
router.get('/leaderboard', async (req, res) => {
  await ensureTable();
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 20));
    const { rows } = await query(
      `SELECT username, score, level, created_at
       FROM high_scores
       ORDER BY score DESC, created_at ASC
       LIMIT $1`,
      [limit],
    );
    res.json({ ok: true, scores: rows });
  } catch (err) {
    console.error('Could not load leaderboard:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

export default router;
