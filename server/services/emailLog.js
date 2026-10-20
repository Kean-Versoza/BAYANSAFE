import { query } from '../db/pool.js';

/**
 * A note of every email the site sent, so the dashboard can show it.
 *
 * Writing the note must never break the sending of the email itself,
 * so every problem is swallowed.
 */
export async function logEmail({ to, subject = '', kind = 'other', ok = true, error = null }) {
  try {
    await query(
      `INSERT INTO email_log (to_address, subject, kind, ok, error)
            VALUES ($1, $2, $3, $4, $5)`,
      [to, subject, kind, ok, error ? String(error).slice(0, 500) : null],
    );
  } catch {
    /* the database may be down, the email still goes out */
  }
}
