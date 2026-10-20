import { Router } from 'express';
import { createUser, findByEmail } from '../services/users.js';
import { describeError } from '../db/pool.js';
import { sendMail } from '../services/mailer.js';
import { welcomeMessage } from '../services/mailTemplates.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ username, email, password, acceptedTerms }) {
  if (typeof username !== 'string' || username.trim().length < 3) {
    return 'Please enter a username of at least 3 characters.';
  }
  if (username.trim().length > 32) {
    return 'That username is too long (32 characters maximum).';
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (typeof password !== 'string' || password.length < 8) {
    return 'Please use a password of at least 8 characters.';
  }
  if (acceptedTerms !== true) {
    return 'Please agree to the safety terms.';
  }
  return null;
}

/**
 * POST /api/register
 * Creates an account and stores the password as a salted hash.
 */
router.post('/', async (req, res) => {
  const body = req.body ?? {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  const problem = validate({ ...body, username, email });
  if (problem) {
    return res.status(400).json({ ok: false, error: problem });
  }

  try {
    const existing = await findByEmail(email);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'That email is already registered.' });
    }

    const { user, error, status } = await createUser({ username, email, password: body.password });
    if (error) {
      return res.status(status ?? 400).json({ ok: false, error });
    }

    // The welcome email goes out after the account is made, so a problem with
    // Gmail never stops somebody from registering.
    const welcome = welcomeMessage({ username: user.username, email: user.email });
    let emailSent = false;
    let emailNote = '';

    try {
      await sendMail({
        to: user.email,
        subject: welcome.subject,
        text: welcome.text,
        html: welcome.html,
        kind: 'welcome',
      });
      emailSent = true;
    } catch (err) {
      if (err.code === 'MAIL_NOT_CONFIGURED') {
        emailNote = 'Email is not set up on the server yet, so no welcome email was sent.';
      } else {
        emailNote = 'Your account is ready, but the welcome email could not be sent.';
        console.error('Could not send the welcome email:', describeError(err));
      }
    }

    res.status(201).json({
      ok: true,
      message: `Welcome, ${user.username}! Your account is ready.`,
      emailSent,
      emailNote,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    // The database is not reachable
    console.error('Could not create the account:', describeError(err));
    res.status(503).json({
      ok: false,
      error: 'The server cannot reach the database right now. Is PostgreSQL running?',
    });
  }
});

export default router;
