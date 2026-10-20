import { useCallback, useEffect, useRef, useState } from 'react';

import { cleanCardNumber, extractCardNumber } from '@shared/rfid.js';

/* ------------------------------------------------------------------
   The RFID reader
   ------------------------------------------------------------------

   Two kinds of reader are supported, and both of them are common:

   1. A reader that works like a keyboard. It is plugged in with USB and the
      computer sees a keyboard, so the reader simply types the card number
      and presses Enter. This one needs nothing at all: it works in every
      browser, on every computer.

   2. A reader that shows up as a serial port (the little USB ones that say
      "USB Serial" on the sticker). The browser has to be allowed to open
      that port, which only Chrome and Edge can do. The "Connect a reader"
      button asks the browser for it.

   When the reader is not there, the number can still be typed by hand.
   ------------------------------------------------------------------ */

/* A reader types very fast. Anything slower than this is a person typing,
   so those keys are left alone. */
const FAST_TYPING_MS = 70;

/* The shortest thing that can be a card number. */
const MIN_CARD_LENGTH = 4;

/* How long a serial reader may stay quiet before its line is taken as done. */
const SERIAL_IDLE_MS = 160;

/**
 * Watches for a card being read.
 *
 * onScan is called with the card number every time a card is read.
 */
export function useRfidReader({ enabled = true, onScan } = {}) {
  const [uid, setUid] = useState('');
  const [source, setSource] = useState(null);
  const [message, setMessage] = useState('');
  const [canSerial, setCanSerial] = useState(false);
  // Bumped every time a card is read, so the same card twice still counts
  const [scans, setScans] = useState(0);
  // The state of the serial reader
  const [serialOn, setSerialOn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);

  // The keys that were typed since the last card, and when they came
  const bufferRef = useRef({ text: '', at: 0 });
  // The way to let go of the serial port
  const releaseRef = useRef(null);
  // The call that is made when a card is read
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    setCanSerial(typeof navigator !== 'undefined' && 'serial' in navigator);
  }, []);

  /** A card was read. */
  const report = useCallback((card, from) => {
    const clean = cleanCardNumber(card);
    if (clean.length < MIN_CARD_LENGTH) return false;

    setUid(clean);
    setSource(from);
    setScans((count) => count + 1);
    setFailed(false);
    onScanRef.current?.(clean);
    return true;
  }, []);

  /* ------------------------------------------------------------------
     The reader that works like a keyboard
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      // A shortcut is not a card
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const target = event.target;

      // The keys of the other fields are left alone, so a name is never
      // mistaken for a card. The card field itself is watched, because a
      // number that is typed there by hand should be tidied up as well.
      if (target && (target.isContentEditable || target.tagName === 'TEXTAREA')) return;
      if (
        target &&
        target.tagName === 'INPUT' &&
        target.type !== 'button' &&
        target.type !== 'submit' &&
        !target.dataset?.rfidInput
      ) {
        return;
      }

      const buffer = bufferRef.current;
      const now = Date.now();

      if (event.key === 'Enter') {
        const typed = buffer.text;
        buffer.text = '';
        if (typed.length >= MIN_CARD_LENGTH) {
          // The scan must not send the form
          event.preventDefault();
          if (report(typed, 'keyboard')) setMessage('Card read.');
        }
        return;
      }

      // Only the keys that print something
      if (event.key.length !== 1) return;

      // A slow typist is a person, not a reader
      if (now - buffer.at > FAST_TYPING_MS) buffer.text = '';
      buffer.at = now;
      buffer.text += event.key;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, report]);

  /* ------------------------------------------------------------------
     The reader that is plugged in as a serial port
     ------------------------------------------------------------------ */
  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      setFailed(true);
      setMessage('This browser cannot open a serial port. Use Chrome or Edge, or a reader that works like a keyboard.');
      return;
    }

    setConnecting(true);
    setFailed(false);
    setMessage('Waiting for the reader...');

    let port;
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
    } catch (err) {
      setConnecting(false);
      setFailed(true);
      setMessage(
        err?.name === 'NotFoundError'
          ? 'No reader was chosen.'
          : 'The reader could not be opened. Check that it is plugged in.',
      );
      return;
    }

    const decoder = new TextDecoder();
    let leftover = '';
    let idleTimer = null;
    let stopped = false;

    /** Takes the card number out of one line the reader sent. */
    const readLine = (line) => {
      const card = extractCardNumber(line);
      if (!card) return;
      report(card, 'serial');
      setMessage('Card read.');
    };

    const readLoop = async () => {
      const reader = port.readable.getReader();

      releaseRef.current = () => {
        stopped = true;
        if (idleTimer) clearTimeout(idleTimer);
        reader.cancel().catch(() => {});
        port.close().catch(() => {});
      };

      try {
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;

          leftover += decoder.decode(value, { stream: true });

          // The reader ends its lines with a newline
          const lines = leftover.split(/[\r\n]+/);
          leftover = lines.pop() ?? '';
          lines.forEach(readLine);

          // Some readers do not use a newline, so a line that stays quiet
          // for a moment is taken as finished
          if (idleTimer) clearTimeout(idleTimer);
          if (leftover) {
            idleTimer = setTimeout(() => {
              const line = leftover;
              leftover = '';
              readLine(line);
            }, SERIAL_IDLE_MS);
          }
        }
      } catch {
        if (!stopped) {
          setSerialOn(false);
          setFailed(true);
          setMessage('The reader stopped working. Plug it in again.');
        }
      }
    };

    setConnecting(false);
    setSerialOn(true);
    setMessage('Reader connected. Scan a card.');
    readLoop();
  }, [report]);

  /** Lets go of the reader. */
  const disconnect = useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
    setSerialOn(false);
    setFailed(false);
    setMessage('Reader disconnected. You can still type the number.');
  }, []);

  /** Forgets the card that was read. */
  const clear = useCallback(() => {
    setUid('');
    setSource(null);
  }, []);

  // Let go of the reader when the form goes away
  useEffect(() => () => releaseRef.current?.(), []);

  // What the little sign next to the field says
  const status = failed
    ? 'error'
    : connecting
      ? 'connecting'
      : serialOn
        ? 'connected'
        : enabled
          ? 'listening'
          : 'idle';

  return {
    uid,
    scans,
    source,
    status,
    message,
    canSerial,
    connected: serialOn,
    connectSerial,
    disconnect,
    clear,
  };
}

export default useRfidReader;
