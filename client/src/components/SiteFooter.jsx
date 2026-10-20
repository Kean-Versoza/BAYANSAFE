import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import ContactForm from './ContactForm';

/**
 * The footer of the site.
 *
 * All the text comes from the site configuration (`config/site.js`, served by
 * `GET /api/config`), so it lives in one place. The logo scrolls to a section
 * when `onJump` is given.
 */
export default function SiteFooter({ config, onJump }) {
  const footer = config.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" id="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <a
            className="footer-logo"
            href="#home"
            data-target="home"
            onClick={(event) => {
              if (!onJump) return;
              event.preventDefault();
              onJump('home');
            }}
          >
            <img src={footer.logo} alt={footer.brandName} />
          </a>

          {/* Optional rating badges. Add more in the site configuration. */}
          {footer.badges.length > 0 && (
            <div className="footer-badges">
              {footer.badges.map((badge) => (
                <img key={badge.image} src={badge.image} alt={badge.alt || ''} />
              ))}
            </div>
          )}
        </div>

        <p>
          Copyright &copy; {year} {footer.copyright}
        </p>

        <p className="footer-contact">
          Contact: <a href={`mailto:${footer.email}`}>{footer.email}</a>
          {footer.links.map((link) => (
            <Fragment key={`${link.label}-${link.url}`}>
              <span className="sep">|</span>
              {link.url.startsWith('/') ? (
                <Link to={link.url}>{link.label}</Link>
              ) : (
                <a href={link.url}>{link.label}</a>
              )}
            </Fragment>
          ))}
        </p>

        {footer.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}

        <ContactForm />
      </div>
    </footer>
  );
}
