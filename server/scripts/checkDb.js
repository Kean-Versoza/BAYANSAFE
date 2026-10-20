/**
 * Checks that the database answers.
 *
 *   npm run db:check --workspace server
 */
import { checkDatabase, closeDatabase } from '../db/pool.js';

const db = await checkDatabase();

if (db.ok) {
  console.log(db.message);
} else {
  console.log('The database is not reachable.');
  console.log(db.message);
  console.log('');
  console.log('Start PostgreSQL and run "npm run db:setup --workspace server".');
}

await closeDatabase().catch(() => {});
process.exit(db.ok ? 0 : 1);
