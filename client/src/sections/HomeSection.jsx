import { Link } from 'react-router-dom';

/** Home view: the hero banner plus the tagline pinned to the bottom. */
export default function HomeSection() {
  return (
    <section id="home" className="section frame frame-home">
      <div className="section-top"></div>
      <div className="hero">
        <div className="main-banner">
          <img src="/images/welcome-sign.png" alt="Welcome to BayanSafe" />
        </div>

        {/* The registration form now lives on its own page, reached from here. */}
        <Link to="/register" className="btn-yellow main-trigger">
          REGISTER NOW
        </Link>

        <p className="tagline">
          A Philippine Smart Community Disaster Intelligence and Preparedness Response Game
        </p>
      </div>
    </section>
  );
}
