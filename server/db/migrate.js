import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getClient, query } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, 'migrations');

/**
 * Creates the tables.
 *
 * Every file in the migrations folder is applied once, in alphabetical order,
 * and is remembered in the table schema_migrations. Running it again is safe:
 * the files that were already applied are skipped.
 */
export async function migrate({ verbose = true } = {}) {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(migrationsFolder))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const { rows } = await query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((row) => row.name));

  const applied = [];

  for (const file of files) {
    if (done.has(file)) {
      if (verbose) console.log(`  skipped  ${file} (already applied)`);
      continue;
    }

<<<<<<< HEAD
    // A file saved by a Windows editor can start with a BOM (the invisible
    // character U+FEFF). PostgreSQL does not accept it at the start of a
    // statement, so it is taken off here.
    const sql = (await fs.readFile(path.join(migrationsFolder, file), 'utf8')).replace(/^\uFEFF/, '');
=======
    const sql = await fs.readFile(path.join(migrationsFolder, file), 'utf8');
>>>>>>> 0c2b239ee6494135d1db09295d6a81cc8bc39d9d
    const client = await getClient();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
      if (verbose) console.log(`  applied  ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  return { applied, total: files.length };
}
