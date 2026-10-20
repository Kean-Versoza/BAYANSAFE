/**
 * Sets the database up.
 *
 *   npm run db:setup --workspace server
 *
 * It creates the database when it is missing and then applies the migrations.
 */
import pg from 'pg';

import { checkDatabase, closeDatabase } from '../db/pool.js';
import { migrate } from '../db/migrate.js';

const { Pool } = pg;

const targetDatabase = process.env.PGDATABASE || 'bayansafe';

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
    await admin.query(`CREATE DATABASE "${targetDatabase}"`);
    console.log(`Created the database "${targetDatabase}".`);
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
  console.log('  - start PostgreSQL:   docker compose up -d');
  console.log('  - check DATABASE_URL in server/.env');
  console.log(`  - check that PostgreSQL runs on ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}`);
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
