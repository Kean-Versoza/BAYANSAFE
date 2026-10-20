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
    const error = new Error(body.error ?? 'Something went wrong.');
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
