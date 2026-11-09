import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavPill from '../components/NavPill';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';
import defaultFooter from '../config/footer';
import { LEAVE_DELAY, MIN_SHOW, NAV_LOADER_MS, SHOW_LOADER_ON_NAV, buildSkeleton } from '../lib/skeleton';

/** Shared shell for the Privacy Policy and Terms of Service pages. */
export default function LegalLayout({ title, children }) {
  const config = useSiteConfig();
  const year = new Date().getFullYear();
  const navigate = useNavigate();
  const skeletonRef = useRef(null);

  const handleBack = useCallback((event) => {
    event.preventDefault();
    const skeleton = skeletonRef.current;
    if (SHOW_LOADER_ON_NAV && skeleton) {
      buildSkeleton(skeleton, 'legal');
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
    document.title = title ? `${title} | BayanSafe` : 'BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, [title]);

  const showSkeleton = useCallback(() => {
    const skeleton = skeletonRef.current;
    if (!skeleton) return;
    buildSkeleton(skeleton, 'legal');
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
      <div ref={skeletonRef} id="pageSkeleton" className="page-skeleton" aria-hidden="true" />
      <NavPill items={config.nav} active="legal" />
      {/* Back to the main site (same spot as the nav on the main site) */}
      <nav className="nav-pill nav-pill--single">
        <Link to="/" onClick={handleBack}>&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <div className="frame frame-inner legal-frame">
        <header className="legal-top">
          <Link className="legal-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src="/images/logo.png" alt="BAYANSAFE" />
          </Link>
        </header>

        <main className="panel legal-panel">
          {children}
          <Link className="legal-back" to="/" onClick={handleBack}>
            &larr; Back to BAYANSAFE
          </Link>
        </main>

      </div>

      <SiteFooter config={config} />
    </>
  );
}
