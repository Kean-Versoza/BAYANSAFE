import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import NavPill from '../components/NavPill.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import CookieBanner from '../components/CookieBanner.jsx';
import PageSkeleton from '../components/PageSkeleton.jsx';
import AboutPanel from '../components/AboutPanel.jsx';
import RegistrationForm from '../components/RegistrationForm.jsx';
import { useActiveSection } from '../hooks/useActiveSection.js';
import { useSiteConfig } from '../hooks/useSiteConfig.js';
import { LOADER_SETTINGS, useSkeleton } from '../hooks/useSkeleton.js';

export default function HomePage() {
  const config = useSiteConfig();
  const { hash } = useLocation();
  const [active, setActive] = useActiveSection();
  const { containerRef, show, hide, visible, settings } = useSkeleton(LOADER_SETTINGS, hash);

  // The section the visitor asked for with the navigation.
  const requested = useRef(null);
  // Bumped on every click, so clicking the same tab twice still jumps.
  const [tick, setTick] = useState(0);
  const timers = useRef([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // Stop the pending jump when the page changes
  useEffect(() => () => clearTimers(), [clearTimers]);

  /** Remembers that the visitor asked for a section (the jump happens in the effect below). */
  const onJump = useCallback((id) => {
    requested.current = id;
    setTick((t) => t + 1);
  }, []);

  // The nav tabs and the logo jump to their section
  useEffect(() => {
    const id = (hash || '').replace('#', '');
    if (!id) return undefined;

    const target = document.getElementById(id);
    if (!target) return undefined;

    const fromNav = requested.current === id;
    requested.current = null;

    // A direct link such as /about jumps straight to the section
    if (!fromNav) {
      target.scrollIntoView({ behavior: 'instant' });
      setActive(id);
      return undefined;
    }

    if (!settings.SHOW_LOADER_ON_NAV) {
      target.scrollIntoView({ behavior: 'smooth' });
      return undefined;
    }

    // The loader flashes, then the page jumps to the section
    show(id);
    timers.current.push(
      setTimeout(() => {
        const top = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: 'instant' });
        setActive(id);
        timers.current.push(setTimeout(hide, settings.NAV_LOADER_MS));
      }, settings.LEAVE_DELAY),
    );

    return () => clearTimers();
  }, [hash, tick, setActive, show, hide, settings, clearTimers]);

  return (
    <>
      <NavPill items={config.nav} active={active} onJump={onJump} />

      {/* ============ HOME ============ */}
      <section id="home" className="section frame frame-home">
        <div className="section-top" />
        <div className="hero">
          <div className="main-banner">
            <img src="/images/welcome-sign.png" alt="Welcome to BayanSafe" />
          </div>
          <p className="tagline">{config.brand.tagline}</p>
        </div>
      </section>

      {/* ============ ABOUT ============ */}
      <section id="about" className="section frame frame-inner">
        <div className="section-top section-top--logo">
          <Link
            className="logo"
            to={{ pathname: '/', hash: '#home' }}
            replace
            data-target="home"
            onClick={() => onJump('home')}
          >
            <img src={config.brand.logo} alt={config.brand.name} />
          </Link>
        </div>

        <AboutPanel />
      </section>

      {/* ============ REGISTRATION ============ */}
      <section id="registration" className="section frame frame-inner">
        <RegistrationForm tagline={config.brand.tagline} formLoaderMs={settings.FORM_LOADER_MS} />
      </section>

      <SiteFooter config={config} onJump={onJump} />
      <CookieBanner config={config} />
      <PageSkeleton containerRef={containerRef} visible={visible} />
    </>
  );
}
