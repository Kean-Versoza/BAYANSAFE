/**
 * Reads the local .env file.
 *
 * The settings for PostgreSQL, for the admin and for the mail provider live
 * in a .env file, so a password never sits in the code. It is imported first
 * by everything that starts the server or one of the scripts:
 *
 *   import './env.js';
 *
 * A deployed site does not use this file at all. Vercel has its own place for
 * the same variables (Project -> Settings -> Environment Variables), and those
 * are already in the process. Reading the file there finds nothing and does
 * nothing.
 *
 * No package is needed for this. The rules are the ones every .env file
 * follows: a line is KEY=value, blank lines and lines starting with # are
 * ignored, and a value may be wrapped in quotes so it can hold a space or a
 * # without meaning a comment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

/** One line of a .env file, or null when the line holds no setting. */
function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const equals = trimmed.indexOf('=');
  if (equals < 1) return null; // no "key=" on this line

  const key = trimmed.slice(0, equals).trim();
  let value = trimmed.slice(equals + 1).trim();

  if (value.length > 1) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1);
    }
  }

  return { key, value };
}

/**
 * Loads one file. A variable that is already set - in the shell, or by
 * Vercel - is left alone, so the file cannot take over what the machine
 * already decided.
 */
function loadFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return 0; // there is no such file, which is the normal case
  }

  let loaded = 0;
  for (const line of text.split(/\r?\n/)) {
    const entry = parseLine(line);
    if (!entry) continue;
    if (process.env[entry.key] !== undefined) continue;
    process.env[entry.key] = entry.value;
    loaded += 1;
  }
  return loaded;
}

/**
 * Reads the .env file in the project, then the one in server/. The project
 * file comes first, so it wins when both exist.
 */
export function loadEnv() {
  return loadFile(path.join(projectRoot, '.env')) + loadFile(path.join(here, '.env'));
}

// Importing this file is what loads the file, so the import is all it takes.
loadEnv();
