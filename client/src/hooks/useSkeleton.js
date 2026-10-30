import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSkeleton, viewFor } from '../lib/skeleton.js';

/**
 * Settings of the loader. Times are in milliseconds.
 */
export const LOADER_SETTINGS = {
  // true: the skeleton flashes when you use the nav. false: smooth scroll only
  SHOW_LOADER_ON_NAV: true,
  // how long the skeleton stays after the page has loaded
  MIN_SHOW: 450,
  // how long the skeleton fades in before a nav jump
  LEAVE_DELAY: 300,
  // how long the skeleton stays after a nav jump
  NAV_LOADER_MS: 400,
  // the registration form shows a skeleton when it opens (0 = off)
  FORM_LOADER_MS: 700,
  // the loader never stays longer than this, even if a file is still loading
  MAX_SHOW: 4000,
};

/**
 * Drives the page skeleton.
 *
 * The container is painted by measuring the real layout, so the hook has to
 * run after React has put the page on the screen.
 */
export function useSkeleton(settings = LOADER_SETTINGS, initialView = 'home') {
  // The settings keep the same identity, so the effects below do not rerun.
  const options = useMemo(() => ({ ...LOADER_SETTINGS, ...settings }), [settings]);
  const containerRef = useRef(null);
  const viewRef = useRef(viewFor(initialView));
  const [visible, setVisible] = useState(true);

  const build = useCallback((view) => {
    const container = containerRef.current;
    if (!container) return;
    buildSkeleton(container, view);
  }, []);

  /** Puts the skeleton on screen for the given view (or the last one). */
  const show = useCallback(
    (view) => {
      if (view) viewRef.current = viewFor(view);
      build(viewRef.current);
      setVisible(true);
    },
    [build],
  );

  /** Takes the skeleton off screen. */
  const hide = useCallback(() => setVisible(false), []);

  // 1. Loader on first load, reload, or opening the site
  useEffect(() => {
    build(viewRef.current);

    // Re-measure once the web fonts are in, they change the size of the text
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (containerRef.current?.classList.contains('is-active')) build(viewRef.current);
      });
    }

    const finish = () => {
      build(viewRef.current);
      setTimeout(hide, Math.max(0, options.MIN_SHOW - performance.now()));
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish);
    }

    // Safety net: the loader never stays longer than MAX_SHOW
    const safety = setTimeout(hide, Math.max(0, options.MAX_SHOW - performance.now()));

    return () => {
      window.removeEventListener('load', finish);
      clearTimeout(safety);
    };
  }, [build, hide, options.MIN_SHOW, options.MAX_SHOW]);

  // 2. Back / forward buttons restore the page from memory: replay the loader
  useEffect(() => {
    const onPageShow = (e) => {
      if (!e.persisted) return;
      show(viewFor(document.body.dataset.section));
      setTimeout(hide, options.MIN_SHOW);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [show, hide, options.MIN_SHOW]);

  return { containerRef, show, hide, build, visible, viewRef, settings: options };
}
