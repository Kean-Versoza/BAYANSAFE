-- Messages that arrive in the admin Gmail inbox.
--
-- The dashboard already shows what visitors send with the site form. People
-- who use the footer's "Contact us" link write in Gmail instead, so those
-- messages are copied here by the inbox sync. `external_id` is the Gmail
-- message id: it stops the same email from being added twice.

ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS contact_messages_external_id_key
    ON contact_messages (external_id);

-- Small key/value store for sync bookkeeping (the last inbox sync time).
CREATE TABLE IF NOT EXISTS app_state (
    key        TEXT        PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
