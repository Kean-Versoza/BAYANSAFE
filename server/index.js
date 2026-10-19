import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import footerConfig from './footerConfig.js';
import { createUser } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

const app = express();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Registration. The old Flask form was never wired up; now it really posts.
app.post('/api/register', (req, res) => {
  const { username = '', email = '', password = '', terms } = req.body ?? {};
  const errors = [];

  if (String(username).trim().length < 3) {
    errors.push('Username must be at least 3 characters long.');
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    errors.push('Please enter a valid email address.');
  }
  if (String(password).length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!terms) {
    errors.push('You must agree to the safety terms.');
  }

  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    const account = createUser({ username, email, password });
    return res.status(201).json({
      ok: true,
      message: `Welcome, ${account.username}! Your account has been created.`,
    });
  } catch (err) {
    return res.status(409).json({ ok: false, errors: [err.message] });
  }
});

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

app.listen(PORT, () => {
  console.log(`BAYANSAFE server listening on http://localhost:${PORT}`);
  console.log(`Mode: ${IS_PRODUCTION ? 'production (serving client/dist)' : 'development (API only)'}`);
});
