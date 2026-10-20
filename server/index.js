import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import footerConfig from './footerConfig.js';
import siteConfig from './siteConfig.js';
import { registerAccount } from './register.js';
import registerRoutes from './routes/register.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import mailRoutes from './routes/mail.js';
import { closeDatabase } from './db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

/* ============================== API ROUTES ============================== */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'bayansafe', uptime: process.uptime() });
});

// The whole footer/cookie configuration, so text lives in one place
app.get('/api/footer', (req, res) => {
  res.json(footerConfig);
});

// Navigation, footer and cookie text, shared with the client. The client
// falls back to its bundled copy when this cannot be reached.
app.get('/api/config', (req, res) => {
  res.json(siteConfig);
});

/* ---------------------------------------------------------------
   The features that came from the backend branch.

   Every one of these talks to PostgreSQL. When the database is not
   running they answer 503 and the rest of the site keeps working.
   --------------------------------------------------------------- */

// Accounts: sign in, the account page, the RFID card, the password
app.use('/api/account', accountRoutes);

// The dashboard behind /admin
app.use('/api/admin', adminRoutes);

// The "Send us a message" form in the footer
app.use('/api/contact', contactRoutes);

// Email status, used to tell the visitor when email is not set up
app.use('/api/mail', mailRoutes);

// Registration with an account, a card and the welcome email.
// This replaces the old in-memory handler for the same path.
app.use('/api/register', registerRoutes);

/* --------------------------------------------------------------- */

// Unknown API routes must never fall through to the SPA shell
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, errors: ['Endpoint not found.'] });
});

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
