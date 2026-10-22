/**
 * Copies the data of one database into another.
 *
 *   npm run db:push
 *
 * It is meant for moving the players and the email log from the database on
 * this computer to the database the deployed site uses:
 *
 *   SOURCE_DATABASE_URL  where the data is read from
 *                        (default: DATABASE_URL, which .env points at localhost)
 *   TARGET_DATABASE_URL  where the data is written to
 *                        (also read from HOSTED_DATABASE_URL)
 *
 * The target tables are emptied first, so running it twice is safe and the
 * target always ends up an exact copy. The schema is not touched: run
 * "npm run db:setup" against the target once, before the first copy.
 *
 * Nothing here depends on the PostgreSQL version of either side. The rows are
 * read and written as ordinary SQL, so a 16 can feed an 18 and the other way
 * round.
 */
import '../env.js';

import pg from 'pg';

const { Pool } = pg;

/** The tables to copy, in the order that satisfies the foreign keys. */
const TABLES = ['users', 'user_sessions', 'email_log'];

const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL ?? process.env.HOSTED_DATABASE_URL;

if (!sourceUrl) {
  console.log('No source database.');
  console.log('Put DATABASE_URL in .env, or set SOURCE_DATABASE_URL.');
  process.exit(1);
}

if (!targetUrl) {
  console.log('No target database.');
  console.log('Set TARGET_DATABASE_URL (or HOSTED_DATABASE_URL) to the database of the deployed site.');
  console.log('');
  console.log('  vercel env pull .env.local     # writes DATABASE_URL of the project');
  console.log('  $env:TARGET_DATABASE_URL = "postgresql://..."   # PowerShell');
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.log('The source and the target are the same database. Nothing to do.');
  process.exit(1);
}

/** A pool that works the same for a local server and a hosted one. */
function pool(connectionString) {
  // The .env file says DATABASE_SSL=false because the database on this
  // computer does not encrypt. That must not be handed to a hosted database,
  // which does require it, so the decision is made from the host instead.
  const host = new URL(connectionString).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  return new Pool({
    connectionString,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 1,
  });
}

/** Only the name of the server, never the password. */
function describe(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}/${parsed.pathname.slice(1) || 'postgres'}`;
  } catch {
    return '(a database URL that does not parse)';
  }
}

/** One row as a list of values, so it can be inserted again. */
function valuesOf(row, columns) {
  return columns.map((column) => row[column]);
}

const source = pool(sourceUrl);
const target = pool(targetUrl);

console.log(`From: ${describe(sourceUrl)}`);
console.log(`To:   ${describe(targetUrl)}`);
console.log('');

try {
  for (const table of TABLES) {
    // Read everything. These tables are small: every player, every sign in and
    // every email. If that ever stops being true, add a LIMIT and a loop.
    const { rows } = await source.query(`SELECT * FROM ${table}`);
    const columns = rows.length ? Object.keys(rows[0]) : [];

    const client = await target.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);

      if (rows.length) {
        // Build "($1, $2, ...), ($3, $4, ...)" so one statement writes the lot.
        const placeholders = rows.map((_, row) => {
          const base = row * columns.length;
          return `(${columns.map((_, i) => `$${base + i + 1}`).join(', ')})`;
        });

        const flat = rows.flatMap((row) => valuesOf(row, columns));
        await client.query(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,
          flat,
        );

        // A BIGSERIAL keeps its position in a sequence, which the rows above do
        // not move. Without this the next email would reuse an id.
        const serial = columns.includes('id') ? `pg_get_serial_sequence('${table}', 'id')` : null;
        if (serial) {
          await client.query(
            `SELECT setval(${serial}, COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`,
          ).catch(() => {
            /* the column is a UUID, there is no sequence */
          });
        }
      }

      await client.query('COMMIT');
      console.log(`${table.padEnd(14)} ${rows.length} row(s) copied`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Copying ${table} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log('');
  console.log('Done. The target database now holds the same rows.');
} catch (err) {
  console.log('');
  console.log('The copy did not finish.');
  console.log(err.message);
  process.exitCode = 1;
} finally {
  await source.end().catch(() => {});
  await target.end().catch(() => {});
}
