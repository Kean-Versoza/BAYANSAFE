import { useCallback, useEffect, useRef, useState } from 'react';
import CookieBanner from '../components/CookieBanner';
import NavPill from '../components/NavPill';
import SiteFooter from '../components/SiteFooter';
import AboutSection from '../sections/AboutSection';
import HomeSection from '../sections/HomeSection';
import RegistrationSection from '../sections/RegistrationSection';
import {
  LEAVE_DELAY,
  MIN_SHOW,
  NAV_LOADER_MS,
  SHOW_LOADER_ON_NAV,
  buildSkeleton,
  viewFor,
} from '../lib/skeleton';

/**
 * The main single-page experience: Home, About and Registration stacked into
 * one scrolling page, with the skeleton loader and the fixed nav pill.
 */
export default function HomePage() {
  const skeletonRef = useRef(null);
  const [section, setSection] = useState(() => viewFor(window.location.hash));

  const showSkeleton = useCallback((view) => {
    const skeleton = skeletonRef.current;
    if (!skeleton) return;
    buildSkeleton(skeleton, view);
    skeleton.classList.add('is-active');
  }, []);

  const hideSkeleton = useCallback(() => {
    skeletonRef.current?.classList.remove('is-active');
  }, []);

  /* Nav tabs and the logo jump to their section (with a loader flash) */
  const jumpTo = useCallback(
    (id) => {
      const target = document.getElementById(id);
      if (!target) return;

      if (SHOW_LOADER_ON_NAV && skeletonRef.current && section !== id) {
        showSkeleton(id);
        window.setTimeout(() => {
          window.scrollTo({ top: target.offsetTop, behavior: 'instant' });
          setSection(id);
          window.setTimeout(hideSkeleton, NAV_LOADER_MS);
        }, LEAVE_DELAY);
      } else {
        target.scrollIntoView({ behavior: 'smooth' });
      }

      window.history.replaceState(null, '', `#${id}`);
    },
    [section, showSkeleton, hideSkeleton]
  );

  /* The yellow nav tab follows the section on screen */
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setSection(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );

    document.querySelectorAll('.section').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  /* Keep the body attribute in sync with the section (the CSS relies on it) */
  useEffect(() => {
    document.body.dataset.section = section;
  }, [section]);

  /* 1. Loader on first load, reload, or opening the site */
  useEffect(() => {
    const view = viewFor(window.location.hash);
    let cancelled = false;

    buildSkeleton(skeletonRef.current, view);

    // Re-measure once the fonts are in
    document.fonts?.ready.then(() => {
      if (!cancelled && skeletonRef.current?.classList.contains('is-active')) {
        buildSkeleton(skeletonRef.current, view);
      }
    });

    const finish = () => {
      if (cancelled) return;
      buildSkeleton(skeletonRef.current, view);
      window.setTimeout(hideSkeleton, Math.max(0, MIN_SHOW - performance.now()));
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish);
    }

    const safetyNet = window.setTimeout(hideSkeleton, 4000); // safety net

    /* 2. Back / forward buttons restore the page from memory: replay the loader */
    const onPageShow = (event) => {
      if (!event.persisted) return;
      showSkeleton(viewFor(document.body.dataset.section));
      window.setTimeout(hideSkeleton, MIN_SHOW);
    };
    window.addEventListener('pageshow', onPageShow);

    /* Landing on /#about or /#registration: jump to that section */
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const target = document.getElementById(hash);
      if (target) window.scrollTo({ top: target.offsetTop, behavior: 'instant' });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', finish);
      window.removeEventListener('pageshow', onPageShow);
      window.clearTimeout(safetyNet);
    };
  }, [hideSkeleton, showSkeleton]);

  return (
    <>
      <NavPill active={section} onJump={jumpTo} />

      <HomeSection />
      <AboutSection onJump={jumpTo} />
      <RegistrationSection />

      <SiteFooter onJump={jumpTo} />
      <CookieBanner />

      {/* The loader fills this container imperatively (see lib/skeleton.js) */}
      <div id="pageSkeleton" className="page-skeleton" ref={skeletonRef} aria-hidden="true" />
    </>
  );
}
