import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import siteConfig from '../../shared/site.config.js';
import registerRoutes from './routes/register.js';
import contactRoutes from './routes/contact.js';
import mailRoutes from './routes/mail.js';
import adminRoutes from './routes/admin.js';
import { checkDatabase, closeDatabase } from './db/pool.js';
import { migrate } from './db/migrate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '16kb' }));

/* ------------------------------------------------------------------
   API
   ------------------------------------------------------------------ */

/** Liveness probe. It also says whether the database answers. */
app.get('/api/health', async (req, res) => {
  const db = await checkDatabase();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ok' : 'degraded',
    uptime: process.uptime(),
    database: { ok: db.ok, message: db.message },
  });
});

/**
 * The site configuration (footer, cookie notice, navigation).
 * Served from the shared file so the client and the server never disagree.
 */
app.get('/api/config', (req, res) => {
  res.json(siteConfig);
});

app.use('/api/register', registerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/admin', adminRoutes);

/* ------------------------------------------------------------------
   The React app
   In production the built client is served from here.
   ------------------------------------------------------------------ */

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Everything that is not an API call is handled by React Router.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res
        .status(404)
        .type('text/plain')
        .send('The client has not been built yet. Run "npm run build" first.');
    }
  });
});

// Unknown API routes should not fall through to the React app.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  // A broken request body (for example invalid JSON) already carries a status.
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ ok: false, error: 'The request could not be read.' });
  }

  console.error(err);
  res.status(500).json({ ok: false, error: 'Something went wrong on our side.' });
});

app.listen(PORT, async () => {
  console.log(`BayanSafe server listening on http://localhost:${PORT}`);

  // The database is checked at startup, so you see the problem right away
  const db = await checkDatabase();
  if (db.ok) {
    console.log(db.message);

    if (process.env.DB_AUTO_MIGRATE !== 'false') {
      try {
        const { applied } = await migrate({ verbose: false });
        console.log(
          applied.length
            ? `Applied ${applied.length} migration(s): ${applied.join(', ')}`
            : 'The database is up to date.',
        );
      } catch (err) {
        console.error(`The tables could not be created: ${err.message}`);
      }
    }
  } else {
    console.warn(`The database is not reachable: ${db.message}`);
    console.warn('Start PostgreSQL and run "npm run db:setup --workspace server".');
    console.warn('The site still works, but new accounts cannot be created.');
  }
});

// Close the database when the server stops
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await closeDatabase().catch(() => {});
    process.exit(0);
  });
}
