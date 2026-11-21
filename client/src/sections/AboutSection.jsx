const DISASTERS = [
  { icon: '/images/volcano.png', name: 'Volcanic Eruptions', hazards: ['Fire & Thermal hazards'] },
  { icon: '/images/fire.png', name: 'Wild Fires', hazards: ['Rapidly spreading flames'] },
  {
    icon: '/images/earthquake.png',
    name: 'Earthquakes',
    hazards: ['Landslides & terrain collapse', 'Tsunamis & tidal waves'],
  },
  { icon: '/images/flood.png', name: 'Flash Floods', hazards: ['Evacuation & safety rules'] },
  { icon: '/images/typhoon.png', name: 'Typhoons', hazards: ['Severe flooding response'] },
];

const HOW_IT_WORKS = [
  'Enter a disaster scenario',
  'Choose the safest action from multiple options',
  'Get instant feedback explaining choices',
  'Learn the correct safety procedures',
  'Earn points and track your progress',
];

const TEAM = [
  { name: 'Dave Adriano', role: 'Research Software Engineer' },
  { name: 'Mikel Agustin', role: 'Story Editor' },
  { name: 'Joyce Blanza', role: 'Creative director, Character art, Environment art' },
  { name: 'Gino Claveria', role: 'Research Software Engineer' },
  { name: 'James Galit', role: 'Gameplay engineer' },
  { name: 'Amir Pascual', role: 'Hardware engineer' },
  { name: 'Iron Salbador', role: 'Research Software Engineer' },
  { name: 'Jay-el Segarino', role: 'Lead engineer, Gameplay engineer, Animation' },
  { name: 'Ryan Sumndad', role: 'Story Producer' },
  { name: 'Kean Versoza', role: 'Website Production, Website Deployment' },
  { name: 'Cris Villoria', role: 'Research Software Engineer' },
];

/** About view: the story of the game and what it teaches. */
export default function AboutSection({ onJump }) {
  const logoClick = (event) => {
    event.preventDefault();
    onJump('home');
  };

  return (
    <section id="about" className="section frame frame-inner">
      <div className="section-top section-top--logo">
        <a className="logo" href="#home" onClick={logoClick}>
          <img src="/images/logo.png" alt="BAYANSAFE" />
        </a>
      </div>

      <div className="panel">
        <section className="intro-section">
          <p>
            Every Filipino faces the threat of natural disasters. <br />
            Typhoons, earthquakes, floods, volcanic eruptions&mdash;they&rsquo;re part of life here. <br />
            But what do you do when danger strikes?
          </p>
          <br />

          <p>
            BAYANSAFE is a game designed to teach you how to stay safe during disasters. <br />
            Instead of boring textbooks, you&rsquo;ll face interactive scenarios that test your <br />
            real-world disaster knowledge. <br />
            These aren&rsquo;t just questions&mdash;they&rsquo;re skills that could save your life.
          </p>
        </section>
        <br />

        {/* Content split layout to save vertical space */}
        <div className="content-columns">
          <div className="column">
            <p className="heading">How It Works:</p>
            <ul className="features-list">
              {HOW_IT_WORKS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="column">
            <p className="heading">Play Across Multiple Disasters:</p>
            <div className="disaster-grid">
              {DISASTERS.map((disaster) => (
                <div className="disaster" key={disaster.name}>
                  <p>
                    <img src={disaster.icon} alt="" className="disaster-icon" />
                    {disaster.name}
                  </p>
                  <ul>
                    {disaster.hazards.map((hazard) => (
                      <li key={hazard}>{hazard}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 className="about-team-heading">The team</h2>
        <ul className="about-team about-team--desktop">
          {TEAM.map((member, index) => (
            <li key={`d-${index}`}>
              <strong>{member.name}</strong>
              <span>{member.role}</span>
            </li>
          ))}
        </ul>
        <ul className="about-team about-team--mobile">
          {TEAM.map((member, index) => (
            <li key={`m-${index}`}>
              <strong>{member.name}</strong>
              <span>{member.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
