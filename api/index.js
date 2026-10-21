import '../server/env.js'; // a local .env is read; on Vercel the variables are already there

import { createApiApp } from '../server/app.js';

/**
 * The whole API, as one Vercel Function.
 *
 * Every /api/... path is rewritten to this file in vercel.json, so the
 * deployed site runs exactly the same Express routes that `npm run dev`
 * runs. Adding a route to server/app.js therefore also adds it on Vercel,
 * with no second copy of the handler to keep in step.
 */
const app = createApiApp();

export default function handler(req, res) {
  // A rewrite can hand the function the path it was rewritten *to* instead of
  // the path the visitor asked for. The routes in server/app.js are written
  // with the /api prefix, so make sure the request still arrives with it.
  const url = typeof req.url === 'string' ? req.url : '/';
  if (!url.startsWith('/api')) {
    req.url = `/api${url.startsWith('/') ? url : `/${url}`}`;
  }

  return app(req, res);
}
