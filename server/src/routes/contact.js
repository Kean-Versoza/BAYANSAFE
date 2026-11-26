import { Router } from 'express';

import { isMailConfigured, mailRecipient, sendMail } from '../services/mailer.js';
import { contactMessage } from '../services/mailTemplates.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;
const MAX_SUBJECT = 120;
const MAX_MESSAGE = 4000;

/* ------------------------------------------------------------------
   A small rate limit, so the form cannot be used to flood a mailbox.
   ------------------------------------------------------------------ */
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 5;
const hits = new Map();

function tooManyRequests(key) {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    return false;
  }

  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    const wait = Math.ceil((WINDOW_MS - (now - entry.start)) / 60000);
    return wait;
  }
  return false;
}

// Do not let the map grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.start > WINDOW_MS) hits.delete(key);
  }
}, WINDOW_MS).unref();

/**
 * POST /api/contact
 * Sends a message from the contact form to the Gmail address of the site.
 */
router.post('/', async (req, res) => {
  const body = req.body ?? {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || name.length > MAX_NAME) {
    return res.status(400).json({ ok: false, error: 'Please tell us your name.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (subject.length > MAX_SUBJECT) {
    return res.status(400).json({ ok: false, error: 'That subject is too long.' });
  }
  if (!message || message.length > MAX_MESSAGE) {
    return res.status(400).json({ ok: false, error: 'Please write a message.' });
  }

  const wait = tooManyRequests(req.ip ?? 'unknown');
  if (wait) {
    return res
      .status(429)
      .json({ ok: false, error: `Too many messages. Please try again in ${wait} minute(s).` });
  }

  const mail = contactMessage({ name, email, subject: subject || 'Message from the site', message });

  try {
    await sendMail({
      to: mailRecipient(),
      replyTo: email, // so you can answer straight from the email
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      kind: 'contact',
    });
  } catch (err) {
    if (err.code === 'MAIL_NOT_CONFIGURED') {
      return res.status(503).json({ ok: false, error: 'Email is not set up on the server yet.' });
    }
    console.error('Could not send the email:', err.message);
    return res.status(502).json({ ok: false, error: 'We could not send your message. Please try again later.' });
  }

  res.json({ ok: true, message: 'Thank you! Your message is on its way.' });
});

export default router;
