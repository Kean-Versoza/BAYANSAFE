import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * The pill in the top-right corner with the tabs.
 *
 * The tabs come from the site configuration, so adding one is a change in
 * `config/site.js` and nothing else.
 *
 * A tab with a `path` goes to that page (that is how the account page is
 * reached); a tab without one jumps to that part of the home page, and
 * `onJump` tells the page to play the loader before the jump.
 */
export default function NavPill({ items = [], active, onJump }) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className={`nav-toggle${open ? ' is-open' : ''}`}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        className={`nav-backdrop${open ? ' is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      <nav className={`nav-pill${open ? ' is-open' : ''}`} aria-label="Main navigation">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.path ?? `/#${item.id}`}
            data-target={item.id}
            className={active === item.id ? 'active' : undefined}
            aria-current={active === item.id ? 'page' : undefined}
            onClick={() => {
              if (!item.path) onJump?.(item.id);
              close();
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
