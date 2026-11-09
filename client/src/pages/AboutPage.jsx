import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import NavPill from '../components/NavPill';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';

const TEAM = [
  { name: 'Dave Adriano', role: 'Research Software Engineer' },
  { name: 'Iron Salbador', role: 'Research Software Engineer' },
  { name: 'Mikel Agustin', role: 'Story Editor, Research Software Engineer' },
  { name: 'Jay-el Segarino', role: 'Lead engineer, Gameplay engineer, Animation' },
  { name: 'Joyce Blanza', role: 'Creative director, Character art, Environment art' },
  { name: 'Ryan Sumndad', role: 'Story Producer' },
  { name: 'Gino Claveria', role: 'Research Software Engineer' },
  { name: 'Kean Versoza', role: 'Production, Website Deployment' },
  { name: 'James Galit', role: 'Gameplay engineer' },
  { name: 'Cris Villoria', role: 'Research Software Engineer' },
  { name: 'Amir Pascual', role: 'Hardware engineer' },
];

export default function AboutPage() {
  const config = useSiteConfig();

  useEffect(() => {
    document.title = 'About Us | BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

  return (
    <>
      <NavPill items={config.nav} active="about" />
      <nav className="nav-pill nav-pill--single">
        <Link to="/">&larr; BACK TO BAYANSAFE</Link>
      </nav>

      <div className="frame frame-inner about-page-frame">
        <header className="about-top">
          <Link className="about-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src="/images/logo.png" alt="BAYANSAFE" />
          </Link>
        </header>

        <main className="panel about-panel">
          <h1>About Us</h1>
          <p className="about-lead">
            BayanSafe is an educational game about disaster preparedness in the Philippines.
            It is built by a small team of students from Quezon City University (QCU).
          </p>

          <h2>The team</h2>
          <ul className="about-team">
            {TEAM.map((member, index) => (
              <li key={index}>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </li>
            ))}
          </ul>

        </main>

      </div>

      <SiteFooter config={config} />
    </>
  );
}
