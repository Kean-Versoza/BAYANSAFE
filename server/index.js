import './env.js'; // must come first, so the settings are there for the rest

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { createApiApp } from './app.js';
import { closeDatabase } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

const app = express();

// Simple request log so `npm run dev` shows what the client is asking for
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });
  next();
});

// Every endpoint of the site. On Vercel the same app runs from api/index.js.
app.use(createApiApp());

/* =========================== STATIC FRONTEND ============================ */

const distDir = path.join(__dirname, '..', 'client', 'dist');

if (IS_PRODUCTION) {
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));

    // React Router owns every other GET path
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(distDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  } else {
    console.warn(`! No build found at ${distDir}. Run "npm run build" first.`);
    app.get('*', (req, res) => {
      res.status(503).send('Frontend has not been built yet. Run: npm run build');
    });
  }
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send(
      'BAYANSAFE API is running on port ' + PORT + '\n' +
        'Open the Vite dev server (see its URL, usually http://localhost:5173) for the site.\n' +
        'Run "npm run build" then "npm start" to serve the built site from this server.'
    );
  });
}

/* ================================ START ================================= */

const server = app.listen(PORT, () => {
  console.log(`BAYANSAFE server listening on http://localhost:${PORT}`);
  console.log(`Mode: ${IS_PRODUCTION ? 'production (serving client/dist)' : 'development (API only)'}`);
});

/**
 * Close the database pool on the way out, so `npm run dev` restarts cleanly.
 * Nothing here waits for PostgreSQL, so the server still stops right away
 * when the database was never reachable.
 */
function shutDown(signal) {
  console.log(`\n${signal} received: closing down.`);
  server.close(() => {
    Promise.resolve(closeDatabase())
      .catch(() => {})
      .finally(() => process.exit(0));
  });
  // A hanging connection must not keep the process alive
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutDown('SIGINT'));
process.on('SIGTERM', () => shutDown('SIGTERM'));
