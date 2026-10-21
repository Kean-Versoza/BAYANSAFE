import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import ContactForm from '../components/ContactForm';

/**
 * The Help Center page.
 *
 * Reached from the footer's "Help Center" link. It holds nothing but the
 * "Send us a message" form, centered on the page, so the visitor lands
 * straight on it.
 */
export default function HelpPage() {
  useEffect(() => {
    document.title = 'Help Center | BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

  return (
    <>
      {/* Back to the main site (same spot as the nav on the main site) */}
      <nav className="nav-pill nav-pill--single">
        <Link to="/">&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <div className="frame frame-inner help-frame">
        <header className="help-top">
          <Link className="help-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src="/images/logo.png" alt="BAYANSAFE" />
          </Link>
        </header>

        <main className="help-page">
          <ContactForm />

          <Link className="help-back" to="/">
            &larr; Back to BAYANSAFE
          </Link>
        </main>
      </div>
    </>
  );
}
