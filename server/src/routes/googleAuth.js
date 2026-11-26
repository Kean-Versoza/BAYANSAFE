import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/pool.js';
import { randomBytes } from 'node:crypto';
import { createSession, setUserCookie, removeOldSessions } from '../services/userAuth.js';
import { findByEmail, createUser } from '../services/users.js';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Verifies a Google ID token and creates or signs in the user.
 *
 * Body: { token: <Google ID token> }
 */
router.post('/', async (req, res) => {
  const { token } = req.body ?? {};

  if (!token) {
    return res.status(400).json({ ok: false, error: 'Missing Google token.' });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      ok: false,
      error: 'Google Sign-In is not configured on the server.',
    });
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    console.error('Google token verification failed:', err.message);
    return res.status(401).json({ ok: false, error: 'Invalid Google token.' });
  }

  const payload = ticket.getPayload();
  const googleId = payload.sub;
  const email = payload.email;
  const username = payload.name ?? email?.split('@')[0] ?? 'google_user';
  const picture = payload.picture;

  if (!email) {
    return res.status(400).json({ ok: false, error: 'Google account has no email address.' });
  }

  try {
    // Check if an account already exists with this email
    let user = await findByEmail(email);

    if (!user) {
      // Create a new account from the Google profile.
      // A random password is set so the account exists, but the user signs
      // in with Google instead of email + password.
      const { user: newUser, error } = await createUser({
        username,
        email,
        password: randomBytes(32).toString('hex'),
      });
      if (error) {
        return res.status(409).json({ ok: false, error });
      }
      user = newUser;
    }

    // Start a session for the user
    await removeOldSessions();
    const { token: sessionToken } = await createSession(user.id);
    setUserCookie(res, sessionToken);

    res.json({
      ok: true,
      message: `Welcome, ${user.username}!`,
      user: {
        id: user.id,
        playerNumber: user.player_number ?? null,
        username: user.username,
        email: user.email,
        rfidUid: user.rfid_uid ?? null,
        picture,
      },
    });
  } catch (err) {
    console.error('Google sign in error:', err.message);
    res.status(503).json({ ok: false, error: 'Database error.' });
  }
});

export default router;
