import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * The pill in the top-right corner with the tabs.
 *
 * The tabs come from the site configuration, so adding one is a change in
 * `config/site.js` and nothing else. A tab with a `path` goes to that page
 * (that is how the account page is reached); a tab without one jumps to
 * that part of the home page, and `onJump` tells the page to play the
 * loader before the jump.
 *
 * The ACCOUNT tab also carries a small drop-down with a "Register" entry,
 * so a visitor can reach the registration page straight from the nav bar.
 */
export default function NavPill({ items = [], active, onJump }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setAccountOpen(false);
  };

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
        {items.map((item) => {
          const isAccount = item.id === 'account';

          return (
            <div key={item.id} className={`nav-item${isAccount ? ' nav-item--account' : ''}`}>
              <Link
                to={item.path ?? `/#${item.id}`}
                data-target={item.id}
                className={active === item.id ? 'active' : undefined}
                aria-current={active === item.id ? 'page' : undefined}
                onClick={() => {
                  if (!item.path) onJump?.(item.id);
                  if (!isAccount) close();
                }}
              >
                {item.label}
                {isAccount && (
                  <button
                    type="button"
                    className={`nav-caret${accountOpen ? ' is-open' : ''}`}
                    aria-label={accountOpen ? 'Hide register link' : 'Show register link'}
                    aria-expanded={accountOpen}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setAccountOpen((v) => !v);
                    }}
                  >
                    &#9662;
                  </button>
                )}
              </Link>

              {isAccount && (
                <div className={`nav-submenu${accountOpen ? ' is-open' : ''}`}>
                  <Link to="/register" className="nav-submenu__link" onClick={close}>
                    Register
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
