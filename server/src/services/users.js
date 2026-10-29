import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { getClient, query } from '../db/pool.js';

const KEY_LENGTH = 64;

/**
 * Hashes a password with scrypt and a random salt.
 * The result looks like: scrypt$<salt hex>$<hash hex>
 */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Hashes a 4- to 6-digit PIN for RFID quick sign-in. */
export function hashPin(pin) {
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4 to 6 digits.');
  }
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Checks a plain PIN against a stored hash. */
export function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(String(pin), salt, expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Sets a PIN on an account. */
export async function setPin(id, pin) {
  const { rows } = await query(
    `UPDATE users SET pin_hash = $2 WHERE id = $1 RETURNING id`,
    [id, hashPin(pin)],
  );
  return rows[0] ?? null;
}

/** Checks a plain password against a stored hash. */
export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

/** Finds one account by email. */
export async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, username, email, password, player_number, created_at
       FROM users
      WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

/** Finds one account by username. */
export async function findByUsername(username) {
  const { rows } = await query(
    `SELECT id, username, email, password, player_number, created_at
       FROM users
      WHERE lower(username) = lower($1)`,
    [username],
  );
  return rows[0] ?? null;
}

/** Finds one account by its id. */
export async function findById(id) {
  const { rows } = await query(
    `SELECT id, username, email, password, rfid_uid, player_number, pin_hash, created_at, last_login_at
       FROM users
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
/** Finds the account that has this card. */
export async function findByRfid(rfidUid) {
  const { rows } = await query(
    `SELECT id, username, email, player_number, pin_hash, created_at
       FROM users
      WHERE rfid_uid IS NOT NULL
        AND lower(rfid_uid) = lower($1)`,
    [rfidUid],
  );
  return rows[0] ?? null;
}

/**
 * The next player number, auto-incremented like QCU_001, QCU_002, ...
 * Drawn from the database sequence so two sign ups at the same time cannot
 * get the same number. Runs inside a transaction.
 */
async function nextPlayerNumber(client) {
  const { rows } = await client.query(`SELECT nextval('bayansafe_player_number_seq') AS n`);
  const n = Number(rows[0].n);
  return `QCU_${String(n).padStart(3, '0')}`;
}

/**
 * Creates an account.
 * Returns { user } when it worked, or { error, status } when it did not.
 *
 * Every account gets an auto-incremented player number (QCU_001, QCU_002, ...)
 * that is stored with the account. When an RFID card is tapped during
 * registration, the card is linked to this same account.
 */
export async function createUser({ username, email, password, rfidUid = null }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const playerNumber = await nextPlayerNumber(client);

    const { rows } = await client.query(
      `INSERT INTO users (id, username, email, password, rfid_uid, player_number)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, email, rfid_uid, player_number, created_at`,
      [randomUUID(), username, email, hashPassword(password), rfidUid || null, playerNumber],
    );

    await client.query('COMMIT');
    return { user: rows[0] };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // 23505 = unique_violation, the email, the username or the card is taken
    if (err.code === '23505') {
      if (err.constraint === 'users_rfid_uid_lower_key') {
        return { error: 'That RFID card is already registered to another account.', status: 409 };
      }
      return { error: 'That username or email is already registered.', status: 409 };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Changes the name and the email of an account.
 * Returns { user } when it worked, or { error, status } when it did not.
 */
export async function updateUser({ id, username, email }) {
  try {
    const { rows } = await query(
      `UPDATE users
          SET username = $2, email = $3
        WHERE id = $1
      RETURNING id, username, email, rfid_uid, player_number, created_at, last_login_at`,
      [id, username, email],
    );
    return { user: rows[0] };
  } catch (err) {
    // 23505 = unique_violation, the email or the username is taken
    if (err.code === '23505') {
      if (err.constraint === 'users_username_lower_key') {
        return { error: 'That name is already taken.', status: 409 };
      }
      return { error: 'That email is already registered.', status: 409 };
    }
    throw err;
  }
}

/** Sets a new password for an account. */
export async function updatePassword(id, password) {
  const { rows } = await query(
    `UPDATE users
        SET password = $2
      WHERE id = $1
    RETURNING id, username, email`,
    [id, hashPassword(password)],
  );
  return rows[0] ?? null;
}

/** Removes an account. */
export async function deleteUser(id) {
  const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING username', [id]);
  return rows[0] ?? null;
}

/** Notes that the player signed in. */
export async function noteSignIn(id) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
}
