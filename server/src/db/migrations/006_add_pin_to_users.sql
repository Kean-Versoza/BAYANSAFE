-- PIN for RFID quick sign-in security.
--
-- A hashed 4- to 6-digit PIN protects the account when using RFID quick
-- sign in, so a lost or stolen card cannot be used by someone else.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
