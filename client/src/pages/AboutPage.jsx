import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';

const TEAM = [
  { name: 'Maud Ferris', role: 'Creative director' },
  { name: 'Toby Anand', role: 'Studio lead' },
  { name: 'Sofia Klein', role: 'Lead engineer' },
  { name: 'Jonah Price', role: 'Engine and tools' },
  { name: 'Amara Obi', role: 'Gameplay engineer' },
  { name: 'Ruairi Doyle', role: 'Art director' },
  { name: 'Elsa Berg', role: 'Environment art' },
  { name: 'Kit Nakamura', role: 'Character art' },
  { name: 'Pavel Ruzicka', role: 'Animation' },
  { name: 'Nora Hall', role: 'Audio and music' },
  { name: 'Daniel Oke', role: 'Production' },
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
          <ul className="about-team">
            {TEAM.map((member) => (
              <li key={member.name}>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </li>
            ))}
          </ul>

          <Link className="legal-back" to="/">
            &larr; Back to BAYANSAFE
          </Link>
        </main>

      </div>

      <SiteFooter config={config} />
    </>
  );
}
