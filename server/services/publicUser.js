/**
 * The account as the player may see it.
 *
 * The password never leaves the server, so every route that answers with an
 * account uses this file. It keeps the shape the same for the account page
 * and for the Google sign in.
 */

/**
 * The player number of an account. It never changes, so it can be written
 * on a paper and still mean the same thing tomorrow.
 */
export function playerNumber(id) {
  return `BS-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

/** The public shape of one account, or null when there is no account. */
export function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    number: playerNumber(user.id),
    username: user.username,
    email: user.email,
    card: user.rfid_uid ?? null,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at ?? null,
  };
}

export default publicUser;
