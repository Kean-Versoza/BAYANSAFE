import { useCallback, useEffect, useRef } from 'react';

import NavPill from '../components/NavPill';
import RegistrationSection from '../sections/RegistrationSection';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';
import { MIN_SHOW, buildSkeleton } from '../lib/skeleton';

/**
 * The registration page.
 *
 * Reached from the "REGISTER NOW" button on the home page. It shows the same
 * form as the old in-page registration section, with the brand logo in its
 * usual spot and a back button instead of the full navigation pill.
 */
export default function RegisterPage() {
  const config = useSiteConfig();
  const skeletonRef = useRef(null);

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

      <RegistrationSection pageMode />

      <SiteFooter config={config} />
    </>
  );
}
