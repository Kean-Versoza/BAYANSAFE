import crypto from 'node:crypto';

/**
 * Tiny in-memory account store.
 *
 * There is no database yet, so registrations live only for as long as the
 * server process is running. Passwords are never stored in plain text -
 * they are salted and hashed with scrypt, which matches what the Privacy
 * Policy promises.
 */
const accounts = new Map(); // key: lowercased email

const SCRYPT_KEYLEN = 64;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(derived);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function findAccount(email) {
  return accounts.get(String(email).trim().toLowerCase()) ?? null;
}

export function createUser({ username, email, password }) {
  const key = String(email).trim().toLowerCase();
  if (accounts.has(key)) {
    throw new Error('An account with that email address already exists.');
  }

  const account = {
    id: crypto.randomUUID(),
    username: String(username).trim(),
    email: key,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  accounts.set(key, account);
  return account;
}

export function verifyUser({ email, password }) {
  const account = findAccount(email);
  if (!account) return null;
  return verifyPassword(password, account.password) ? account : null;
}

export function accountCount() {
  return accounts.size;
}
