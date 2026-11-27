CREATE TABLE IF NOT EXISTS game_device_codes (
  code         TEXT PRIMARY KEY,
  token        TEXT,
  user_data    JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_device_codes_expires ON game_device_codes (expires_at);