import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * The sign in card of the account page.
 *
 * The same card as the registration form, so the page looks like the rest of
 * the site. It offers the email and password form and Google sign in.
 */
export default function AccountSignIn({ onSignIn, busy }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await onSignIn(username.trim(), password);
    } catch (err) {
      setError(err.message);
    }
  };

  // Initialize Google Sign-In button
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
    });

    const btn = document.getElementById('google-signin-btn');
    if (btn) {
      window.google.accounts.id.renderButton(btn, {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: 'signin_with',
        logo_alignment: 'left',
      });
    }
  }, []);

  /** Handles the Google credential response. */
  const handleGoogleSignIn = async (credentialResponse) => {
    setGoogleBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Google sign in failed.');
        return;
      }

      // Redirect to account page after successful Google sign in
      window.location.href = '/account';
    } catch {
      setError('We could not reach the server. Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="register-page account-page">
      <div className="reg-form account-card account-card--signin">
        <p className="form-title">MY ACCOUNT</p>
        <p className="account-lead">Sign in to see your account, your card and your settings.</p>

        <form onSubmit={onSubmit}>
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

          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className={`toggle-password-eye${showPassword ? ' is-visible' : ''}`}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              <svg className="icon-eye" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 9a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5a5 5 0 0 1 5-5a5 5 0 0 1 5 5a5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5" />
              </svg>

              <svg className="icon-eye-off" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 13c-1.01 0-1.932-.18-2.761-.471l1.712-1.713c.322.12.67.184 1.031.184c1.65 0 3-1.35 3-3c0-.362-.064-.71-.183-1.031l2.285-2.285a11.7 11.7 0 0 1 2.729 2.736a.99.99 0 0 1 0 1.16C15.084 9.62 12.37 13 8 13m1.039-7.807l1.722-1.722A8.3 8.3 0 0 0 8 3C3.63 3 .916 6.38.187 7.42a.99.99 0 0 0 0 1.16c.382.544 1.307 1.73 2.729 2.736l2.26-2.26A3 3 0 0 0 4.982 8c0-1.65 1.35-3 3-3c.372 0 .728.068 1.057.193m-7.185 9.661a.5.5 0 0 1-.708-.708l13-13a.5.5 0 0 1 .708.708zM7.78 9.988A2 2 0 0 0 9.988 7.78zm.44-3.976A2 2 0 0 0 6.012 8.22z" />
              </svg>
            </button>
          </div>

          {error && <p className="form-status form-status--error">{error}</p>}

          <button type="submit" className="btn-submit" disabled={busy}>
            {busy ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          {/* Google Sign In */}
          <section className="account-section account-section--google">
            <h2>OR CONTINUE WITH GOOGLE</h2>
            <div id="google-signin-btn" />
          </section>
        </form>

        <p className="account-foot">
          No account yet? <Link to={{ pathname: '/', hash: '#registration' }}>Register here</Link>.
        </p>
      </div>
    </div>
  );
}