-- Messages that visitors send with the "Send us a message" form.
--
-- They are saved here as well as emailed, so the admin dashboard can show
-- exactly what was written even when the email has already been read or lost.

CREATE TABLE IF NOT EXISTS contact_messages (
    id         BIGSERIAL   PRIMARY KEY,
    name       TEXT        NOT NULL,
    email      TEXT        NOT NULL,
    subject    TEXT        NOT NULL DEFAULT '',
    message    TEXT        NOT NULL,
    source     TEXT        NOT NULL DEFAULT 'contact',  -- contact | help
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_is_read_idx    ON contact_messages (is_read);
