import footerConfig from '../server/footerConfig.js';

/**
 * Vercel Function: GET /api/footer
 *
 * Reads the very same config file the Express server serves, so the footer text
 * is still edited in one place (`server/footerConfig.js`).
 */
export default function handler(req, res) {
  res.status(200).json(footerConfig);
}
