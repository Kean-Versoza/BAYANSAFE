import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { query } from '../db/pool.js';
import { clearCookie, readCookies, setCookie } from './cookies.js';

/**
 * The sign in of the players.
 *
 * A player signs in with their email and their password. The server then
 * hands out a cookie with a random token. Only the hash of that token is
 * kept in the database, so the accounts of the players can be ended at any
 * time and a stolen database cannot be used to sign in as somebody else.
 */

export const COOKIE_NAME = 'bayansafe_user';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** The hash of a token. The token itself is never stored. */
function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/** Starts a sign in for a user and returns the token for the cookie. */
export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + MAX_AGE_MS);

  await query(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
          VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, hashToken(token), expires],
  );

  return { token, expires };
}

/** The user behind the cookie of the request, or null when nobody is signed in. */
export async function getSessionUser(req) {
  const token = readCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;

  const { rows } = await query(
    `SELECT u.id, u.username, u.email, u.rfid_uid, u.created_at, u.last_login_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()`,
    [hashToken(token)],
  );

  return rows[0] ?? null;
}

/** Ends the sign in of the request. */
export async function destroySession(req) {
  const token = readCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return;
  await query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Ends every sign in of one user. It is used when the password changes. */
export async function destroySessionsOf(userId) {
  await query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

/** Removes the sign ins that are old. */
export async function removeOldSessions() {
  await query('DELETE FROM user_sessions WHERE expires_at <= NOW()');
}

/** Puts the cookie of the player in the response. */
export function setUserCookie(res, token) {
  setCookie(res, COOKIE_NAME, token, { maxAge: MAX_AGE_MS });
}

/** Removes the cookie of the player. */
export function clearUserCookie(res) {
  clearCookie(res, COOKIE_NAME);
}
