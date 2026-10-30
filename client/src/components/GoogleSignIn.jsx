import { useEffect, useRef, useState } from 'react';

import { useSiteConfig } from '../hooks/useSiteConfig.js';

/**
 * "Continue with Google".
 *
 * The button is drawn by Google Identity Services (GIS). The browser gets an
 * ID token from Google and this component hands the token to `onCredential`;
 * the page then posts it to `/api/auth/google`, which checks it on the server.
 *
 * The Client ID comes from `GET /api/config` (it is public by design), so the
 * same build works locally and on Vercel. While the setting is missing the
 * button is shown disabled with a short note instead of failing silently.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// The script is loaded once for the whole page, however many buttons appear.
let scriptPromise = null;

function loadGoogleIdentity() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In needs a browser.'));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('Google Sign-In did not start.'));
    };
    script.onerror = () => reject(new Error('Google Sign-In could not be loaded.'));
    document.head.appendChild(script);
  }).catch((err) => {
    scriptPromise = null; // a later mount may try again
    throw err;
  });

  return scriptPromise;
}

/** The four-colour "G" used while Google sign-in is not configured. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function GoogleSignIn({
  onCredential,
  text = 'continue_with',
  disabled = false,
  className = '',
}) {
  const config = useSiteConfig();
  const clientId = config.googleClientId || null;
  const holderRef = useRef(null);
  const credentialRef = useRef(onCredential);
  const [error, setError] = useState('');

  // Always call the newest handler without re-initialising Google.
  credentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;

    let cancelled = false;

    const handleResponse = (response) => {
      if (!response?.credential) {
        setError('Google did not return a sign-in token. Please try again.');
        return;
      }
      setError('');
      credentialRef.current?.(response.credential);
    };

    loadGoogleIdentity()
      .then((identity) => {
        if (cancelled || !holderRef.current) return;

        identity.initialize({
          client_id: clientId,
          callback: handleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
        });

        const holder = holderRef.current;
        holder.replaceChildren();

        // A hidden form measures 0, so a sensible width is used instead.
        const measured = holder.clientWidth || 0;
        const width = Math.min(340, Math.max(220, Math.round(measured || 300)));

        identity.renderButton(holder, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Google Sign-In could not be loaded. Check your connection and try again.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) {
    return (
      <div className={`google-signin ${className}`.trim()}>
        <button type="button" className="google-signin__fallback" disabled>
          <GoogleMark />
          <span>Continue with Google</span>
        </button>
        <p className="google-signin__note">
          Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID on the server to turn it on.
        </p>
      </div>
    );
  }

  return (
    <div className={`google-signin ${className}`.trim()}>
      <div
        ref={holderRef}
        className={`google-signin__slot${disabled ? ' is-disabled' : ''}`}
        aria-busy={disabled ? 'true' : undefined}
      />
      {error && <p className="google-signin__note google-signin__note--error">{error}</p>}
    </div>
  );
}
