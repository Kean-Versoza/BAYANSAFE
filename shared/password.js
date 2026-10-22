/**
 * The password rules.
 *
 * The client and the server both use this file, so the checklist the player
 * sees and the check the server runs can never drift apart.
 *
 * These are the rules for PLAYER passwords (sign up and the account page).
 * The admin password is set in the environment and is deliberately exempt;
 * see server/services/adminAuth.js.
 *
 * A password needs all five things:
 *   - 8 characters or more
 *   - an uppercase letter
 *   - a lowercase letter
 *   - a number
 *   - a special character
 */

/** The longest password accepted, so a huge one cannot slow the server down. */
export const MAX_PASSWORD_LENGTH = 200;

/**
 * The rules in the order they are shown.
 *
 * `label` is what the checklist prints. `phrase` is the same rule written so it
 * fits in a sentence ("your password still needs ..."), which keeps the server
 * message readable without any case juggling.
 */
export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    phrase: 'at least 8 characters',
    test: (password) => [...password].length >= 8,
  },
  {
    id: 'upper',
    label: 'An uppercase letter (A-Z)',
    phrase: 'an uppercase letter',
    test: (password) => /\p{Lu}/u.test(password),
  },
  {
    id: 'lower',
    label: 'A lowercase letter (a-z)',
    phrase: 'a lowercase letter',
    test: (password) => /\p{Ll}/u.test(password),
  },
  {
    id: 'number',
    label: 'A number (0-9)',
    phrase: 'a number',
    test: (password) => /\p{N}/u.test(password),
  },
  {
    id: 'special',
    label: 'A special character (!@#$%)',
    phrase: 'a special character',
    // Anything that is not a letter, a number or a space. Spaces do not count,
    // so a password cannot pass on a space alone.
    test: (password) => /[^\p{L}\p{N}\s]/u.test(password),
  },
];

/** Works on a value that might not even be a string. */
function textOf(password) {
  return typeof password === 'string' ? password : '';
}

/**
 * Which rules the given password meets.
 *
 * Returns { ok, rules, missing } where every rule is { id, label, phrase, met }
 * and `missing` holds the ones that are not met yet.
 */
export function checkPassword(password) {
  const value = textOf(password);
  const rules = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    phrase: rule.phrase,
    met: rule.test(value),
  }));

  return {
    ok: rules.every((rule) => rule.met),
    rules,
    missing: rules.filter((rule) => !rule.met),
  };
}

/** True when the password may be used. */
export function isValidPassword(password) {
  const value = textOf(password);
  return value.length <= MAX_PASSWORD_LENGTH && checkPassword(value).ok;
}

/** Joins phrases the way a person would: "a, b and c". */
function sentenceList(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * A sentence for the server to send back, or null when the password is fine.
 *
 * Only the rules that are not met are named, so the answer stays short and
 * tells the player exactly what to add.
 */
export function describePasswordProblem(password) {
  const value = textOf(password);

  if (value.length > MAX_PASSWORD_LENGTH) {
    return `Please use a password of ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  }

  const { ok, missing } = checkPassword(value);
  if (ok) return null;

  return `Your password still needs ${sentenceList(missing.map((rule) => rule.phrase))}.`;
}
