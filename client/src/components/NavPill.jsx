import { Link } from 'react-router-dom';

/**
 * The pill in the top-right corner with the tabs.
 *
 * The tabs are real links, so they can be shared and opened in a new tab.
 * `onJump` tells the page that the user asked for a section, which is what
 * triggers the loader before the jump.
 *
 * A tab with a `path` goes to that page instead of to a part of the home
 * page. That is how the account page is reached.
 */
export default function NavPill({ items, active, onJump }) {
  return (
    <nav className="nav-pill" aria-label="Main navigation">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.path ?? { pathname: '/', hash: `#${item.id}` }}
          replace
          data-target={item.id}
          className={active === item.id ? 'active' : ''}
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
