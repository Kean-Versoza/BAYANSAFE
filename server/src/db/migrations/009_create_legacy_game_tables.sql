-- The desktop game still has a legacy PostgreSQL persistence layer that uses
-- its own player/stage tables (src/core/database.py).  Older installs only
-- received the website tables, which made every legacy save log
-- `relation "players" does not exist`.  These tables are safe to create
-- alongside the website tables and are idempotent.
CREATE TABLE IF NOT EXISTS players (
    player_id      SERIAL PRIMARY KEY,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(100),
    card_hash      CHAR(64) UNIQUE,
    character_id   VARCHAR(30),
    created_at     TIMESTAMP DEFAULT NOW(),
    last_played_at TIMESTAMP,
    play_seconds   INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_stage_progress (
    player_id   INT REFERENCES players ON DELETE CASCADE,
    stage_id    VARCHAR(30),
    status      VARCHAR(10) DEFAULT 'LOCKED'
                CHECK (status IN ('LOCKED','UNLOCKED','COMPLETED')),
    best_time_s INT,
    best_score  INT,
    perfect     BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (player_id, stage_id)
);

CREATE TABLE IF NOT EXISTS player_achievements (
    player_id      INT REFERENCES players ON DELETE CASCADE,
    achievement_id VARCHAR(50),
    unlocked_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (player_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS stage_runs (
    run_id          SERIAL PRIMARY KEY,
    player_id       INT REFERENCES players ON DELETE CASCADE,
    stage_id        VARCHAR(30),
    time_seconds    INT,
    damage_taken    INT,
    objectives_done INT,
    items_found     INT,
    score           INT,
    completed       BOOLEAN,
    played_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
    question_id SERIAL PRIMARY KEY,
    stage_id    VARCHAR(30) NOT NULL,
    phase       VARCHAR(10) CHECK (phase IN ('BEFORE','DURING','AFTER')),
    prompt      TEXT NOT NULL,
    option_a    TEXT NOT NULL,
    option_b    TEXT NOT NULL,
    option_c    TEXT,
    option_d    TEXT,
    correct     CHAR(1) NOT NULL CHECK (correct IN ('A','B','C','D')),
    explanation TEXT
);

CREATE TABLE IF NOT EXISTS answer_log (
    log_id      SERIAL PRIMARY KEY,
    player_id   INT REFERENCES players ON DELETE CASCADE,
    question_id INT REFERENCES questions,
    chosen      CHAR(1),
    is_correct  BOOLEAN,
    answered_at TIMESTAMP DEFAULT NOW()
);
