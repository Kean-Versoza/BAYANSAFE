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
  const [allScores, setAllScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState('all');
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    document.title = 'Leaderboards | BayanSafe';
    return () => { document.title = 'BayanSafe'; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/scores/leaderboard?limit=1000')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAllScores(Array.isArray(data?.scores) ? data.scores : []);
      })
      .catch(() => { if (!cancelled) setAllScores([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setPage(0); }, [query, searchColumn, sortKey, sortDir]);

  const q = query.trim().toLowerCase();
  const filteredScores = allScores
    .filter((s) => {
      if (!q) return true;
      let haystack = '';
      if (searchColumn === 'player') haystack = String(s.username ?? '');
      else if (searchColumn === 'chapter') haystack = chapterNumber(s.chapter);
      else if (searchColumn === 'level') haystack = levelNumber(s.level);
      else if (searchColumn === 'time') haystack = (s.best_time == null ? '-' : formatTime(s.best_time)) + ' ' + String(s.best_time ?? '');
      else if (searchColumn === 'points') haystack = String(s.score ?? '');
      else haystack = [s.username, chapterNumber(s.chapter), levelNumber(s.level), s.best_time == null ? '-' : formatTime(s.best_time), String(s.best_time ?? ''), s.score].join(' ');
      return haystack.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va, vb;
      if (sortKey === 'player') { va = String(a.username ?? ''); vb = String(b.username ?? ''); }
      else if (sortKey === 'chapter') { va = String(a.chapter ?? ''); vb = String(b.chapter ?? ''); }
      else if (sortKey === 'level') { va = Number((String(a.level ?? '').match(/_(\d+)$/) || [0, 0])[1]) || 0; vb = Number((String(b.level ?? '').match(/_(\d+)$/) || [0, 0])[1]) || 0; }
      else if (sortKey === 'time') { va = a.best_time == null ? Infinity : Number(a.best_time); vb = b.best_time == null ? Infinity : Number(b.best_time); }
      else if (sortKey === 'points') { va = Number(a.score ?? 0); vb = Number(b.score ?? 0); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filteredScores.length / PAGE_SIZE));
  const pageScores = filteredScores.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0 }}>Leaderboards</h1>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <select value={searchColumn} onChange={(e) => setSearchColumn(e.target.value)} style={{ padding: '0.3rem 0.5rem' }}>
                <option value="all">All</option>
                <option value="player">Player</option>
                <option value="chapter">Chapter</option>
                <option value="level">Level</option>
                <option value="time">Best Time</option>
                <option value="points">Points</option>
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                style={{ width: '220px', padding: '0.3rem 0.5rem' }}
              />
              <button
                type="button"
                onClick={() => { setQuery(''); setSearchColumn('all'); }}
                style={{ padding: '0.3rem 0.6rem' }}
              >
                Clear
              </button>
            </div>
          </div>
          <p className="about-lead">Top scores from players around the world.</p>



          {loading ? (
            <p className="about-lead">Loading scores...</p>
          ) : filteredScores.length === 0 ? (
            <p className="about-lead">No scores yet. Be the first!</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      {[
                        { key: 'player', label: 'Player', align: 'left' },
                        { key: 'chapter', label: 'Chapter', align: 'left' },
                        { key: 'level', label: 'Level', align: 'left' },
                        { key: 'time', label: 'Best Time', align: 'left' },
                        { key: 'points', label: 'Points', align: 'right' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          style={{ textAlign: col.align, padding: '0.4rem', cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => {
                            if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                            else { setSortKey(col.key); setSortDir('asc'); }
                          }}
                        >
                          {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageScores.map((s, i) => (
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

              {totalPages > 1 && (
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
            </>
          )}
        </main>
      </div>

      <SiteFooter config={config} />
    </>
  );
}
