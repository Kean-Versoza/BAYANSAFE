import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

import { query } from '../db/pool.js';

/**
 * Copies the messages in the admin Gmail inbox into `contact_messages`.
 *
 * The footer's "Contact us" link opens Gmail, so those messages never pass
 * through the site form. Reading them with IMAP (the same app password the
 * mailer already uses) lets the dashboard show them next to the messages
 * that came from the form.
 *
 * The sync is read-only: nothing is marked as read or deleted in Gmail.
 * Gmail's message id is kept as `external_id`, so a message is stored once
 * even if the sync runs again.
 */

const HOST = 'imap.gmail.com';
const PORT = 993;

/** How many messages to look at in one run. Keeps the serverless call short. */
const MAX_PER_SYNC = 25;

/** Messages older than this are ignored on the first run. */
const FIRST_RUN_DAYS = 30;

/** A second visit to the dashboard within this window reuses the last sync. */
const COOLDOWN_MS = 60 * 1000;

const LAST_UID_KEY = 'gmail_last_uid';
const LAST_SYNC_KEY = 'gmail_last_sync';

/** True when the Gmail mailbox can be read with the settings that are there. */
export function isInboxConfigured() {
  const provider = (process.env.MAIL_PROVIDER || 'gmail').toLowerCase();
  return (
    provider === 'gmail' &&
    Boolean(process.env.GMAIL_USER) &&
    Boolean(process.env.GMAIL_APP_PASSWORD)
  );
}

async function readState(key) {
  const { rows } = await query('SELECT value FROM app_state WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function writeState(key, value) {
  await query(
    `INSERT INTO app_state (key, value, updated_at)
          VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)],
  );
}

/**
 * Automatic mail (bounces, "do not reply" notices) is not a message from a
 * visitor, so it stays out of the dashboard.
 */
const AUTOMATED_SENDER = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i;

/** A name to show in the dashboard: the sender's, or their address. */
function senderOf(parsed) {
  const from = parsed.from?.value?.[0];
  const address = (from?.address || '').trim();
  const name = (from?.name || '').trim();
  return { name: name || address || 'Unknown sender', address };
}

/** The body as plain text, with a fallback when the email is HTML only. */
function bodyOf(parsed) {
  const text = (parsed.text || '').trim();
  if (text) return text;

  const html = String(parsed.html || '');
  if (!html) return '(This message has no text.)';

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() || '(This message has no text.)';
}

/**
 * Runs the sync.
 *
 * `force` ignores the short cooldown, which the "Sync now" button uses.
 */
export async function syncInbox({ force = false } = {}) {
  if (!isInboxConfigured()) {
    return {
      ok: false,
      configured: false,
      added: 0,
      message: 'Gmail is not set up on the server, so the inbox cannot be read.',
    };
  }

  if (!force) {
    const lastSync = await readState(LAST_SYNC_KEY);
    if (lastSync && Date.now() - new Date(lastSync).getTime() < COOLDOWN_MS) {
      return {
        ok: true,
        configured: true,
        skipped: true,
        added: 0,
        message: 'The inbox was checked a moment ago.',
        lastSync,
      };
    }
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const lastUid = Number(await readState(LAST_UID_KEY)) || 0;

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();

  let scanned = 0;
  let added = 0;
  let highestUid = lastUid;

  try {
    const lock = await client.getMailboxLock('INBOX');

    try {
      let uids;
      if (lastUid > 0) {
        // Everything newer than the last message we stored.
        uids = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        uids = uids.filter((uid) => uid > lastUid);
      } else {
        const since = new Date(Date.now() - FIRST_RUN_DAYS * 24 * 60 * 60 * 1000);
        uids = await client.search({ since }, { uid: true });
      }

      uids = uids.slice(-MAX_PER_SYNC);

      if (uids.length) {
        highestUid = Math.max(lastUid, ...uids);
        scanned = uids.length;

        for await (const message of client.fetch(
          uids,
          { uid: true, source: true, envelope: true, internalDate: true },
          { uid: true },
        )) {
          const parsed = await simpleParser(message.source);
          const { name, address } = senderOf(parsed);

          // Our own notification emails are already in the dashboard, and
          // emails from the admin address are not visitor messages.
          const own = [user, process.env.MAIL_FROM, process.env.MAIL_TO]
            .filter(Boolean)
            .map((value) => value.toLowerCase().replace(/^.*<|>$/g, '').trim());
          if (!address || own.includes(address.toLowerCase())) continue;
          if (AUTOMATED_SENDER.test(address)) continue;

          const externalId = parsed.messageId || `gmail-uid-${message.uid}`;
          const subject = (parsed.subject || '').trim() || '(no subject)';
          const sentAt = parsed.date || message.internalDate || new Date();

          const { rowCount } = await query(
            `INSERT INTO contact_messages
               (name, email, subject, message, source, is_read, created_at, external_id)
             VALUES ($1, $2, $3, $4, 'gmail', FALSE, $5, $6)
             ON CONFLICT (external_id) DO NOTHING`,
            [name, address, subject, bodyOf(parsed).slice(0, 8000), sentAt, externalId],
          );

          added += rowCount;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  if (highestUid > lastUid) await writeState(LAST_UID_KEY, highestUid);

  const now = new Date().toISOString();
  await writeState(LAST_SYNC_KEY, now);

  return {
    ok: true,
    configured: true,
    skipped: false,
    scanned,
    added,
    lastSync: now,
    message:
      added > 0
        ? `${added} new message${added === 1 ? '' : 's'} from Gmail.`
        : 'No new messages in the Gmail inbox.',
  };
}
