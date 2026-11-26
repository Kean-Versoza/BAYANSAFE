import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

/**
 * The page the desktop game opens when the player chooses "Sign in with Google"
 * or "Sign in on the website". It lives on the website's own origin, so the
 * existing Google button and account cookies work exactly as they do elsewhere.
 *
 * Once the player is signed in, the short code from the game is completed and
 * the game picks up the session on its next poll.
 */
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

export default function GameLoginPage() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim().toUpperCase();
  const googleRef = useRef(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const finish = async () => {
    await api('/api/client/device/complete', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setDone(true);
  };

  const onPasswordSignIn = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (!code) throw new Error('No sign-in code was supplied. Launch this page from the game.');
      await api('/api/account/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      await finish();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (done || !code || typeof window === 'undefined' || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setError('');
        setBusy(true);
        try {
          await api('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ token: response.credential }),
          });
          await finish();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      },
    });

    if (googleRef.current) {
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: 'signin_with',
        logo_alignment: 'left',
      });
    }
  }, [code, done]);

  return (
    <div className="register-page account-page">
      <div className="reg-form account-card account-card--signin">
        <p className="form-title">SIGN IN TO BAYANSAFE</p>

        {done ? (
          <>
            <p className="account-lead">You are signed in.</p>
            <p className="form-status form-status--ok">
              Return to the game - it will continue automatically. You can close this window.
            </p>
          </>
        ) : (
          <>
            <p className="account-lead">
              Sign in with your BayanSafe account to bring your progress into the game.
            </p>

            <p className="account-lead">
              Sign-in code: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }}>{code || 'MISSING'}</strong>
            </p>

            <form onSubmit={onPasswordSignIn}>
              <input
                type="text"
                name="username"
                placeholder="Username or Email"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />

              {error && <p className="form-status form-status--error">{error}</p>}

              <button type="submit" className="btn-submit" disabled={busy || !code}>
                {busy ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </form>

            <section className="account-section account-section--google">
              <h2>OR CONTINUE WITH GOOGLE</h2>
              <div ref={googleRef} id="game-google-btn" />
            </section>
          </>
        )}

        <p className="account-foot">
          No account yet? <Link to={{ pathname: '/', hash: '#registration' }}>Register here</Link>.
        </p>
      </div>
    </div>
  );
}
