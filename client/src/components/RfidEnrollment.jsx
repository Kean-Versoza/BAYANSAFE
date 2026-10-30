import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * RFID card enrollment for quick sign-in inside the game.
 *
 * Replaces the old "type or scan a card" field with a guided, session-based
 * flow driven by the ESP32 + RC522 reader and the Node backend:
 *
 *   idle (not registered) -> scanning -> detected -> confirm -> success
 *
 * The card is only saved to the account after the player confirms.
 */
export default function RfidEnrollment({ user }) {
  const [userCard, setUserCard] = useState(user?.card ?? null);
  const [phase, setPhase] = useState('idle'); // idle | registered | scanning | detected | confirming | success | error
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detectedCard, setDetectedCard] = useState('');
  const [session, setSession] = useState(null);
  const [retryAfter, setRetryAfter] = useState(null);
  const pollRef = useRef(null);

  const masked = (card) => {
    if (!card) return '';
    const visible = card.slice(-4);
    return '*'.repeat(Math.max(0, card.length - 4)) + visible;
  };

  const clearError = useCallback(() => setError(null), []);

  /* ---------------------------------------------------------------- api */
  const api = useCallback(
    async (path, options = {}) => {
      const res = await fetch(path, {
        credentials: 'same-origin',
        ...options,
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error ?? 'The request failed.');
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    },
    [],
  );

  /* ---------------------------------------------------------------- load */
  useEffect(() => {
    setUserCard(user?.card ?? null);
    if (user?.card) {
      setPhase('registered');
    } else {
      setPhase('idle');
    }
  }, [user]);

  /* ---------------------------------------------------------------- start */
  const startEnrollment = async () => {
    setError(null);
    setBusy(true);
    try {
      const data = await api('/api/account/rfid/enroll/start', {
        method: 'POST',
      });
      setSession(data.session);
      setPhase('scanning');
      startPolling();
    } catch (err) {
      setError(err.message || 'Could not start enrollment.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- polling */
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(pollStatus, 2000);
    pollStatus();
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollStatus = async () => {
    try {
      const data = await api('/api/account/rfid/enroll/status');
      const s = data.session;
      setSession(s);
      if (!s) {
        // Session gone: expired/cancelled/completed server-side.
        stopPolling();
        if (phase === 'scanning') {
          setPhase('error');
          setError('Enrollment session expired. Try again.');
        } else if (phase === 'detected') {
          setPhase('error');
          setError('Enrollment session expired before confirmation. Try again.');
        }
        return;
      }
      if (s.status === 'detected' && phase === 'scanning') {
        stopPolling();
        setDetectedCard(s.card_uid ?? '');
        setPhase('detected');
      }
    } catch {
      // Ignore transient poll errors; keep waiting.
    }
  };

  /* ---------------------------------------------------------------- cancel */
  const cancelEnrollment = async () => {
    stopPolling();
    setError(null);
    setBusy(true);
    try {
      await api('/api/account/rfid/enroll/cancel', { method: 'POST' });
      setPhase('idle');
      setSession(null);
      setDetectedCard('');
    } catch (err) {
      setError(err.message || 'Could not cancel enrollment.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- confirm */
  const confirmEnrollment = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api('/api/account/rfid/enroll/confirm', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id }),
      });
      setPhase('success');
      setUserCard(data.user?.card ?? detectedCard);
    } catch (err) {
      setPhase('error');
      setError(err.message || 'Could not register the card.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- replace */
  const replaceCard = async () => {
    setError(null);
    setBusy(true);
    try {
      await api('/api/account/rfid/enroll/cancel', { method: 'POST' });
      setUserCard(null);
      setPhase('idle');
      startEnrollment();
    } catch (err) {
      setError(err.message || 'Could not start replacement.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- remove */
  const removeCard = async () => {
    if (!window.confirm('Remove your RFID card from this account?')) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/account/card', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card: '' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not remove the card.');
      }
      const data = await res.json();
      setUserCard(null);
      setPhase('idle');
    } catch (err) {
      setError(err.message || 'Could not remove the card.');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------------------------- done */
  const done = () => {
    stopPolling();
    setPhase('registered');
    setSession(null);
    setDetectedCard('');
    setError(null);
  };

  useEffect(() => () => stopPolling(), []);

  /* ---------------------------------------------------------------- render */
  const statusText =
    phase === 'registered'
      ? 'Active'
      : phase === 'scanning'
        ? 'Waiting for card...'
        : phase === 'detected'
          ? 'Card detected'
          : phase === 'success'
            ? 'Active'
            : 'Not registered';

  const isRegistered = phase === 'registered' || (phase === 'idle' && userCard);

  return (
    <section className="account-section account-section--card">
      <h2>RFID CARD / ID</h2>
      <p className="account-hint">
        Register your RFID card for quick sign-in to the game.
      </p>

      {/* ---------- default / not registered ---------- */}
      {phase === 'idle' && !userCard && !busy && (
        <>
          <p className="account-hint">
            Status: <span style={{ fontWeight: 700, color: '#8a1c1c' }}>Not registered</span>
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="btn-submit"
              onClick={startEnrollment}
              disabled={busy}
            >
              {busy ? 'STARTING...' : 'Register RFID Card'}
            </button>
          </div>
          {error && (
            <p className={`form-status form-status--error`}>{error}</p>
          )}
        </>
      )}

      {/* ---------- registered ---------- */}
      {isRegistered && phase !== 'scanning' && phase !== 'detected' && phase !== 'success' && (
        <>
          <p className="account-hint">
            Status: <span style={{ fontWeight: 700, color: '#1a7a1a' }}>Active</span>
          </p>
          <p className="account-hint">
            Registered card: <span style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }}>{masked(userCard)}</span>
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="account-link"
              onClick={replaceCard}
              disabled={busy}
            >
              {busy ? 'REPLACING...' : 'Replace Card'}
            </button>
            <button
              type="button"
              className="account-link"
              onClick={removeCard}
              disabled={busy}
            >
              {busy ? 'REMOVING...' : 'Remove Card'}
            </button>
          </div>
          {error && (
            <p className={`form-status form-status--error`}>{error}</p>
          )}
        </>
      )}

      {/* ---------- scanning ---------- */}
      {phase === 'scanning' && (
        <>
          <p className="account-hint">Status: Waiting for card...</p>
          <div className="account-actions">
            <button
              type="button"
              className="btn-submit"
              onClick={cancelEnrollment}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className={`form-status form-status--error`}>{error}</p>
          )}
        </>
      )}

      {/* ---------- detected ---------- */}
      {phase === 'detected' && (
        <>
          <p className="account-hint">Status: Card detected</p>
          <p className="account-hint">
            Detected card:
            <span style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }}>{masked(detectedCard)}</span>
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="btn-submit"
              onClick={confirmEnrollment}
              disabled={busy}
            >
              {busy ? 'SAVING...' : 'Confirm Enrollment'}
            </button>
            <button
              type="button"
              className="account-link"
              onClick={cancelEnrollment}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className={`form-status form-status--error`}>{error}</p>
          )}
        </>
      )}

      {/* ---------- success ---------- */}
      {phase === 'success' && (
        <>
          <p className="account-hint">
            Status: <span style={{ fontWeight: 700, color: '#1a7a1a' }}>Active</span>
          </p>
          <p className="account-hint">
            Your RFID card is now linked to your account.
          </p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={done} disabled={busy}>
              Done
            </button>
          </div>
        </>
      )}
    </section>
  );
}