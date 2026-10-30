import { randomBytes } from 'node:crypto';

import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';

import { describeError } from '../db/pool.js';
import { createUser, findByEmail, findById, findByUsername, noteSignIn } from '../services/users.js';
import { publicUser } from '../services/publicUser.js';
import { createSession, removeOldSessions, setUserCookie } from '../services/userAuth.js';
import { sendMail } from '../services/mailer.js';
import { welcomeMessage } from '../services/mailTemplates.js';

const router = Router();

/**
 * "Continue with Google" for the players.
 *
 * The browser gets an ID token from Google Identity Services and posts it
 * here. The token is checked against GOOGLE_CLIENT_ID before anything is
 * trusted, so a made-up token can never create an account.
 *
 * An account is found by its email address. When there is no account yet it
 * is created from the Google profile, with a random password: the player
 * signs in with Google, not with a password. The password can still be set
 * later on the account page.
 */

// One verifier per process. It is only made when the setting is present, so
// the site keeps working (without Google) when it is not.
let verifier = null;

function googleVerifier(clientId) {
  if (!verifier) verifier = new OAuth2Client(clientId);
  return verifier;
}

/** A tidy username from the Google profile. */
function usernameFromProfile(payload) {
  const source = payload.name || payload.given_name || payload.email?.split('@')[0] || '';
  const cleaned = String(source)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents from "José" and the like
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim();

  if (cleaned.length >= 3) return cleaned;
  return `player${randomBytes(3).toString('hex')}`;
}

/**
 * A username that is not taken yet. Two players may have the same name in
 * Google, so a number is added when the plain name is already in use.
 */
async function uniqueUsername(base) {
  if (!(await findByUsername(base))) return base;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base.slice(0, 26)} ${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await findByUsername(candidate))) return candidate;
  }

  return `player${randomBytes(4).toString('hex')}`;
}

/**
 * POST /api/auth/google
 *
 * Body: { credential: <Google ID token> }
 */
router.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({
      ok: false,
      error: 'Google sign-in is not set up on the server yet.',
    });
  }

  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) {
    return res.status(400).json({ ok: false, error: 'Google did not send a sign-in token.' });
  }

  let payload;
  try {
    const ticket = await googleVerifier(clientId).verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('Google token verification failed:', err.message);
    return res.status(401).json({
      ok: false,
      error: 'That Google sign-in could not be verified. Please try again.',
    });
  }

  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  if (!email) {
    return res.status(400).json({ ok: false, error: 'That Google account has no email address.' });
  }

  // Only an address Google itself has confirmed may be linked to an account.
  if (payload.email_verified !== true) {
    return res.status(401).json({
      ok: false,
      error: 'Google has not confirmed that email address, so it cannot be used to sign in.',
    });
  }

  try {
    let user = await findByEmail(email);
    let created = false;

    if (!user) {
      const username = await uniqueUsername(usernameFromProfile(payload));
      const result = await createUser({
        username,
        email,
        // The player signs in with Google. The random password is a
        // placeholder; a real one can be chosen on the account page.
        password: randomBytes(32).toString('hex'),
      });

      if (result.error) {
        return res.status(result.status ?? 409).json({ ok: false, error: result.error });
      }

      user = result.user;
      created = true;
    }

    await removeOldSessions();

    const { token } = await createSession(user.id);
    setUserCookie(res, token);
    await noteSignIn(user.id);

    const fresh = await findById(user.id);
    const account = publicUser(fresh ?? user);

    // A welcome email is a nice extra, never a reason to fail the sign in.
    if (created) {
      try {
        const welcome = welcomeMessage({ username: account.username, email: account.email });
        await sendMail({
          to: account.email,
          subject: welcome.subject,
          text: welcome.text,
          html: welcome.html,
          kind: 'welcome',
        });
      } catch (err) {
        if (err.code !== 'MAIL_NOT_CONFIGURED') {
          console.error('Could not send the welcome email:', describeError(err));
        }
      }
    }

    res.json({
      ok: true,
      created,
      message: created
        ? `Welcome, ${account.username}! Your account is ready.`
        : `Welcome back, ${account.username}!`,
      user: account,
    });
  } catch (err) {
    console.error('Could not sign in with Google:', describeError(err));
    res.status(503).json({ ok: false, error: 'The database could not be reached.' });
  }
});

export default router;
