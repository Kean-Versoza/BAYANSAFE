import { useEffect, useState } from 'react';

const SECTION_IDS = ['home', 'about', 'registration'];

/**
 * Watches which section is in the middle of the screen, so the yellow tab in
 * the navigation follows along while you scroll.
 */
export function useActiveSection(ids = SECTION_IDS) {
  const [active, setActive] = useState('home');

  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return undefined;

    if (!('IntersectionObserver' in window)) {
      setActive(ids[0]);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );

    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [ids]);

  // The stylesheet uses this to hide the logo on the home page.
  useEffect(() => {
    document.body.dataset.section = active;
  }, [active]);

  // Leave the page clean when the visitor goes to another page.
  useEffect(
    () => () => {
      delete document.body.dataset.section;
    },
    [],
  );

  return [active, setActive];
}
