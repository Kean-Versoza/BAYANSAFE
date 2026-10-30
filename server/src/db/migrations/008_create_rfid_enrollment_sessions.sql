-- RFID card enrollment sessions for the ESP32 quick sign-in flow.
--
-- One row per enrollment attempt. The ESP32 posts a scanned UID against an
-- active session, and the player confirms (or cancels) before the card is
-- permanently linked to the account.
CREATE TABLE IF NOT EXISTS rfid_enrollment_sessions (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_uid     TEXT,
  status       TEXT NOT NULL DEFAULT 'active', -- active, completed, expired, cancelled
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rfid_enrollment_sessions_user_id ON rfid_enrollment_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_rfid_enrollment_sessions_status ON rfid_enrollment_sessions (status);