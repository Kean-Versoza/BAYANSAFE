import { useCallback, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import NavPill from '../components/NavPill';
import SiteFooter from '../components/SiteFooter';
import ContactForm from '../components/ContactForm';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { LEAVE_DELAY, MIN_SHOW, NAV_LOADER_MS, SHOW_LOADER_ON_NAV, buildSkeleton } from '../lib/skeleton';

/**
 * The Help Center page.
 *
 * Reached from the footer's "Contact us" and "Help Center" links. It holds
 * nothing but the "Send us a message" form, centered on the page, so the
 * visitor lands straight on it.
 */
export default function HelpPage() {
  const config = useSiteConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const source =
    new URLSearchParams(location.search).get('from') === 'contact' ? 'contact' : 'help';

  const skeletonRef = useRef(null);

  const handleBack = useCallback((event) => {
    event.preventDefault();
    const skeleton = skeletonRef.current;
    if (SHOW_LOADER_ON_NAV && skeleton) {
      buildSkeleton(skeleton, 'home');
      skeleton.classList.add('is-active');
      window.setTimeout(() => {
        navigate('/');
        window.setTimeout(() => skeleton.classList.remove('is-active'), NAV_LOADER_MS);
      }, LEAVE_DELAY);
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    document.title = 'Help Center | BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

  const showSkeleton = useCallback(() => {
    const skeleton = skeletonRef.current;
    if (!skeleton) return;
    buildSkeleton(skeleton, 'help');
    skeleton.classList.add('is-active');
  }, []);

  const hideSkeleton = useCallback(() => {
    skeletonRef.current?.classList.remove('is-active');
  }, []);

  useEffect(() => {
    if (!skeletonRef.current) return undefined;
    showSkeleton();
    const timer = window.setTimeout(hideSkeleton, MIN_SHOW);
    return () => window.clearTimeout(timer);
  }, [showSkeleton, hideSkeleton]);

  return (
    <>
      <div id="pageSkeleton" ref={skeletonRef} className="page-skeleton" aria-hidden="true" />
      <NavPill items={config.nav} active="help" />
      {/* Back to the main site (same spot as the nav on the main site) */}
      <nav className="nav-pill nav-pill--single">
        <Link to="/" onClick={handleBack}>&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <div className="frame frame-inner help-frame">
        <header className="help-top">
          <Link className="help-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src="/images/logo.png" alt="BAYANSAFE" />
          </Link>
        </header>

        <main className="help-page">
          <ContactForm source={source} />
        </main>
      </div>

      <SiteFooter config={config} />
    </>
  );
}
