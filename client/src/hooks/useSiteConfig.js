import { useEffect, useState } from 'react';
import bundledConfig from '@shared/site.config.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Merges the server's config over the bundled one, section by section. */
function mergeConfig(base, extra) {
  const merged = { ...base };
  Object.keys(extra).forEach((key) => {
    const a = base[key];
    const b = extra[key];
    merged[key] = isPlainObject(a) && isPlainObject(b) ? mergeConfig(a, b) : b;
  });
  return merged;
}

/**
 * The site configuration.
 *
 * The bundled copy is used straight away so the page never flashes empty.
 * When the server answers, its version replaces it, which means the text can
 * also be changed at runtime on the server.
 */
export function useSiteConfig() {
  const [config, setConfig] = useState(bundledConfig);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setConfig((current) => mergeConfig(current, data));
      })
      .catch(() => {
        /* the server is not reachable - keep the bundled copy */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
