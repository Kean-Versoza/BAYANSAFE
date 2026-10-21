import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

import { query } from '../db/pool.js';

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
    `SELECT id, username, email, password, created_at
       FROM users
      WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

/** Finds one account by username. */
export async function findByUsername(username) {
  const { rows } = await query(
    `SELECT id, username, email, password, created_at
       FROM users
      WHERE lower(username) = lower($1)`,
    [username],
  );
  return rows[0] ?? null;
}

/** Finds one account by its id. */
export async function findById(id) {
  const { rows } = await query(
    `SELECT id, username, email, password, rfid_uid, created_at, last_login_at
       FROM users
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
/** Finds the account that has this card. */
export async function findByRfid(rfidUid) {
  const { rows } = await query(
    `SELECT id, username, email, created_at
       FROM users
      WHERE rfid_uid IS NOT NULL
        AND lower(rfid_uid) = lower($1)`,
    [rfidUid],
  );
  return rows[0] ?? null;
}

/**
 * Creates an account.
 * Returns { user } when it worked, or { error, status } when it did not.
 */
export async function createUser({ username, email, password, rfidUid = null }) {
  try {
    const { rows } = await query(
      `INSERT INTO users (id, username, email, password, rfid_uid)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, email, rfid_uid, created_at`,
      [randomUUID(), username, email, hashPassword(password), rfidUid || null],
    );
    return { user: rows[0] };
  } catch (err) {
    // 23505 = unique_violation, the email, the username or the card is taken
    if (err.code === '23505') {
      if (err.constraint === 'users_rfid_uid_lower_key') {
        return { error: 'That RFID card is already registered to another account.', status: 409 };
      }
      return { error: 'That username or email is already registered.', status: 409 };
    }
    throw err;
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
      RETURNING id, username, email, rfid_uid, created_at, last_login_at`,
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
