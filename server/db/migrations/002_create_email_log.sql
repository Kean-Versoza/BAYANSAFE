<<<<<<< HEAD
-- A note of every email the site tried to send.
=======
﻿-- A note of every email the site tried to send.
>>>>>>> 0c2b239ee6494135d1db09295d6a81cc8bc39d9d
-- The dashboard uses this to show whether the welcome emails are going out.

CREATE TABLE IF NOT EXISTS email_log (
    id         BIGSERIAL   PRIMARY KEY,
    to_address TEXT        NOT NULL,
    subject    TEXT        NOT NULL DEFAULT '',
    kind       TEXT        NOT NULL DEFAULT 'other',  -- welcome | contact | test
    ok         BOOLEAN     NOT NULL DEFAULT TRUE,
    error      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_log_created_at_idx ON email_log (created_at DESC);
