import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import RegistrationSection from '../sections/RegistrationSection';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';

/**
 * The registration page.
 *
 * Reached from the "REGISTER NOW" button on the home page. It shows the same
 * form as the old in-page registration section, with the brand logo in its
 * usual spot and a back button instead of the full navigation pill.
 */
export default function RegisterPage() {
  const config = useSiteConfig();

  useEffect(() => {
    document.title = 'Register | BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

  return (
    <>
      {/* Back to the main site (top bar on desktop) */}
      <nav className="nav-pill nav-pill--register-back">
        <Link to="/">&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <RegistrationSection pageMode />

      <SiteFooter config={config} />
    </>
  );
}
