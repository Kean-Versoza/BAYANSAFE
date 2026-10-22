import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { clearCookie, readCookies, setCookie } from './cookies.js';

/**
 * The admin sign in.
 *
 * The admin gives an email and a password in .env (ADMIN_EMAIL, ADMIN_PASSWORD).
 * When they are right, the server hands out a signed cookie that is good for
 * a few hours. The cookie is signed with a key, so it cannot be made up.
 *
 * The admin password is deliberately exempt from the player password rules in
 * shared/password.js. It is not stored in the database and never goes through
 * registration or the account page, so it is allowed to stay short and easy to
 * type for quick access. Keep it private all the same: the dashboard shows
 * every account.
 */

const EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || PASSWORD || EMAIL || randomBytes(32).toString('hex');

export const COOKIE_NAME = 'bayansafe_admin';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/** True when an admin email and password have been set. */
export function isAdminConfigured() {
  return EMAIL.length > 0 && PASSWORD.length > 0;
}

/** The email the admin signs in with (for showing a hint). */
export function adminEmail() {
  return EMAIL;
}

/** Compares two strings without leaking how much matched. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** True when the given email and password match the admin. */
export function checkCredentials(email, password) {
  // No strength check here, on purpose: the admin password comes from the
  // environment and is exempt from the player rules (see the file header).
  if (!isAdminConfigured()) return false;
  const given = String(email || '').trim().toLowerCase();
  return safeEqual(given, EMAIL) && safeEqual(password, PASSWORD);
}

/**
 * True when the email is the one the admin signs in with.
 *
 * The account page tries the admin sign in first, so a player typing their own
 * email here is normal traffic. Only a wrong password for the admin's own email
 * is worth counting, otherwise a few players would lock the admin out.
 */
export function isAdminEmail(email) {
  if (!isAdminConfigured()) return false;
  return safeEqual(String(email || '').trim().toLowerCase(), EMAIL);
}

/** True when the given password is the admin password. */
export function checkPassword(password) {
  if (!isAdminConfigured()) return false;
  return safeEqual(password, PASSWORD);
}

/** Makes a signed token that is good until it expires. */
export function signToken() {
  const expires = Date.now() + MAX_AGE_MS;
  const signature = createHmac('sha256', SECRET).update(String(expires)).digest('hex');
  return `${expires}.${signature}`;
}

/** True when the token was signed by us and has not expired. */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;

  const [expires, signature] = token.split('.');
  if (!expires || !signature) return false;

  const expected = createHmac('sha256', SECRET).update(String(expires)).digest('hex');
  if (!safeEqual(signature, expected)) return false;

  return Number(expires) > Date.now();
}

/** Reads the cookies out of a request. */
export { readCookies };

/** Puts the signed cookie in the response. */
export function setSessionCookie(res, token) {
  setCookie(res, COOKIE_NAME, token, { maxAge: MAX_AGE_MS });
}

/** Removes the cookie. */
export function clearSessionCookie(res) {
  clearCookie(res, COOKIE_NAME);
}

/** True when this request comes from a signed in admin. */
export function isSignedIn(req) {
  return verifyToken(readCookies(req.headers.cookie)[COOKIE_NAME]);
}
