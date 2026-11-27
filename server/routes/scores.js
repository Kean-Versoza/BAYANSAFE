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
      best_time   INTEGER,
      chapter     TEXT,
      level       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('ALTER TABLE high_scores ADD COLUMN IF NOT EXISTS best_time INTEGER');
  await query('ALTER TABLE high_scores ADD COLUMN IF NOT EXISTS chapter TEXT');
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
    const chapter = typeof req.body?.chapter === 'string' ? req.body.chapter.slice(0, 64) : null;
    const username = (user?.username) || (typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 32) : '') || 'Anonymous';
    const bestTime = req.body?.best_time != null ? Number(req.body.best_time) : null;

    await query(
      'INSERT INTO high_scores (user_id, username, score, best_time, chapter, level) VALUES ($1, $2, $3, $4, $5, $6)',
      [user?.id ?? null, username, Math.round(score), Number.isFinite(bestTime) ? Math.round(bestTime) : null, chapter, level],
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
    const offset = Math.max(0, Number(req.query?.offset) || 0);
    const level = typeof req.query?.level === 'string' ? req.query.level.slice(0, 64) : null;
    const params = [];
    let where = '';
    if (level) {
      params.push(level);
      where = 'WHERE level = $1';
    }
    params.push(limit);
    params.push(offset);
    const { rows } = await query(
      `SELECT username, score, best_time, chapter, level, created_at
       FROM high_scores
       ${where}
       ORDER BY (regexp_match(level, '_([0-9]+)$'))[1]::int NULLS LAST, score DESC, created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    // Total count for pagination
    const countParams = level ? [level] : [];
    const countWhere = level ? 'WHERE level = $1' : '';
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM high_scores ${countWhere}`,
      countParams,
    );
    res.json({ ok: true, scores: rows, total: countRows[0]?.total ?? 0, limit, offset });
  } catch (err) {
    console.error('Could not load leaderboard:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

export default router;
