import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import NavPill from '../components/NavPill';
import RegistrationSection from '../sections/RegistrationSection';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';
import {
  LEAVE_DELAY,
  MIN_SHOW,
  NAV_LOADER_MS,
  SHOW_LOADER_ON_NAV,
  buildSkeleton,
} from '../lib/skeleton';

/**
 * The registration page.
 *
 * Reached from the "REGISTER NOW" button on the home page. It shows the same
 * form as the old in-page registration section, with the brand logo in its
 * usual spot and a back button instead of the full navigation pill.
 */
export default function RegisterPage() {
  const config = useSiteConfig();
  const navigate = useNavigate();
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
    document.title = 'Register | BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

  const showSkeleton = useCallback(() => {
    const skeleton = skeletonRef.current;
    if (!skeleton) return;
    buildSkeleton(skeleton, 'registration');
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
      <NavPill items={config.nav.filter((item) => item.id !== 'home')} active="register" />
      {/* Back to the main site (top bar on desktop) */}
      <nav className="nav-pill nav-pill--register-back">
        <Link to="/" onClick={handleBack}>&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <RegistrationSection pageMode />

      <SiteFooter config={config} />
    </>
  );
}
