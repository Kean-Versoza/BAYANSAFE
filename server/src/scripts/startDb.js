/**
 * Starts the local PostgreSQL server.
 *
 *   npm run db:start --workspace server
 *
 * Useful when PostgreSQL is installed but not running as a Windows service.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const PORT = Number(process.env.PGPORT) || 5432;

/** Is something already listening on the port? */
function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** Finds the PostgreSQL installation on this computer. */
function findPostgres() {
  const base = 'C:\\Program Files\\PostgreSQL';
  if (!fs.existsSync(base)) return null;

  const versions = fs
    .readdirSync(base)
    .filter((name) => /^\d+$/.test(name))
    .sort((a, b) => Number(b) - Number(a));

  for (const version of versions) {
    const bin = path.join(base, version, 'bin');
    const data = path.join(base, version, 'data');
    if (fs.existsSync(path.join(bin, 'pg_ctl.exe')) && fs.existsSync(data)) {
      return { bin, data, version };
    }
  }
  return null;
}

if (await isListening(PORT)) {
  console.log(`PostgreSQL is already running on port ${PORT}.`);
  process.exit(0);
}

const pg = findPostgres();

if (!pg) {
  console.log('No PostgreSQL installation was found in C:\\Program Files\\PostgreSQL.');
  console.log('');
  console.log('You can also use Docker:  docker compose up -d');
  console.log('Or a hosted database:    put its URL in DATABASE_URL in server/.env');
  process.exit(1);
}

console.log(`Starting PostgreSQL ${pg.version}...`);

try {
  // No -l flag: PostgreSQL already writes its own log files in the data
  // folder, and pointing pg_ctl at the same file makes it wait 30 seconds
  // on a "sharing violation".
  execFileSync(path.join(pg.bin, 'pg_ctl.exe'), ['-D', pg.data, 'start'], { stdio: 'ignore' });
} catch {
  console.log('PostgreSQL could not be started. Have a look at the log in the data folder.');
  process.exit(1);
}

// Give it a moment to open the port
const deadline = Date.now() + 20000;
while (Date.now() < deadline) {
  if (await isListening(PORT)) {
    console.log(`PostgreSQL is running on port ${PORT}.`);
    console.log('Run "npm run db:setup --workspace server" if the tables are missing.');
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 500));
}

console.log('PostgreSQL was started, but it is not answering on the port yet.');
console.log('Have a look at the log files in the data folder:');
console.log(`  ${path.join(pg.data, 'log')}`);
process.exit(1);
