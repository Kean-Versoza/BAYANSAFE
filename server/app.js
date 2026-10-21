import express from 'express';

import footerConfig from './footerConfig.js';
import siteConfig from './siteConfig.js';
import registerRoutes from './routes/register.js';
import accountRoutes from './routes/account.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import mailRoutes from './routes/mail.js';

/**
 * The whole API of the site, as one Express app.
 *
 * It is used in two places:
 *
 *   - server/index.js listens on a port with it and also serves the built
 *     React site, which is what `npm run dev` and `npm start` use;
 *   - api/index.js is the single Vercel Function, which runs these very
 *     same routes on the deployed site.
 *
 * Keeping it in one place is the point: an endpoint added here works locally
 * and on Vercel at the same time, and the two can no longer drift apart.
 *
 * Every route below talks to PostgreSQL. When the database is not running
 * they answer 503 and the rest of the site keeps working.
 */
export function createApiApp() {
  const app = express();

  // On a deployed site the requests come through a proxy (Vercel), so the
  // address of the proxy would be the address of every visitor. One hop of
  // trust is what it takes to read the real address of the visitor from the
  // X-Forwarded-For header, which is what the rate limiters use.
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  // Accounts: sign in, the account page, the RFID card, the password
  app.use('/api/account', accountRoutes);

  // The dashboard behind /admin
  app.use('/api/admin', adminRoutes);

  // The "Send us a message" form in the footer
  app.use('/api/contact', contactRoutes);

  // Email status, used to tell the visitor when email is not set up
  app.use('/api/mail', mailRoutes);

  // Registration with an account, a card and the welcome email
  app.use('/api/register', registerRoutes);

  // Unknown API routes must never fall through to the SPA shell
  app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint not found.' });
  });

  /**
   * Something went wrong. The answer is JSON, not the HTML page Express would
   * send on its own, because the front end always reads JSON. On Vercel a
   * handled error also keeps the function healthy instead of leaving it in a
   * broken state.
   */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('The request could not be answered:', err);
    if (res.headersSent) return;
    res.status(500).json({ ok: false, error: 'Something went wrong on the server.' });
  });

  return app;
}

export default createApiApp;
