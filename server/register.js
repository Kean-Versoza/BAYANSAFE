import { createUser } from './store.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a registration payload and create the account.
 *
 * Shared by the Express server (`server/index.js`, used by `npm run dev` and
 * `npm start`) and the Vercel function (`api/register.js`) so both accept and
 * reject exactly the same requests.
 *
 * @param {object} payload  Parsed JSON body: { username, email, password, terms }
 * @returns {{ status: number, body: object }} The response to send back.
 */
export function registerAccount(payload) {
  const { username = '', email = '', password = '', terms } = payload ?? {};
  const errors = [];

  if (String(username).trim().length < 3) {
    errors.push('Username must be at least 3 characters long.');
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    errors.push('Please enter a valid email address.');
  }
  if (String(password).length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!terms) {
    errors.push('You must agree to the safety terms.');
  }

  if (errors.length) {
    return { status: 400, body: { ok: false, errors } };
  }

  try {
    const account = createUser({ username, email, password });
    return {
      status: 201,
      body: { ok: true, message: `Welcome, ${account.username}! Your account has been created.` },
    };
  } catch (err) {
    return { status: 409, body: { ok: false, errors: [err.message] } };
  }
}
