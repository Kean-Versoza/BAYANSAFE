import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { buildSkeleton, LEAVE_DELAY, NAV_LOADER_MS, SHOW_LOADER_ON_NAV } from '../lib/skeleton';

/** Home view: the hero banner plus the tagline pinned to the bottom. */
export default function HomeSection() {
  const navigate = useNavigate();

  const handleRegister = useCallback((event) => {
    event.preventDefault();
    const skeleton = document.getElementById('pageSkeleton');

    if (SHOW_LOADER_ON_NAV && skeleton) {
      buildSkeleton(skeleton, 'home');
      skeleton.classList.add('is-active');
      window.setTimeout(() => {
        navigate('/register');
        window.setTimeout(() => skeleton.classList.remove('is-active'), NAV_LOADER_MS);
      }, LEAVE_DELAY);
    } else {
      navigate('/register');
    }
  }, [navigate]);

  return (
    <section id="home" className="section frame frame-home">
      <div className="section-top"></div>
      <div className="hero">
        <div className="main-banner">
          <img src="/images/welcome-sign.png" alt="Welcome to BayanSafe" />
        </div>

        {/* The registration form now lives on its own page, reached from here. */}
        <div className="hero-actions">
          <Link to="/register" onClick={handleRegister} className="btn-yellow main-trigger">
            REGISTER NOW
          </Link>
          <button type="button" className="btn-yellow main-trigger" onClick={() => {}}>
            DOWNLOAD
          </button>
        </div>

        <p className="tagline">
          A Philippine Smart Community Disaster Intelligence and Preparedness Response Game
        </p>
      </div>
    </section>
  );
}
