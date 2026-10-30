-- The sign in of the players.
--
-- Every sign in makes a row here. The cookie of the player holds a random
-- token, and only the hash of that token is kept, so a stolen database cannot
-- be used to sign in as somebody else.

CREATE TABLE IF NOT EXISTS user_sessions (
    id         UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_hash_key ON user_sessions (token_hash);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx         ON user_sessions (user_id);

-- When the player signed in the last time.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
