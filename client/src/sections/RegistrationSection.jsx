import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import RfidField from '../components/RfidField';
import { FORM_LOADER_MS, paintFormContents } from '../lib/skeleton';

const EMPTY_MESSAGE = { type: '', text: '' };

/** Registration view: the big trigger button and the account card. */
export default function RegistrationSection() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(EMPTY_MESSAGE);
  const [card, setCard] = useState('');
  const [cardTaken, setCardTaken] = useState(false);

  const formRef = useRef(null);
  const overlayRef = useRef(null);
  const wasLoading = useRef(false);

  // Measure the real form and paint the skeleton boxes over it
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

  // The skeleton only lives for FORM_LOADER_MS, then the real form appears
  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => setLoading(false), FORM_LOADER_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  // Focus the first field once the form becomes visible again
  useEffect(() => {
    if (wasLoading.current && !loading) {
      formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }
    wasLoading.current = loading;
  }, [loading]);

  const openForm = () => {
    setOpen(true);
    setMessage(EMPTY_MESSAGE);
    if (FORM_LOADER_MS > 0) setLoading(true);
  };

  /** A scanned card is checked so the visitor knows before submitting. */
  const checkCard = async (wanted) => {
    const number = String(wanted ?? '').trim();
    if (!number) return;
    try {
      const res = await fetch(`/api/register/rfid/${encodeURIComponent(number)}`);
      const body = await res.json().catch(() => ({}));
      setCardTaken(Boolean(body.taken));
    } catch {
      setCardTaken(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      username: data.get('username') ?? '',
      email: data.get('email') ?? '',
      password: data.get('password') ?? '',
      rfidUid: card,
      acceptedTerms: data.get('terms') === 'on',
      terms: data.get('terms') === 'on',
    };

    setSubmitting(true);
    setMessage(EMPTY_MESSAGE);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.ok) {
        // An account without a card is a full account, so it says so here.
        const withoutCard = !result.user?.rfidUid;
        setMessage({
          type: 'success',
          text: withoutCard
            ? `${result.message} You can add an RFID card later on your account page.`
            : result.message,
        });
        form.reset();
        setCard('');
        setCardTaken(false);
        setShowPassword(false);
      } else {
        const errors = Array.isArray(result.errors)
          ? result.errors
          : [result.error ?? 'Registration failed. Please try again.'];
        setMessage({ type: 'error', text: errors.join(' ') });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach the server. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="registration" className="section frame frame-inner">
      <div className="register-page">
        {!open && (
          <button type="button" id="openFormBtn" className="btn-yellow main-trigger" onClick={openForm}>
            REGISTER NOW
          </button>
        )}

        <form
          className={`reg-form${open ? '' : ' hidden-form'}${loading ? ' is-loading' : ''}`}
          id="regCardForm"
          onSubmit={handleSubmit}
          ref={formRef}
        >
          {loading && <div className="form-skeleton" ref={overlayRef} aria-hidden="true" />}

          <p className="form-title">CREATE ACCOUNT</p>

          <input type="text" name="username" placeholder="Username" autoComplete="username" required />
          <input type="email" name="email" placeholder="Email Address" autoComplete="email" required />

          {/* Password box with eye toggle */}
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              placeholder="Password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="button"
              className={`toggle-password-eye${showPassword ? ' is-visible' : ''}`}
              data-target="password"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
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

          {/* The RFID card. Optional: the account works without one. */}
          <RfidField
            value={card}
            onChange={setCard}
            onScan={checkCard}
            taken={cardTaken}
            optional
            hint="No card with you? Leave this empty and keep registering. You can add a card later on your account page."
          />

          {message.text && (
            <p className={`form-message is-${message.type}`} role="status" aria-live="polite">
              {message.text}
            </p>
          )}

          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'SUBMITTING...' : 'SUBMIT'}
          </button>
        </form>

        <p className="tagline">
          A Philippine Smart Community Disaster Intelligence and Preparedness Response Game
        </p>
      </div>
    </section>
  );
}
