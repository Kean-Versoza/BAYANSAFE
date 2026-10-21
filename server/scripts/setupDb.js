/**
 * Sets the database up.
 *
 *   npm run db:setup
 *
 * It creates the database when it is missing and then applies the migrations.
 */
import '../env.js';

import pg from 'pg';

import { checkDatabase, closeDatabase } from '../db/pool.js';
import { migrate } from '../db/migrate.js';

const { Pool } = pg;

/**
 * The name of the database the site uses. It comes from the URL when there
 * is one, so a hosted database is never mistaken for a local one.
 */
function targetDatabase() {
  if (process.env.DATABASE_URL) {
    try {
      const name = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
      if (name) return name;
    } catch {
      /* a broken URL is handled as "no URL" below */
    }
  }
  return process.env.PGDATABASE || 'bayansafe';
}

/** A connection to the "postgres" database, which every server has. */
function adminConnection() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/postgres';
    return { connectionString: url.toString() };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'bayansafe',
    password: process.env.PGPASSWORD || 'bayansafe',
    database: 'postgres',
  };
}

/** Creates the database when it does not exist yet. */
async function ensureDatabaseExists() {
  const admin = new Pool(adminConnection());
  try {
    const name = targetDatabase();
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`Created the database "${name}".`);
  } catch (err) {
    // 42P04 = duplicate_database, it was already there, that is fine
    if (err.code !== '42P04') throw err;
  } finally {
    await admin.end();
  }
}

console.log('Checking the database...');

let db = await checkDatabase();

if (!db.ok && db.message.includes('does not exist')) {
  await ensureDatabaseExists();
  db = await checkDatabase();
}

if (!db.ok) {
  console.log('The database is not reachable.');
  console.log(db.message);
  console.log('');
  console.log('Things to try:');
  console.log('  - put DATABASE_URL in .env (that is where Neon, Supabase and Railway tell you to put it)');
  console.log('  - for a database on this machine: start PostgreSQL with "docker compose up -d"');
  console.log(`  - or check that PostgreSQL runs on ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}`);
  await closeDatabase().catch(() => {});
  process.exit(1);
}

console.log(db.message);

const { applied, total } = await migrate();
console.log(
  applied.length
    ? `Applied ${applied.length} of ${total} migration(s).`
    : `The database is up to date (${total} migration(s)).`,
);

console.log('Done.');
await closeDatabase().catch(() => {});
