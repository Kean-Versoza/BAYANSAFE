/**
 * Checks that the database answers.
 *
 *   npm run db:check
 */
import '../env.js';

import { checkDatabase, closeDatabase } from '../db/pool.js';

const db = await checkDatabase();

if (db.ok) {
  console.log(db.message);
} else {
  console.log('The database is not reachable.');
  console.log(db.message);
  console.log('');
  console.log('Put DATABASE_URL in .env and run "npm run db:setup".');
}

await closeDatabase().catch(() => {});
process.exit(db.ok ? 0 : 1);
