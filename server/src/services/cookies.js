/**
 * The cookies of the site.
 *
 * The admin cookie and the cookie of a player are both handled here, so the
 * way a cookie is read and written is the same everywhere.
 */

/** Reads the cookies out of a request. */
export function readCookies(header = '') {
  const jar = {};
  for (const part of String(header).split(';')) {
    const piece = part.trim();
    if (!piece) continue;
    const at = piece.indexOf('=');
    if (at < 0) continue;
    try {
      jar[piece.slice(0, at)] = decodeURIComponent(piece.slice(at + 1));
    } catch {
      jar[piece.slice(0, at)] = piece.slice(at + 1);
    }
  }
  return jar;
}

/** Puts a cookie in the response. */
export function setCookie(res, name, value, { maxAge }) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
    path: '/',
  });
}

/** Removes a cookie. */
export function clearCookie(res, name) {
  res.clearCookie(name, { path: '/' });
}
