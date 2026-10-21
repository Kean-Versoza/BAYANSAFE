import { useEffect, useState } from 'react';
import defaultSite from '../config/site';

// The site configuration never changes during a session, so fetch it once.
let cached = null;
let pending = null;

function load() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch('/api/config')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        cached = { ...defaultSite, ...data };
        return cached;
      })
      .catch(() => defaultSite)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * The site configuration coming from the Node.js server (`GET /api/config`).
 *
 * It carries the navigation tabs, the footer text and the cookie notice, and
 * it falls back to the built-in defaults while the API is unavailable, so the
 * site always renders.
 */
export function useSiteConfig() {
  const [config, setConfig] = useState(() => cached ?? defaultSite);

  useEffect(() => {
    let alive = true;

    load().then((data) => {
      if (alive && data !== defaultSite) setConfig(data);
    });

    return () => {
      alive = false;
    };
  }, []);

  return config;
}

export default useSiteConfig;
