/**
 * Vercel Function: the API 404.
 *
 * Vercel gives the filesystem precedence over rewrites, so real endpoints
 * (`/api/footer`, ...) are matched by their own function. Anything else under
 * `/api/` is caught by the rewrite in `vercel.json` and lands here, which keeps
 * the Express behaviour of answering unknown API paths with JSON instead of
 * falling through to the SPA's index.html.
 */
export default function handler(req, res) {
  res.status(404).json({ ok: false, errors: ['Endpoint not found.'] });
}
