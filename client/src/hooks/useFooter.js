import { useEffect, useState } from 'react';
import defaultFooter from '../config/footer';

// The footer never changes during a session, so fetch it once and share it
let cached = null;
let pending = null;

function loadFooter() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch('/api/footer')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        cached = { ...defaultFooter, ...data };
        return cached;
      })
      .catch(() => defaultFooter)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Footer + cookie configuration coming from the Node.js server.
 * Falls back to the built-in defaults while the API is unavailable.
 */
export default function useFooter() {
  const [footer, setFooter] = useState(() => cached ?? defaultFooter);

  useEffect(() => {
    let alive = true;

    loadFooter().then((data) => {
      if (alive && data !== defaultFooter) setFooter(data);
    });

    return () => {
      alive = false;
    };
  }, []);

  return footer;
}
