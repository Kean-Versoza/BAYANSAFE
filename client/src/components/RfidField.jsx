import { useEffect } from 'react';

import { useRfidReader } from '../hooks/useRfidReader';

const STATUS_TEXT = {
  idle: 'NOT SCANNING',
  listening: 'READY TO SCAN',
  connecting: 'CONNECTING...',
  connected: 'READER CONNECTED',
  error: 'PROBLEM',
};

/**
 * The RFID card field.
 *
 * The number can be read with a reader (a USB one that works like a keyboard,
 * or a serial one that the browser is allowed to open) or typed by hand.
 * The number that was read is handed to the caller with onChange.
 */
export default function RfidField({ value, onChange, onScan, taken = false, enabled = true }) {
  const { uid, scans, status, message, canSerial, connected, connectSerial, disconnect, clear } =
    useRfidReader({ enabled, onScan });

  // A card that was read goes straight into the form
  useEffect(() => {
    if (uid) onChange(uid);
  }, [uid, scans, onChange]);

  const onKeyDown = (event) => {
    // The Enter key of a reader should not send the form
    if (event.key === 'Enter') event.preventDefault();
  };

  // A number that was typed by hand is checked when the field is left
  const onBlur = () => {
    if (value) onScan?.(value);
  };

  const empty = () => {
    clear();
    onChange('');
  };

  return (
    <div className={`rfid-field${taken ? ' is-taken' : ''}`}>
      <div className="rfid-head">
        <span className="rfid-label">RFID CARD / ID</span>
        <span className={`rfid-status rfid-status--${status}`}>{STATUS_TEXT[status] ?? ''}</span>
      </div>

      <div className="rfid-row">
        <input
          type="text"
          name="rfid"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder="Scan or type the card"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          data-rfid-input="true"
          className={value ? 'is-read' : ''}
        />
        {value && (
          <button type="button" className="rfid-clear" onClick={empty} aria-label="Clear the card number">
            x
          </button>
        )}
      </div>

      <div className="rfid-foot">
        <p className="rfid-message">{taken ? 'This card is already registered.' : message}</p>

        {canSerial && enabled && (
          connected ? (
            <button type="button" className="rfid-link" onClick={disconnect}>
              Disconnect the reader
            </button>
          ) : (
            <button type="button" className="rfid-link" onClick={connectSerial}>
              Connect a reader
            </button>
          )
        )}
      </div>
    </div>
  );
}
