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
 * A hosted database works the same way - Neon, Supabase and Railway all hand
 * you a URL like that, you paste it in, and the encryption it asks for is
 * taken care of (see sslSetting below).
 *
 * The PGHOST / PGPORT / ... variables are used when there is no DATABASE_URL.
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

/** Where the database is. Returns null when there is no DATABASE_URL. */
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;

  try {
    const url = new URL(raw);
    // The sslmode is read here and then taken out of the URL, for the reason
    // written under sslSetting() below.
    const sslmode = url.searchParams.get('sslmode');
    url.searchParams.delete('sslmode');
    return { url, sslmode };
  } catch {
    return null; // a broken URL is handled as "no URL", the PG* settings apply
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * True when the server has been told where the database is.
 *
 * Without this the pool would quietly try localhost, which on a deployed site
 * is never the database, and the error would say nothing useful.
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.PGHOST);
}

/**
 * Whether the connection is encrypted, and how much of the certificate to
 * check.
 *
 * Hosted databases - Neon, Supabase, Railway, Render - need it. Their URL
 * ends with "?sslmode=require", which in PostgreSQL means "encrypt the
 * connection, but do not check the certificate", so that is what is asked
 * for here.
 *
 * The setting has to be given to node-postgres on its own. It reads the URL
 * too, and would put its own reading of sslmode over this one, which is why
 * the parameter is removed from the URL in databaseUrl().
 *
 * DATABASE_SSL=true or =false is there for a database that needs the other
 * answer, and always wins.
 */
function sslSetting(target) {
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DATABASE_SSL === 'false') return false;

  const mode = target?.sslmode;
  if (mode === 'disable') return false;
  if (mode === 'verify-full') return true; // check the certificate properly
  if (mode) return { rejectUnauthorized: false }; // "require" and friends

  // No sslmode in the URL: a database on this machine needs no encryption,
  // and one anywhere else almost always does.
  const host = target?.url.hostname ?? process.env.PGHOST ?? 'localhost';
  return LOCAL_HOSTS.has(host) ? false : { rejectUnauthorized: false };
}

function getPool() {
  if (!pool) {
    const target = databaseUrl();

    const config = {
      connectionString: target ? target.url.toString() : undefined,
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'bayansafe',
      user: process.env.PGUSER || 'bayansafe',
      password: process.env.PGPASSWORD || 'bayansafe',
      // A deployed site (Vercel) starts a new pool in every function instance,
      // and a small hosted database only allows a handful of connections in
      // total. The default is kept low for that reason; PGPOOL_MAX can raise
      // it when the database has room to spare.
      max: Number(process.env.PGPOOL_MAX) || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT) || 5000,
      ssl: sslSetting(target),
    };

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
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message:
        'DATABASE_URL is not set on the server, so there is no database to talk to.',
    };
  }

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
