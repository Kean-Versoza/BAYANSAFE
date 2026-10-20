-- The accounts of the players.
--
-- The password column holds the salted hash, never the password itself.

CREATE TABLE IF NOT EXISTS users (
    id         UUID        PRIMARY KEY,
    username   TEXT        NOT NULL,
    email      TEXT        NOT NULL,
    password   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Names are not case sensitive: "Juan" and "juan" are the same player.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key    ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (lower(username));
