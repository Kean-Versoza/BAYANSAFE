import { registerAccount } from '../server/register.js';

/**
 * Vercel Function: POST /api/register
 *
 * The validation and account creation live in `server/register.js`, shared with
 * the Express server, so this handler is only the HTTP shape around it.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, errors: ['Method not allowed. Use POST.'] });
  }

  const { status, body } = registerAccount(req.body);
  return res.status(status).json(body);
}
