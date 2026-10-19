import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import useFooter from '../hooks/useFooter';

/**
 * Site footer. Content comes from the Node.js server (`GET /api/footer`).
 * `onJump` is optional - when given, the logo scrolls to a section instead
 * of reloading the page.
 */
export default function SiteFooter({ onJump }) {
  const footer = useFooter();
  const year = new Date().getFullYear();

  const logoClick = (event) => {
    if (!onJump) return;
    event.preventDefault();
    onJump('home');
  };

  const renderLink = (link) => (
    <Fragment key={`${link.label}-${link.url}`}>
      <span className="sep">|</span>
      {link.url.startsWith('/') ? (
        <Link to={link.url}>{link.label}</Link>
      ) : (
        <a href={link.url}>{link.label}</a>
      )}
    </Fragment>
  );

  return (
    <footer className="site-footer" id="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <a className="footer-logo" href="#home" onClick={logoClick}>
            <img src={footer.logo} alt={footer.brand_name} />
          </a>

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
          Contact:{' '}
          <a href={`mailto:${footer.email}`}>{footer.email}</a>
          {footer.links.map(renderLink)}
        </p>

        {footer.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </footer>
  );
}
