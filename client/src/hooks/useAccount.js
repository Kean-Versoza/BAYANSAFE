import { useCallback, useEffect, useState } from 'react';

/** A small helper for the API calls of the account page. */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A reply that is not JSON means the request never reached the API - the
    // development server was not running, for example - so the status is said
    // out loud instead of a sentence that explains nothing.
    const error = new Error(
      body.error ??
        (res.status >= 500
          ? `The server could not answer (HTTP ${res.status}). Check that the API is running.`
          : `The request failed (HTTP ${res.status}).`),
    );
    error.status = res.status;
    throw error;
  }
  return body;
}

/**
 * The account of the player that is signed in.
 *
 * The cookie of the sign in is httpOnly, so the page cannot read it. Every
 * change asks the server, and the server answers with the account.
 */
export function useAccount() {
  const [user, setUser] = useState(null);
  const [known, setKnown] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api('/api/account/session');
      setUser(data.signedIn ? data.user : null);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setKnown(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Signs a player in. */
  const signIn = useCallback(async (email, password) => {
    setBusy(true);
    try {
      // If using admin credentials on the account page, sign in to the admin panel instead
      try {
        const adminRes = await fetch('/api/admin/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: String(email || '').trim(), password }),
        });
        if (adminRes.ok) {
          window.location.href = '/admin';
          return {};
        }
      } catch {
        // Fall through to normal account login
      }

      const data = await api('/api/account/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      setKnown(true);
      return data;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Signs the player out. */
  const signOut = useCallback(async () => {
    await api('/api/account/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  /** Changes the name and the email. */
  const saveDetails = useCallback(async (details) => {
    const data = await api('/api/account', {
      method: 'PATCH',
      body: JSON.stringify(details),
    });
    setUser(data.user);
    return data;
  }, []);

  /** Sets a new password. */
  const savePassword = useCallback(async (currentPassword, newPassword) => {
    const data = await api('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return data;
  }, []);

  /** Links a card to the account, or takes the card away. */
  const saveCard = useCallback(async (card) => {
    const data = await api('/api/account/card', {
      method: 'POST',
      body: JSON.stringify({ card }),
    });
    setUser(data.user);
    return data;
  }, []);

  /** Removes the account. */
  const removeAccount = useCallback(async (password) => {
    const data = await api('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    setUser(null);
    return data;
  }, []);

  return {
    user,
    known,
    busy,
    signedIn: Boolean(user),
    refresh,
    signIn,
    signOut,
    saveDetails,
    savePassword,
    saveCard,
    removeAccount,
  };
}

export default useAccount;
