CREATE TABLE IF NOT EXISTS high_scores (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  score       INTEGER NOT NULL,
  level       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores (score DESC);
CREATE INDEX IF NOT EXISTS idx_high_scores_user ON high_scores (user_id);