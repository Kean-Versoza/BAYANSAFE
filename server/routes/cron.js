import { Router } from 'express';

import { query, checkDatabase } from '../db/pool.js';
import { describeError } from '../db/pool.js';
import { isMailConfigured, mailRecipient, sendMail } from '../services/mailer.js';

const router = Router();

/**
 * GET /api/cron/check-db
 *
 * A daily job (see vercel.json) that pings the database. Supabase's free
 * tier pauses a project after a week without activity, so this ping also
 * keeps it awake. When the database cannot be reached the admin is emailed
 * so the pause (or any other outage) is noticed quickly.
 *
 * The request is authenticated with the CRON_SECRET environment variable:
 * Vercel Cron sends it as "Authorization: Bearer <secret>". A manual call
 * can pass it as ?secret=... for testing.
 */
router.get('/check-db', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.secret;

  if (!secret || provided !== secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }

  const db = await checkDatabase();

  // A real query, so the connection is actually exercised (and Supabase is
  // woken up if it was paused).
  let queryOk = db.ok;
  if (db.ok) {
    try {
      await query('SELECT 1');
    } catch (err) {
      queryOk = false;
      db.ok = false;
      db.message = describeError(err);
    }
  }

  if (queryOk) {
    return res.json({ ok: true, database: db, alerted: false });
  }

  // Database is down: tell the admin by email. Gmail does not need the
  // database, so this still works while Supabase is paused.
  let alerted = false;
  if (isMailConfigured()) {
    try {
      await sendMail({
        to: mailRecipient(),
        subject: 'BayanSafe: the database is unreachable',
        text: [
          'The daily database check could not reach PostgreSQL.',
          '',
          `Reason: ${db.message}`,
          '',
          'If you are using Supabase on the free tier, the project has most',
          'likely been paused after a week without activity. Open the Supabase',
          'dashboard and click "Restore project" (or run any query) to wake it',
          'up; the site will work again within a few seconds.',
          '',
          'This message is sent once per day by the scheduled check.',
        ].join('\n'),
        kind: 'alert',
      });
      alerted = true;
    } catch (err) {
      console.error('Could not send the database alert:', err.message);
    }
  }

  return res.status(503).json({ ok: false, database: db, alerted });
});

export default router;
