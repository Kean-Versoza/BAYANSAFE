import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';

// Desktop layout: the original order.
const TEAM_DESKTOP = [
  { name: 'Dave Adriano', role: 'Research Software Engineer' },
  { name: 'Mikel Agustin', role: 'Story Editor' },
  { name: 'Joyce Blanza', role: 'Creative director, Character art, Environment art' },
  { name: 'Gino Claveria', role: 'Research Software Engineer' },
  { name: 'James Galit', role: 'Gameplay engineer' },
  { name: 'Amir Pascual', role: 'Hardware engineer' },
  { name: 'Iron Salbador', role: 'Research Software Engineer' },
  { name: 'Jay-el Segarino', role: 'Lead engineer, Gameplay engineer, Animation' },
  { name: 'Ryan Sumndad', role: 'Story Producer' },
  { name: 'Kean Versoza', role: 'Production, Website Deployment' },
  { name: 'Cris Villoria', role: 'Research Software Engineer' },
];

// Mobile layout: a different order, with the updated roles.
const TEAM_MOBILE = [
  { name: 'Dave Adriano', role: 'Research Software Engineer' },
  { name: 'Iron Salbador', role: 'Research Software Engineer' },
  { name: 'Mikel Agustin', role: 'Story Editor, Research Software Engineer' },
  { name: 'Jay-el Segarino', role: 'Lead engineer, Gameplay engineer, Animation' },
  { name: 'Joyce Blanza', role: 'Creative director, Character art, Environment art' },
  { name: 'Ryan Sumndad', role: 'Story Producer' },
  { name: 'Gino Claveria', role: 'Research Software Engineer' },
  { name: 'Kean Versoza', role: 'Production, Website Deployment' },
  { name: 'James Galit', role: 'Gameplay engineer' },
  { name: 'Kean Versoza', role: 'Production, Website Deployment' },
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
          <ul className="about-team about-team--desktop">
            {TEAM_DESKTOP.map((member, index) => (
              <li key={`d-${index}`}>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </li>
            ))}
          </ul>
          <ul className="about-team about-team--mobile">
            {TEAM_MOBILE.map((member, index) => (
              <li key={`m-${index}`}>
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
