import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { paintFormContents } from '../lib/skeleton.js';
import RfidField from './RfidField.jsx';

/**
 * The registration card.
 *
 * The big yellow button opens the form, and the form briefly shows a
 * skeleton while it appears. The account is then created on the Node.js
 * server, which stores the password as a salted hash.
 *
 * After the account is created, the player is automatically signed in and
 * can enrol an RFID card for quick sign-in afterwards.
 */
export default function RegistrationForm({ tagline, formLoaderMs = 700 }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  // RFID enrollment state (shown after registration succeeds)
  const [registered, setRegistered] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [rfid, setRfid] = useState('');
  const [enrollState, setEnrollState] = useState('ready');
  const [cardTaken, setCardTaken] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState(null);
  const [pin, setPin] = useState('');

  const formRef = useRef(null);
  const overlayRef = useRef(null);
  const timerRef = useRef(null);
  const wasLoading = useRef(false);

  // 1. The landing button opens the registration card
  const openForm = () => {
    setOpen(true);
    if (!formLoaderMs) return;

    setLoading(true);
    timerRef.current = setTimeout(() => setLoading(false), formLoaderMs);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // 2. Draw the skeleton over the form while it is loading
  useLayoutEffect(() => {
    if (!loading) return;
    const form = formRef.current;
    const overlay = overlayRef.current;
    if (!form || !overlay) return;

    const rect = form.getBoundingClientRect();
    overlay.style.left = `${-form.clientLeft}px`;
    overlay.style.top = `${-form.clientTop}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.borderRadius = getComputedStyle(form).borderRadius;
    paintFormContents(overlay, { x: rect.left, y: rect.top }, form);
  }, [loading]);

  // The form is visible again, so the first field can take the focus
  useEffect(() => {
    if (wasLoading.current && !loading) {
      formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }
    wasLoading.current = loading;
  }, [loading]);

  // Initialize Google Sign-In button
  useEffect(() => {
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
    });

    const btn = document.getElementById('google-register-btn');
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
    setStatus(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      const body = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', text: body.error ?? 'Google sign in failed.' });
        return;
      }

      // Google sign in creates/signs in the account; show RFID enrollment
      setRegistered(true);
      setRegisteredUser(body.user ?? null);
      setStatus({ type: 'ok', text: body.message ?? 'Welcome!' });
    } catch {
      setStatus({ type: 'error', text: 'We could not reach the server. Please try again.' });
    } finally {
      setGoogleBusy(false);
    }
  };

  // A card was read during enrollment: auto-link it to the new account.
  const handleEnrollScan = useCallback(async (card) => {
    setRfid(card);
    setCardTaken(false);
    setEnrollMessage(null);
    setEnrollState('detected');

    try {
      const res = await fetch('/api/account/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setCardTaken(true);
          setEnrollState('taken');
          setEnrollMessage({
            type: 'error',
            text: '⚠️ This card is already registered to another account. If this is a mistake, please contact support.',
          });
        } else {
          setEnrollState('ready');
          setEnrollMessage({ type: 'error', text: body.error ?? 'Could not link the card.' });
        }
        return;
      }

      // Optionally set a PIN for quick sign-in.
      if (pin && pin.length >= 4) {
        const pinRes = await fetch('/api/account/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const pinBody = await pinRes.json().catch(() => ({}));
        if (!pinRes.ok) {
          setEnrollMessage({
            type: 'error',
            text: `Card linked, but PIN could not be set: ${pinBody.error ?? 'unknown error'}`,
          });
          setEnrollState('linked');
          return;
        }
      }

      setEnrollState('linked');
      setEnrollMessage({
        type: 'ok',
        text: '✅ Card successfully scanned! Linking to your account...',
      });
    } catch {
      setEnrollState('ready');
      setEnrollMessage({ type: 'error', text: 'We could not reach the server. Please try again.' });
    }
  }, [pin]);

  // 3. Create the account on the server
  const onSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      username: String(data.get('username') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      password: String(data.get('password') ?? ''),
      acceptedTerms: data.get('terms') === 'on',
    };

    setStatus(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({ type: 'error', text: body.error ?? 'We could not create your account.' });
        return;
      }

      // Registration succeeded: show RFID enrollment step
      setRegistered(true);
      setRegisteredUser(body.user ?? null);
      const note = body.emailSent
        ? ' We sent a welcome email to your address.'
        : body.emailNote
          ? ` ${body.emailNote}`
          : '';
      const player = body.user?.playerNumber ? ` Your player id is ${body.user.playerNumber}.` : '';
      setStatus({
        type: 'ok',
        text: (body.message ?? 'Your account is ready.') + note + player,
      });
      form.reset();
      setShowPassword(false);
    } catch {
      setStatus({ type: 'error', text: 'We could not reach the server. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="register-page">
      {!open && (
        <button type="button" id="openFormBtn" className="btn-yellow main-trigger" onClick={openForm}>
          REGISTER NOW
        </button>
      )}

      {registered ? (
        // ---- Registration successful: RFID enrollment step ----
        <div className="reg-form" ref={formRef}>
          <p className="form-title">REGISTRATION SUCCESSFUL</p>

          {status && <p className={`form-status form-status--${status.type}`}>{status.text}</p>}

          {/* RFID card enrollment */}
          <section className="account-section account-section--rfid">
            <h2>ENROL RFID CARD</h2>
            <p className="account-hint">
              Tap your RFID card to link it to your new account
              {registeredUser?.email ? ` (${registeredUser.email})` : ''}. You can then use it for quick sign in.
              You can also skip this and enrol the card later on your account page.
            </p>

            {registeredUser?.email && (
              <p className="account-hint">
                The card UID will be paired with this account and its email for quick sign in.
              </p>
            )}

            <p className="account-hint">
              💡 Instructions: Hold your RFID card flat against the center of the reader module until it beeps or lights up.
            </p>

            <RfidField
              value={rfid}
              onChange={setRfid}
              onScan={handleEnrollScan}
              taken={cardTaken}
              enabled
              allowManual={false}
              badgeLabel={
                enrollState === 'detected'
                  ? 'CARD DETECTED'
                  : enrollState === 'taken'
                  ? 'ALREADY LINKED'
                  : 'READY TO SCAN'
              }
              badgeTone={
                enrollState === 'detected'
                  ? 'success'
                  : enrollState === 'taken'
                  ? 'error'
                  : 'ready'
              }
              messageOverride={
                enrollState === 'detected'
                  ? '✅ Card successfully scanned! Linking to your account...'
                  : enrollState === 'taken'
                  ? '⚠️ This card is already registered to another account. If this is a mistake, please contact support.'
                  : 'Waiting for card scan...'
              }
            />

            {enrollState === 'taken' && (
              <button
                type="button"
                className="account-link"
                onClick={() => {
                  setEnrollState('ready');
                  setCardTaken(false);
                  setRfid('');
                  setEnrollMessage(null);
                }}
              >
                Try Another Card
              </button>
            )}

            {enrollMessage && (
              <p className={`form-status form-status--${enrollMessage.type}`}>{enrollMessage.text}</p>
            )}

            {/* PIN setup for RFID quick sign-in */}
            <label className="account-field">
              <span>SET PIN FOR QUICK SIGN-IN (OPTIONAL)</span>
              <input
                type="password"
                name="pin"
                placeholder="4-6 digit PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                maxLength={6}
              />
              <small className="account-hint">A PIN protects your account when using RFID quick sign-in.</small>
            </label>

            <div className="account-actions">
              <button
                type="button"
                className="account-link"
                onClick={() => {
                  setRfid('');
                  setCardTaken(false);
                  setEnrollMessage(null);
                  setEnrollState('ready');
                }}
              >
                Skip for now
              </button>
            </div>
          </section>

          <p className="account-foot">
            You can now <Link to="/account">sign in to your account</Link> or use your RFID card for quick sign in.
          </p>
        </div>
      ) : (
        // ---- Registration form ----
        <form
          id="regCardForm"
          ref={formRef}
          className={`reg-form${open ? '' : ' hidden-form'}${loading ? ' is-loading' : ''}`}
          onSubmit={onSubmit}
        >
          <p className="form-title">CREATE ACCOUNT</p>

          <input type="text" name="username" placeholder="Username" required autoComplete="username" />
          <input type="email" name="email" placeholder="Email Address" required autoComplete="email" />

          {/* Password field with the eye that shows the password */}
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              placeholder="Password"
              required
              autoComplete="new-password"
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
                <path d="M8 13c-1.01 0-1.932-.18-2.761-.471l1.712-1.713c.322.12.67.184 1.031.184c1.65 0 3-1.35 3-3c0-.362-.064-.71-.183-1.031l2.285-2.285a11.7 11.7 0 0 1 2.729 2.736a.99.99 0 0 1 0 1.16C15.084 9.62 12.37 13 8 13m1.039-7.807l1.722-1.722A8.3 8.3 0 0 0 8 3C3.63 3 .916 6.38.187 7.42a.99.99 0 0 0 0 1.16c.382.544 1.307 1.73 2.729 2.736l2.26-2.26A3 3 0 0 1 4.982 8c0-1.65 1.35-3 3-3c.372 0 .728.068 1.057.193m-7.185 9.661a.5.5 0 0 1-.708-.708l13-13a.5.5 0 0 1 .708.708zM7.78 9.988A2 2 0 0 0 9.988 7.78zm.44-3.976A2 2 0 0 0 6.012 8.22z" />
              </svg>
            </button>
          </div>

          <label className="terms">
            <input type="checkbox" name="terms" required /> I agree to the safety terms
          </label>

          {/* Google Sign In */}
          <section className="account-section account-section--google">
            <h2>OR CONTINUE WITH GOOGLE</h2>
            <div id="google-register-btn" />
          </section>

          <button type="submit" className="btn-submit" disabled={submitting || googleBusy}>
            {submitting ? 'SAVING...' : googleBusy ? 'SIGNING IN...' : 'SUBMIT'}
          </button>

          {status && <p className={`form-status form-status--${status.type}`}>{status.text}</p>}

          {loading && <div ref={overlayRef} className="form-skeleton" aria-hidden="true" />}
        </form>
      )}

      <p className="tagline">{tagline}</p>
    </div>
  );
}
