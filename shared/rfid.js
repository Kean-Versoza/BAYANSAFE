/**
 * The RFID card number.
 *
 * The client and the server both use this file, so they always agree on what
 * a card number looks like.
 *
 * A card number is what the reader prints: a short code made of letters and
 * digits. The shape of the code depends on the reader (8 hex characters for
 * an EM4100 card, 10 for a MIFARE, sometimes a plain number), so the rules
 * here are loose on purpose. The database is the one that stops the same card
 * from being used twice.
 */

/** A card number is 4 to 32 letters or digits. */
const CARD_RE = /^[A-Z0-9]{4,32}$/;

/**
 * Tidies up what the reader gave us.
 * Upper case, no spaces, no "0x" in front. Empty when nothing is left.
 */
export function cleanCardNumber(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toUpperCase()
    .replace(/^0X/, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** True when the text can be used as a card number. */
export function isValidCardNumber(value) {
  return CARD_RE.test(cleanCardNumber(value));
}

/**
 * The card number to store, or an empty string when the text is not one.
 *
 * Some readers print the leading zeros of the card and some do not, so they
 * are dropped here. That way the same card gets the same number on every
 * reader.
 */
export function normalizeCardNumber(value) {
  const clean = cleanCardNumber(value);
  if (!CARD_RE.test(clean)) return '';

  const trimmed = clean.replace(/^0+/, '');
  return trimmed.length >= 4 ? trimmed : clean;
}

/**
 * Pulls the card number out of a line the reader sent.
 *
 * Readers say different things: "5A2B3C4D", "+5A2B3C4D", "Card ID: 5A2B3C4D".
 * The card number is the last group of four or more hex characters in the
 * line.
 */
export function extractCardNumber(line) {
  if (typeof line !== 'string') return '';
  const matches = line.toUpperCase().match(/[0-9A-F]{4,}/g);
  if (!matches || !matches.length) return '';
  return normalizeCardNumber(matches[matches.length - 1]);
}
