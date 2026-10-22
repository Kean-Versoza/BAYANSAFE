import { checkPassword } from '@shared/password';

/**
 * The live checklist under a password box.
 *
 * Every rule is shown, and the ones the password already meets are ticked, so
 * the player can see what is still missing while typing instead of finding out
 * after pressing the button.
 *
 * The list is read out by screen readers as "met" or "not met" for each rule,
 * and the line at the bottom is a live region, so it is announced as it
 * changes without repeating the whole list on every key press.
 */
export default function PasswordChecklist({ password, id = 'password-rules', visible = true }) {
  if (!visible) return null;

  const { ok, rules } = checkPassword(password);

  return (
    <div className="password-rules" id={id}>
      <ul>
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={rule.met ? 'is-met' : 'is-missing'}
            aria-label={`${rule.label}: ${rule.met ? 'met' : 'not met'}`}
          >
            <span className="password-rule-mark" aria-hidden="true">
              {rule.met ? '\u2713' : '\u2715'}
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>

      <p className={`password-rules-summary${ok ? ' is-ok' : ''}`} role="status" aria-live="polite">
        {ok
          ? 'That password meets every rule.'
          : 'The rules marked with \u2715 are still missing.'}
      </p>
    </div>
  );
}
