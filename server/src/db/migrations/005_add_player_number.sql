-- The player number of an account, like QCU_001. It is given when the
-- account is made and never changes, so it can be written on a paper and
-- still mean the same thing tomorrow.

ALTER TABLE users ADD COLUMN IF NOT EXISTS player_number TEXT NOT NULL DEFAULT '';

-- The counter that hands out the player numbers: QCU_001, QCU_002, ...
CREATE SEQUENCE IF NOT EXISTS bayansafe_player_number_seq AS INTEGER START WITH 1;
