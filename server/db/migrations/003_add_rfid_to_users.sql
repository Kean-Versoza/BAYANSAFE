-- The RFID card of the player.
--
-- The column holds the card number the reader gave us, in upper case, so the
-- same card always looks the same. It is empty when the player has no card.

ALTER TABLE users ADD COLUMN IF NOT EXISTS rfid_uid TEXT;

-- A card can only belong to one account.
CREATE UNIQUE INDEX IF NOT EXISTS users_rfid_uid_lower_key
    ON users (lower(rfid_uid))
    WHERE rfid_uid IS NOT NULL;
