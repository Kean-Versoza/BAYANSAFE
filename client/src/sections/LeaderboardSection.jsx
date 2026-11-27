import { useEffect, useState } from 'react';

function chapterNumber(chapter) {
  if (!chapter) return '-';
  const c = String(chapter).toLowerCase();
  if (c === 'prologue') return '1';
  const m = c.match(/chapter_(\d+)/);
  if (m) return String(Number(m[1]) + 1);
  if (c.includes('final')) return '7';
  return chapter;
}

function formatTime(seconds) {
  if (seconds == null) return '-';
  const s = Number(seconds);
  if (!Number.isFinite(s)) return '-';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Player</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Chapter</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Level</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem' }}>Best Time</th>
                  <th style={{ textAlign: 'right', padding: '0.4rem' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '0.4rem' }}>{s.username}</td>
                    <td style={{ padding: '0.4rem' }}>{chapterNumber(s.chapter)}</td>
                    <td style={{ padding: '0.4rem' }}>{s.level || '-'}</td>
                    <td style={{ padding: '0.4rem' }}>{formatTime(s.best_time)}</td>
                    <td style={{ padding: '0.4rem', textAlign: 'right' }}>{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
