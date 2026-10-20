import { Router } from 'express';

import {
  checkConnection,
  isMailConfigured,
  mailRecipient,
  provider,
  providerName,
  sendMail,
} from '../services/mailer.js';
import { describeError } from '../db/pool.js';

const router = Router();

/**
 * GET /api/mail/status
 * Tells the front end whether email is set up, so it can say something useful.
 */
router.get('/status', async (req, res) => {
  const result = await checkConnection();
  res.json({
    configured: isMailConfigured(),
    provider: providerName,
    providerLabel: provider.label,
    recipient: isMailConfigured() ? mailRecipient() : null,
    ...result,
  });
});

/**
 * POST /api/mail/test
 * Sends a test email to the site's own inbox, so you can check
 * that the settings are right.
 */
router.post('/test', async (req, res) => {
  if (!isMailConfigured()) {
    return res.status(503).json({
      ok: false,
      error: `${provider.label} is not set up yet.`,
      help: provider.help,
    });
  }

  try {
    await sendMail({
      to: mailRecipient(),
      subject: 'BayanSafe - the email setup works',
      kind: 'test',
      text: [
        'This is a test email from BayanSafe.',
        '',
        'If you are reading it, the email settings are correct and the site can send email.',
        '',
        'The BayanSafe team',
      ].join('\n'),
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1a1a2e;">
          <h2 style="margin:0 0 12px;color:#3b2410;">The email setup works</h2>
          <p style="margin:0 0 12px;">This is a test email from BayanSafe.</p>
          <p style="margin:0 0 12px;">If you are reading it, the Gmail settings are correct and the site can send email.</p>
          <p style="margin:0;color:#6b5a4a;">The BayanSafe team</p>
        </div>`,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: `Gmail refused the message: ${describeError(err)}`,
    });
  }

  res.json({
    ok: true,
    message: `A test email was sent to ${mailRecipient()}. Check your inbox.`,
  });
});

export default router;
