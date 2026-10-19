import { Fragment } from 'react';
import { Link } from 'react-router-dom';

/**
 * The footer link row - rendered as "Privacy Policy | Terms of Service | ...".
 *
 * A url of '#' (or empty) is a placeholder: the label is shown but clicking it
 * does nothing, so a not-yet-built page never bounces the visitor elsewhere.
 * Internal urls ("/privacy") go through the router; anything else is a normal
 * link, which is how `mailto:` and external addresses work.
 */
export default function FooterLinks({ links = [] }) {
  return links.map((link, index) => {
    const placeholder = !link.url || link.url === '#';

    return (
      <Fragment key={`${link.label}-${link.url}`}>
        {index > 0 && <span className="sep">|</span>}
        {placeholder ? (
          <a href="#" aria-disabled="true" onClick={(event) => event.preventDefault()}>
            {link.label}
          </a>
        ) : link.url.startsWith('/') ? (
          <Link to={link.url}>{link.label}</Link>
        ) : (
          <a href={link.url}>{link.label}</a>
        )}
      </Fragment>
    );
  });
}
