import FooterLinks from './FooterLinks';
import ContactForm from './ContactForm';

/**
 * Site footer. Content comes from the Node.js server (`GET /api/config`),
 * falling back to `config/site.js` when the API cannot be reached.
 * `onJump` is optional - when given, the logo scrolls to a section instead
 * of reloading the page.
 *
 * The "Send us a message" form is part of the footer, so the Help Center link
 * lands on it.
 */
export default function SiteFooter({ config, onJump }) {
  const footer = config.footer;
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
          <a className="footer-logo" href="#home" data-target="home" onClick={logoClick}>
            <img src={footer.logo} alt={footer.brand_name} />
          </a>

          {/* Optional rating badges. Add one entry per image in the config. */}
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
          <span className="sep">|</span>
          <FooterLinks links={footer.links} onJump={onJump} />
        </p>

        {footer.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}

        <ContactForm />
      </div>
    </footer>
  );
}
