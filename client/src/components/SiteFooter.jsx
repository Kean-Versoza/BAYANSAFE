import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import ContactForm from './ContactForm.jsx';

/**
 * The footer of the site.
 * All the text comes from the shared site configuration.
 */
export default function SiteFooter({ config, onJump }) {
  const footer = config.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" id="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <Link
            className="footer-logo"
            to={{ pathname: '/', hash: '#home' }}
            replace
            data-target="home"
            onClick={() => onJump?.('home')}
          >
            <img src={footer.logo} alt={footer.brandName} />
          </Link>

          {/* Optional rating badges. Add more in the site configuration. */}
          <div className="footer-badges">
            {footer.badges.map((badge) => (
              <img key={badge.image} src={badge.image} alt={badge.alt} />
            ))}
          </div>
        </div>

        <p>
          Copyright &copy; <span id="footerYear">{year}</span> {footer.copyright}
        </p>
        <p className="footer-contact">
          Contact: <a href={`mailto:${footer.email}`}>{footer.email}</a>
          {footer.links.map((link) => (
            <Fragment key={link.label}>
              <span className="sep">|</span>
              <Link to={link.url}>{link.label}</Link>
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
