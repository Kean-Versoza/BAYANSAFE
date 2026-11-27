import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { buildSkeleton, MIN_SHOW } from '../lib/skeleton';

/**
 * A full-screen skeleton that plays on every page load and route change, so
 * the visitor always sees the loader animation first, even on a hard reload.
 */
export default function GlobalLoader() {
  const location = useLocation();
  const ref = useRef(null);

  useEffect(() => {
    const skeleton = ref.current;
    if (!skeleton) return undefined;
    const pathPart = location.pathname.split('/').filter(Boolean)[0] || '';
    const hashPart = (location.hash || '').replace(/^#/, '').split('/')[0];
    const view = pathPart || hashPart || 'home';
    buildSkeleton(skeleton, view);
    skeleton.classList.add('is-active');
    const timer = window.setTimeout(() => {
      skeleton.classList.remove('is-active');
    }, MIN_SHOW);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return <div ref={ref} className="page-skeleton" aria-hidden="true" />;
}
