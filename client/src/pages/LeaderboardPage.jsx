import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavPill from '../components/NavPill';
import SiteFooter from '../components/SiteFooter';
import { useSiteConfig } from '../hooks/useSiteConfig';

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

export default function LeaderboardPage() {
  const config = useSiteConfig();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Leaderboards | BayanSafe';
    return () => { document.title = 'BayanSafe'; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scores/leaderboard?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setScores(Array.isArray(data?.scores) ? data.scores : []);
      })
      .catch(() => { if (!cancelled) setScores([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <NavPill items={config.nav} active="leaderboard" />

      <div className="frame frame-inner about-page-frame">
        <header className="about-top">
          <Link className="about-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src="/images/logo.png" alt="BAYANSAFE" />
          </Link>
        </header>

        <main className="panel about-panel">
          <h1>Leaderboards</h1>
          <p className="about-lead">Top scores from players around the world.</p>

          {loading ? (
            <p className="about-lead">Loading scores...</p>
          ) : scores.length === 0 ? (
            <p className="about-lead">No scores yet. Be the first!</p>
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
        </main>
      </div>

      <SiteFooter config={config} />
    </>
  );
}
