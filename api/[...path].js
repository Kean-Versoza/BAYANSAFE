import handler from '../server/vercelHandler.js';

/**
 * Every path under /api.
 *
 * The catch-all name is what makes Vercel send /api/health, /api/admin/login
 * and every other API path to this function, with the path the visitor asked
 * for. That keeps the Express routes in server/app.js working exactly as they
 * do locally, without a rewrite in between.
 */
export default handler;
