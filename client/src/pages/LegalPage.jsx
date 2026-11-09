import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSiteConfig } from '../hooks/useSiteConfig.js';
import { MIN_SHOW, buildSkeleton } from '../lib/skeleton';

/**
 * The frame shared by the Privacy Policy and the Terms of Service.
 * These pages have their own layout and no loader.
 */
export default function LegalPage({ title, updated, children }) {
  const config = useSiteConfig();
  const year = new Date().getFullYear();
  const skeletonRef = useRef(null);

  useEffect(() => {
    document.title = `${title} | BayanSafe`;
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
      <div id="pageSkeleton" ref={skeletonRef} className="page-skeleton" aria-hidden="true" />
      {/* Back to the main site (same spot as the nav on the main site) */}
      <nav className="nav-pill nav-pill--single">
        <Link to="/">&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <div className="frame frame-inner legal-frame">
        <header className="legal-top">
          <Link to="/" className="legal-logo" aria-label="Back to BAYANSAFE">
            <img src={config.brand.logo} alt={config.brand.name} />
          </Link>
        </header>

        <main className="panel legal-panel">
          <h1>{title}</h1>
          {updated && <p className="legal-updated">Last updated: {updated}</p>}

          {children}

          <Link to="/" className="legal-back">
            &larr; Back to BAYANSAFE
          </Link>
        </main>

        <footer className="site-footer legal-footer">
          <div className="footer-inner">
            <p>
              Copyright &copy; <span id="legalYear">{year}</span> BAYANSAFE. ALL RIGHTS RESERVED.
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
