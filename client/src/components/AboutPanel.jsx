const DISASTERS = [
  {
    icon: '/images/volcano.png',
    name: 'Volcanic Eruptions',
    items: ['Fire & Thermal hazards'],
  },
  {
    icon: '/images/fire.png',
    name: 'Wild Fires',
    items: ['Rapidly spreading flames'],
  },
  {
    icon: '/images/earthquake.png',
    name: 'Earthquakes',
    items: ['Landslides & terrain collapse', 'Tsunamis & tidal waves'],
  },
  {
    icon: '/images/flood.png',
    name: 'Flash Floods',
    items: ['Evacuation & safety rules'],
  },
  {
    icon: '/images/typhoon.png',
    name: 'Typhoons',
    items: ['Severe flooding response'],
  },
];

const HOW_IT_WORKS = [
  'Enter a disaster scenario',
  'Choose the safest action from multiple options',
  'Get instant feedback explaining choices',
  'Learn the correct safety procedures',
  'Earn points and track your progress',
];

/**
 * The white panel that explains the game.
 */
export default function AboutPanel() {
  return (
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
            {HOW_IT_WORKS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="column">
          <p className="heading">Play Across Multiple Disasters:</p>
          <div className="disaster-grid">
            {DISASTERS.map((disaster) => (
              <div className="disaster" key={disaster.name}>
                <p>
                  <img src={disaster.icon} alt="" className="disaster-icon" /> {disaster.name}
                </p>
                <ul>
                  {disaster.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
