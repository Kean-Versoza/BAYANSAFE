import { useEffect, useState } from 'react';

/**
 * A small global toast that pops up whenever an RFID card is scanned.
 * It listens for the 'rfid-scan' window event dispatched by useRfidReader.
 */
export default function Toast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onScan = (event) => {
      const { uid, source } = event.detail || {};
      if (!uid) return;
      setToast({ uid, source: source || 'reader', id: Date.now() });

      // Optional haptic feedback on supported devices.
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(80);
      }

      // Auto-dismiss.
      setTimeout(() => setToast(null), 3000);
    };

    window.addEventListener('rfid-scan', onScan);
    return () => window.removeEventListener('rfid-scan', onScan);
  }, []);

  if (!toast) return null;

  return (
    <div className="rfid-toast" role="status" aria-live="polite">
      <span className="rfid-toast__icon">💳</span>
      <span className="rfid-toast__text">
        Card scanned: <strong>{toast.uid}</strong>
        <small> ({toast.source})</small>
      </span>
    </div>
  );
}