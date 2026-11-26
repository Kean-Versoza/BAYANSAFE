import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * RFID card enrollment for quick sign-in inside the game.
 *
 * Guided, session-based flow driven by the ESP32 + RC522 reader and the
 * Node backend:
 *
 *   idle (not registered) -> scanning -> detected -> confirm -> success
 *
 * The card is only saved to the account after the player confirms.
 */
export default function RfidEnrollment({ user, onEnrolled }) {
  const [userCard, setUserCard] = useState(user?.card ?? null);
  const [phase, setPhase] = useState('idle'); // idle | registered | scanning | detected | success | cancelled | expired | alreadyRegistered | readerUnavailable | error
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [detectedCard, setDetectedCard] = useState('');
  const [session, setSession] = useState(null);
  const [replacing, setReplacing] = useState(false);
  const [readerConnected, setReaderConnected] = useState(false);
  const pollRef = useRef(null);
  const esRef = useRef(null);

  const masked = (card) => {
    if (!card) return '';
    const visible = card.slice(-4);
    return '*'.repeat(Math.max(0, card.length - 4)) + visible;
  };

  const clearError = useCallback(() => setError(null), []);

  const api = useCallback(async (path, options = {}) => {
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
  }, []);

  // Keep in sync with the account coming from the server.
  useEffect(() => {
    setUserCard(user?.card ?? null);
    if (user?.card) {
      setPhase((p) => (p === 'idle' || p === 'success' ? 'registered' : p));
    } else if (phase === 'registered') {
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const closeSse = useCallback(() => {
    if (esRef.current) {
      try {
        esRef.current.close();
      } catch {
        /* ignore */
      }
      esRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const data = await api('/api/account/rfid/enroll/status');
      const s = data.session;
      setSession(s);
      if (!s) {
        stopPolling();
        setPhase((p) => {
          if (p === 'scanning' || p === 'detected') {
            setError('Enrollment session expired. Try again.');
            return 'expired';
          }
          return p;
        });
        return;
      }
      if (s.status === 'expired') {
        stopPolling();
        setPhase('expired');
        setError('Enrollment session expired. Try again.');
        return;
      }
      if (s.status === 'cancelled') {
        stopPolling();
        setPhase('cancelled');
        setError('Enrollment was cancelled.');
        return;
      }
      if (s.status === 'completed') {
        stopPolling();
        return;
      }
      if (s.status === 'detected' && (phase === 'scanning')) {
        stopPolling();
        setDetectedCard(s.card_uid ?? '');
        setPhase('detected');
      }
    } catch {
      // Ignore transient poll errors; keep waiting.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, phase, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(pollStatus, 2000);
    pollStatus();
  }, [pollStatus, stopPolling]);

  // Open the SSE bridge while scanning so a card tapped on the ESP32 reaches us.
  useEffect(() => {
    if (phase !== 'scanning') {
      closeSse();
      return undefined;
    }

    let es;
    try {
      es = new EventSource('/api/rfid/stream');
      esRef.current = es;
    } catch {
      setPhase('readerUnavailable');
      setError('The card reader is not available.');
      return undefined;
    }

    const onReady = () => setReaderConnected(true);
    const onScan = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.uid) {
          // Record the scan against the active session for this user.
          (async () => {
            try {
              const result = await api('/api/account/rfid/enroll/detect', {
                method: 'POST',
                body: JSON.stringify({ uid: data.uid }),
              });
              setDetectedCard(result.card || data.uid);
              setPhase('detected');
              stopPolling();
            } catch (err) {
              if (err.status === 409) {
                setPhase('alreadyRegistered');
                setError(err.message || 'That card is already registered to another account.');
              } else if (err.status === 410) {
                setPhase('expired');
                setError(err.message || 'Enrollment session expired.');
              } else {
                setPhase('error');
                setError(err.message || 'Could not record the scan.');
              }
              stopPolling();
            }
          })();
        }
      } catch {
        /* ignore malformed events */
      }
    };
    const onError = () => {
      setReaderConnected(false);
      // Only treat as unavailable if we never received a ready event.
      if (!readerConnected) {
        // Keep scanning; SSE auto-retries. Mark unavailable after a grace period.
      }
    };

    es.addEventListener('ready', onReady);
    es.addEventListener('scan', onScan);
    es.addEventListener('error', onError);

    return () => {
      es.removeEventListener('ready', onReady);
      es.removeEventListener('scan', onScan);
      es.removeEventListener('error', onError);
      try {
        es.close();
      } catch {
        /* ignore */
      }
      if (esRef.current === es) esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, api, stopPolling, closeSse]);

  const startEnrollment = async () => {
    setError(null);
    setBusy(true);
    setDetectedCard('');
    setSession(null);
    try {
      const data = await api('/api/account/rfid/enroll/start', { method: 'POST' });
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

  const cancelEnrollment = async () => {
    stopPolling();
    closeSse();
    setError(null);
    setBusy(true);
    try {
      await api('/api/account/rfid/enroll/cancel', { method: 'POST' });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
    setSession(null);
    setDetectedCard('');
    if (replacing || userCard) {
      setReplacing(false);
      setPhase('registered');
    } else {
      setPhase('cancelled');
    }
  };

  const confirmEnrollment = async () => {
    if (busy || !session) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api('/api/account/rfid/enroll/confirm', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id }),
      });
      setPhase('success');
      setUserCard(data.user?.card ?? detectedCard);
      setReplacing(false);
      if (typeof onEnrolled === 'function') {
        try {
          await onEnrolled(data.user);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      if (err.status === 409) {
        setPhase('alreadyRegistered');
      } else if (err.status === 410) {
        setPhase('expired');
      } else {
        setPhase('error');
      }
      setError(err.message || 'Could not register the card.');
    } finally {
      setBusy(false);
    }
  };

  const replaceCard = async () => {
    setReplacing(true);
    setError(null);
    setBusy(true);
    try {
      await api('/api/account/rfid/enroll/cancel', { method: 'POST' });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
    setDetectedCard('');
    setSession(null);
    await startEnrollment();
  };

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
      await res.json();
      setUserCard(null);
      setPhase('idle');
      setReplacing(false);
    } catch (err) {
      setError(err.message || 'Could not remove the card.');
    } finally {
      setBusy(false);
    }
  };

  const done = () => {
    stopPolling();
    closeSse();
    setPhase('registered');
    setSession(null);
    setDetectedCard('');
    setError(null);
  };

  const retry = () => {
    setError(null);
    setPhase(userCard ? 'registered' : 'idle');
  };

  useEffect(() => () => {
    stopPolling();
    closeSse();
  }, [stopPolling, closeSse]);

  const statusText =
    phase === 'registered'
      ? 'Active'
      : phase === 'scanning'
        ? 'Waiting for card...'
        : phase === 'detected'
          ? 'Card detected'
          : phase === 'success'
            ? 'Active'
            : phase === 'alreadyRegistered'
              ? 'Already registered'
              : phase === 'expired'
                ? 'Expired'
                : phase === 'cancelled'
                  ? 'Cancelled'
                  : phase === 'readerUnavailable'
                    ? 'Reader unavailable'
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
          <div
            className="account-actions"
            style={{ cursor: 'pointer' }}
            onClick={startEnrollment}
            role="button"
            tabIndex={0}
          >
            <button
              type="button"
              className="btn-submit"
              onClick={(e) => {
                e.stopPropagation();
                startEnrollment();
              }}
              disabled={busy}
            >
              {busy ? 'STARTING...' : 'Register RFID Card'}
            </button>
          </div>
          {error && <p className="form-status form-status--error">{error}</p>}
        </>
      )}

      {phase === 'idle' && !userCard && busy && (
        <p className="account-hint">Starting enrollment...</p>
      )}

      {/* ---------- registered ---------- */}
      {isRegistered && phase !== 'scanning' && phase !== 'detected' && phase !== 'success' && phase !== 'cancelled' && phase !== 'expired' && phase !== 'alreadyRegistered' && phase !== 'readerUnavailable' && phase !== 'error' && (
        <>
          <p className="account-hint" style={{ fontWeight: 700 }}>RFID Card Registered</p>
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
          {error && <p className="form-status form-status--error">{error}</p>}
        </>
      )}

      {/* ---------- scanning ---------- */}
      {phase === 'scanning' && (
        <>
          <h3 style={{ margin: '0.5rem 0' }}>Scan Your RFID Card</h3>
          <p className="account-hint">Place your RFID card near the ESP32 reader.</p>
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
          {error && <p className="form-status form-status--error">{error}</p>}
        </>
      )}

      {/* ---------- detected ---------- */}
      {phase === 'detected' && (
        <>
          <h3 style={{ margin: '0.5rem 0' }}>Card Detected</h3>
          <p className="account-hint">Your RFID card has been detected.</p>
          <p className="account-hint">
            Detected card: <span style={{ fontFamily: 'monospace', letterSpacing: '0.12em' }}>{masked(detectedCard)}</span>
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
          {error && <p className="form-status form-status--error">{error}</p>}
        </>
      )}

      {/* ---------- success ---------- */}
      {phase === 'success' && (
        <>
          <h3 style={{ margin: '0.5rem 0' }}>RFID Card Registered Successfully</h3>
          <p className="account-hint">
            Status: <span style={{ fontWeight: 700, color: '#1a7a1a' }}>Active</span>
          </p>
          <p className="account-hint">Your RFID card is now linked to your account.</p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={done} disabled={busy}>
              Done
            </button>
          </div>
        </>
      )}

      {/* ---------- cancelled ---------- */}
      {phase === 'cancelled' && (
        <>
          <p className="account-hint">Enrollment cancelled.</p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={retry}>
              Try again
            </button>
          </div>
        </>
      )}

      {/* ---------- expired ---------- */}
      {phase === 'expired' && (
        <>
          <p className="account-hint">Enrollment expired. Try again.</p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={() => { setError(null); setPhase(userCard ? 'registered' : 'idle'); }}>
              Try again
            </button>
          </div>
        </>
      )}

      {/* ---------- already registered ---------- */}
      {phase === 'alreadyRegistered' && (
        <>
          <p className="form-status form-status--error">{error || 'That card is already registered to another account.'}</p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={() => { setError(null); setPhase(userCard ? 'registered' : 'idle'); }}>
              Try again
            </button>
          </div>
        </>
      )}

      {/* ---------- reader unavailable ---------- */}
      {phase === 'readerUnavailable' && (
        <>
          <p className="form-status form-status--error">Reader unavailable. Check the ESP32 connection.</p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={() => { setError(null); setPhase(userCard ? 'registered' : 'idle'); }}>
              Try again
            </button>
          </div>
        </>
      )}

      {/* ---------- generic error ---------- */}
      {phase === 'error' && (
        <>
          <p className="form-status form-status--error">{error || 'Something went wrong.'}</p>
          <div className="account-actions">
            <button type="button" className="btn-submit" onClick={() => { setError(null); setPhase(userCard ? 'registered' : 'idle'); }}>
              Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}