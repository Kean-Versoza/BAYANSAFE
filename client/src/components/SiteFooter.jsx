import FooterLinks from './FooterLinks';
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
          <FooterLinks links={footer.links} />
        </p>

        {footer.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </footer>
  );
}
