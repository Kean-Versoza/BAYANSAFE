import { useCallback, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

import ContactForm from '../components/ContactForm';
import { MIN_SHOW, buildSkeleton } from '../lib/skeleton';

/**
 * The Help Center page.
 *
 * Reached from the footer's "Contact us" and "Help Center" links. It holds
 * nothing but the "Send us a message" form, centered on the page, so the
 * visitor lands straight on it.
 */
export default function HelpPage() {
  const location = useLocation();
  const source =
    new URLSearchParams(location.search).get('from') === 'contact' ? 'contact' : 'help';

  const skeletonRef = useRef(null);

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
          <ContactForm source={source} />

          <Link className="help-back" to="/">
            &larr; Back to BAYANSAFE
          </Link>
        </main>
      </div>
    </>
  );
}
