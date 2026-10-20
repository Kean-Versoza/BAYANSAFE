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

/**
 * Creates an account.
 * Returns { user } when it worked, or { error, status } when it did not.
 */
export async function createUser({ username, email, password }) {
  try {
    const { rows } = await query(
      `INSERT INTO users (id, username, email, password)
            VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, created_at`,
      [randomUUID(), username, email, hashPassword(password)],
    );
    return { user: rows[0] };
  } catch (err) {
    // 23505 = unique_violation, the email or the username is taken
    if (err.code === '23505') {
      return { error: 'That username or email is already registered.', status: 409 };
    }
    throw err;
  }
}
