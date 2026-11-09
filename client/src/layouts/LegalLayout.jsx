import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import FooterLinks from '../components/FooterLinks';
import defaultFooter from '../config/footer';
import { MIN_SHOW, buildSkeleton } from '../lib/skeleton';

/** Shared shell for the Privacy Policy and Terms of Service pages. */
export default function LegalLayout({ title, children }) {
  const year = new Date().getFullYear();
  const skeletonRef = useRef(null);

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
              <FooterLinks links={defaultFooter.links} />
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
