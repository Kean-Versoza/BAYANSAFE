-- Stores scans that arrive from an ESP32 (or any other bridge) so they can
-- be reviewed later, independent of the live browser feed.
CREATE TABLE IF NOT EXISTS rfid_scans (
  id          SERIAL PRIMARY KEY,
  uid         TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'esp32',
  raw         TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfid_scans_uid ON rfid_scans (uid);
CREATE INDEX IF NOT EXISTS idx_rfid_scans_received_at ON rfid_scans (received_at);