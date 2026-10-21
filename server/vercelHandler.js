/**
 * The Vercel Function.
 *
 * Vercel turns every file in the api/ folder into a function, so there are
 * two of them: index.js for /api and [...path].js for everything under it.
 * Both hand the request to this file, so there is only one copy of the logic.
 *
 * The routes in server/app.js are written with the /api prefix, so the path
 * has to keep it. Vercel hands the function the path the visitor asked for,
 * but a rewrite can hand over the path it was rewritten to instead, so the
 * prefix is put back when it is missing.
 */
import './env.js'; // a local .env is read; on Vercel the variables are already there

import { createApiApp } from './app.js';

const app = createApiApp();

export default function handler(req, res) {
  const url = typeof req.url === 'string' ? req.url : '/';
  if (!url.startsWith('/api')) {
    req.url = `/api${url.startsWith('/') ? url : `/${url}`}`;
  }

  // TEMPORARY DIAGNOSTIC - removed after the routing has been checked
  if (req.url.startsWith('/api/__diag-7f3a91')) {
    res.json({
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      path: req.path,
      headers: req.headers,
    });
    return;
  }

  res.setHeader('x-bayansafe-path', req.url);
  return app(req, res);
}
