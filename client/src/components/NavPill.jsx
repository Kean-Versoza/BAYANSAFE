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
  return (
    <nav className="nav-pill" aria-label="Main navigation">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.path ?? `/#${item.id}`}
          data-target={item.id}
          className={active === item.id ? 'active' : undefined}
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => {
            if (!item.path) onJump?.(item.id);
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
