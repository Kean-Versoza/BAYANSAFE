import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { paintFormContents } from '../lib/skeleton.js';

/**
 * The registration card.
 *
 * The big yellow button opens the form, and the form briefly shows a
 * skeleton while it appears. The account is then created on the Node.js
 * server, which stores the password as a salted hash.
 */
export default function RegistrationForm({ tagline, formLoaderMs = 700 }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

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

      // Say what happened with the welcome email, so the player knows to look
      const note = body.emailSent
        ? ' We sent a welcome email to your address.'
        : body.emailNote
          ? ` ${body.emailNote}`
          : '';

      setStatus({ type: 'ok', text: (body.message ?? 'Your account is ready.') + note });
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

        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? 'SAVING...' : 'SUBMIT'}
        </button>

        {status && <p className={`form-status form-status--${status.type}`}>{status.text}</p>}

        {loading && <div ref={overlayRef} className="form-skeleton" aria-hidden="true" />}
      </form>

      <p className="tagline">{tagline}</p>
    </div>
  );
}
