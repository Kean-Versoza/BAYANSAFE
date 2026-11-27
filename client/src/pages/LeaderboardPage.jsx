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

function levelNumber(level) {
  if (!level) return '-';
  const s = String(level);
  const m = s.match(/_(\d+)$/);
  if (m) return String(Number(m[1]) + 1);
  const m2 = s.match(/level_(\d+)/);
  if (m2) return m2[1];
  return level;
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
  const PAGE_SIZE = 10;
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ player: '', chapter: '', level: '', time: '', points: '' });

  useEffect(() => {
    document.title = 'Leaderboards | BayanSafe';
    return () => { document.title = 'BayanSafe'; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/scores/leaderboard?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setScores(Array.isArray(data?.scores) ? data.scores : []);
        setTotal(Number(data?.total) || 0);
      })
      .catch(() => { if (!cancelled) setScores([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredScores = scores.filter((s) => {
    const player = String(s.username ?? '').toLowerCase();
    const chapter = String(s.chapter ?? '').toLowerCase();
    const level = String(s.level ?? '').toLowerCase();
    const time = s.best_time == null ? '' : String(s.best_time);
    const points = String(s.score ?? '');
    if (filters.player && !player.includes(filters.player.toLowerCase())) return false;
    if (filters.chapter && !chapter.includes(filters.chapter.toLowerCase())) return false;
    if (filters.level && !level.includes(filters.level.toLowerCase())) return false;
    if (filters.time && !time.includes(filters.time)) return false;
    if (filters.points && !points.includes(filters.points)) return false;
    return true;
  });

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
                <tr>
                  <th style={{ padding: '0.2rem' }}>
                    <input value={filters.player} onChange={(e) => setFilters((f) => ({ ...f, player: e.target.value }))} placeholder="filter" style={{ width: '100%' }} />
                  </th>
                  <th style={{ padding: '0.2rem' }}>
                    <input value={filters.chapter} onChange={(e) => setFilters((f) => ({ ...f, chapter: e.target.value }))} placeholder="filter" style={{ width: '100%' }} />
                  </th>
                  <th style={{ padding: '0.2rem' }}>
                    <input value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} placeholder="filter" style={{ width: '100%' }} />
                  </th>
                  <th style={{ padding: '0.2rem' }}>
                    <input value={filters.time} onChange={(e) => setFilters((f) => ({ ...f, time: e.target.value }))} placeholder="filter" style={{ width: '100%' }} />
                  </th>
                  <th style={{ padding: '0.2rem' }}>
                    <input value={filters.points} onChange={(e) => setFilters((f) => ({ ...f, points: e.target.value }))} placeholder="filter" style={{ width: '100%' }} />
                  </th>
                </tr>
              </thead>
                <tbody>
                  {filteredScores.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.4rem' }}>{s.username}</td>
                      <td style={{ padding: '0.4rem' }}>{chapterNumber(s.chapter)}</td>
                      <td style={{ padding: '0.4rem' }}>{levelNumber(s.level)}</td>
                      <td style={{ padding: '0.4rem' }}>{formatTime(s.best_time)}</td>
                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setPage(i)}
                  style={{ fontWeight: i === page ? 'bold' : 'normal' }}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Next
              </button>
            </div>
          )}
        </main>
      </div>

      <SiteFooter config={config} />
    </>
  );
}
