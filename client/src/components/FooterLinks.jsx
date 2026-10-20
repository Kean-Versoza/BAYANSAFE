import { Fragment } from 'react';
import { Link } from 'react-router-dom';

/**
 * The footer link row - rendered as "Privacy Policy | Terms of Service | ...".
 *
 * A url of '#' (or empty) is a placeholder: the label is shown but clicking it
 * does nothing, so a not-yet-built page never bounces the visitor elsewhere.
 * Internal urls ("/privacy") go through the router; anything else is a normal
 * link, which is how `mailto:` and external addresses work.
 *
 * A url that is an in-page anchor ("#about", "#help") is handed to `onJump`
 * instead of letting the browser jump: the main page is driven by its own
 * one-screen-at-a-time scroll controller (see `usePageSnap`), so a native hash
 * jump would fight it. `onJump` is the same path the nav pill uses.
 */
export default function FooterLinks({ links = [], onJump }) {
  return links.map((link, index) => {
    const placeholder = !link.url || link.url === '#';
    const anchor = !placeholder && link.url.startsWith('#');

    const content = placeholder ? (
      <a href="#" aria-disabled="true" onClick={(event) => event.preventDefault()}>
        {link.label}
      </a>
    ) : anchor ? (
      <a
        href={link.url}
        data-target={link.url.slice(1)}
        onClick={(event) => {
          // Without onJump (e.g. the legal pages) the browser default is fine.
          if (!onJump) return;
          event.preventDefault();
          onJump(link.url.slice(1));
        }}
      >
        {link.label}
      </a>
    ) : link.url.startsWith('/') ? (
      <Link to={link.url}>{link.label}</Link>
    ) : (
      <a href={link.url}>{link.label}</a>
    );

    return (
      <Fragment key={`${link.label}-${link.url}`}>
        {index > 0 && <span className="sep">|</span>}
        {content}
      </Fragment>
    );
  });
}
