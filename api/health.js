/**
 * Vercel Function: GET /api/health
 *
 * Same response as the Express route in `server/index.js`.
 */
export default function handler(req, res) {
  res.status(200).json({ ok: true, service: 'bayansafe', uptime: process.uptime() });
}
