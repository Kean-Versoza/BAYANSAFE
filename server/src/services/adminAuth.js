import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The admin sign in.
 *
 * The admin gives a password in server/.env (ADMIN_PASSWORD). When it is
 * right, the server hands out a signed cookie that is good for a few hours.
 * The cookie is signed with a key, so it cannot be made up.
 */

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || PASSWORD || randomBytes(32).toString('hex');

export const COOKIE_NAME = 'bayansafe_admin';
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/** True when an admin password has been set. */
export function isAdminConfigured() {
  return PASSWORD.length > 0;
}

/** Compares two strings without leaking how much matched. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
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
export function readCookies(header = '') {
  const jar = {};
  for (const part of String(header).split(';')) {
    const piece = part.trim();
    if (!piece) continue;
    const at = piece.indexOf('=');
    if (at < 0) continue;
    try {
      jar[piece.slice(0, at)] = decodeURIComponent(piece.slice(at + 1));
    } catch {
      jar[piece.slice(0, at)] = piece.slice(at + 1);
    }
  }
  return jar;
}

/** Puts the signed cookie in the response. */
export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

/** Removes the cookie. */
export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** True when this request comes from a signed in admin. */
export function isSignedIn(req) {
  return verifyToken(readCookies(req.headers.cookie)[COOKIE_NAME]);
}
