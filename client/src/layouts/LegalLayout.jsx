import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/** Shared shell for the Privacy Policy and Terms of Service pages. */
export default function LegalLayout({ title, children }) {
  const year = new Date().getFullYear();

  useEffect(() => {
    document.title = title ? `${title} | BayanSafe` : 'BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, [title]);

  return (
    <>
      {/* Back to the main site (same spot as the nav on the main site) */}
      <nav className="nav-pill nav-pill--single">
        <Link to="/">&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <div className="frame frame-inner legal-frame">
        <header className="legal-top">
          <Link className="legal-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src="/images/logo.png" alt="BAYANSAFE" />
          </Link>
        </header>

        <main className="panel legal-panel">
          {children}
          <Link className="legal-back" to="/">
            &larr; Back to BAYANSAFE
          </Link>
        </main>

        <footer className="site-footer legal-footer">
          <div className="footer-inner">
            <p>
              Copyright &copy; {year} BAYANSAFE. ALL RIGHTS RESERVED.
            </p>
            <p className="footer-contact">
              <Link to="/">BAYANSAFE</Link>
              <span className="sep">|</span>
              <Link to="/privacy">Privacy Policy</Link>
              <span className="sep">|</span>
              <Link to="/terms">Terms of Service</Link>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
