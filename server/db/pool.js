/**
 * The connection to PostgreSQL.
 *
 * The pool is created lazily, on the first query, so the site still starts
 * and serves the pages when PostgreSQL is not running. In that case every
 * query answers with a clear error and the API replies 503.
 *
 * The settings come from the environment, so the password never sits in the
 * code. DATABASE_URL is the usual way to point at a database:
 *
 *   postgresql://user:password@localhost:5432/bayansafe
 *
 * The PGHOST / PGPORT / ... variables are used when there is no DATABASE_URL.
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    const config = {
      connectionString: process.env.DATABASE_URL || undefined,
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'bayansafe',
      user: process.env.PGUSER || 'bayansafe',
      password: process.env.PGPASSWORD || 'bayansafe',
      max: Number(process.env.PGPOOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT) || 5000,
    };

    // Hosted databases (Neon, Supabase, Railway) need SSL
    if (process.env.DATABASE_SSL === 'true') {
      config.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool(config);

    // A broken connection should not take the whole server down
    pool.on('error', (err) => {
      console.error('Unexpected error on the database connection:', err.message);
    });
  }

  return pool;
}

/** Runs one query. */
export function query(text, params) {
  return getPool().query(text, params);
}

/** Takes one connection out of the pool, for work that needs a transaction. */
export function getClient() {
  return getPool().connect();
}

/** Checks that the database answers. */
export async function checkDatabase() {
  try {
    const { rows } = await getPool().query('SELECT NOW() AS now, current_database() AS name');
    return {
      ok: true,
      database: rows[0].name,
      message: `Connected to PostgreSQL database "${rows[0].name}".`,
    };
  } catch (err) {
    return { ok: false, message: describeError(err) };
  }
}

/**
 * A short sentence about a database error.
 * Node reports a refused connection as an AggregateError without a message,
 * so the real reason is picked out of the list it carries.
 */
export function describeError(err) {
  if (err instanceof AggregateError && Array.isArray(err.errors) && err.errors.length) {
    return err.errors.map((e) => e.message).join('; ');
  }
  return err?.message || 'The database could not be reached.';
}

/** Closes the pool when the server stops. */
export function closeDatabase() {
  return pool ? pool.end() : Promise.resolve();
}
