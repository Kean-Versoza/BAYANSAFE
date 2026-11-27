import { useEffect, useState } from 'react';

/** Leaderboards view: top scores shared across all players and devices. */
export default function LeaderboardSection({ onJump }) {
  const logoClick = (event) => {
    event.preventDefault();
    onJump('home');
  };

  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scores/leaderboard?limit=20')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setScores(Array.isArray(data?.scores) ? data.scores : []);
      })
      .catch(() => {
        if (!cancelled) setScores([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="leaderboard" className="section frame frame-inner">
      <div className="section-top section-top--logo">
        <a className="logo" href="#home" onClick={logoClick}>
          <img src="/images/logo.png" alt="BAYANSAFE" />
        </a>
      </div>

      <div className="panel">
        <h1 className="about-lead" style={{ textAlign: 'center' }}>LEADERBOARDS</h1>
        <p className="about-lead" style={{ textAlign: 'center' }}>
          Top scores from players around the world.
        </p>

        {loading ? (
          <p className="about-lead" style={{ textAlign: 'center' }}>Loading scores...</p>
        ) : scores.length === 0 ? (
          <p className="about-lead" style={{ textAlign: 'center' }}>No scores yet. Be the first!</p>
        ) : (
          <ol className="about-team" style={{ listStyle: 'decimal', paddingLeft: '1.5rem' }}>
            {scores.map((s, i) => (
              <li key={i}>
                <strong>{s.username}</strong>
                <span>{s.score} pts {s.level ? `· ${s.level}` : ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
