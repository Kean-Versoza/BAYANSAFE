import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import '../styles/admin.css';

const PAGE_SIZE = 25;

/** A small helper for the API calls. */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body.error ?? 'Something went wrong.');
    error.status = res.status;
    throw error;
  }
  return body;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPage() {
  const [session, setSession] = useState({ known: false, signedIn: false, configured: false });
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [emails, setEmails] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('users');

  /* ---- signing in ---- */
  useEffect(() => {
    api('/api/admin/session')
      .then((data) => setSession({ known: true, ...data }))
      .catch(() => setSession({ known: true, signedIn: false, configured: false }));
  }, []);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setLoginError('');
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setSession((s) => ({ ...s, signedIn: true }));
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setSession((s) => ({ ...s, signedIn: false }));
    setStats(null);
    setUsers([]);
    setEmails([]);
  };

  /* ---- loading the dashboard ---- */
  const load = useCallback(async () => {
    const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
    const [statsData, usersData, emailsData, statusData] = await Promise.all([
      api('/api/admin/stats'),
      api(`/api/admin/users${query}`),
      api('/api/admin/emails?limit=15'),
      api('/api/admin/status'),
    ]);
    setStats(statsData);
    setUsers(usersData.users);
    setTotal(usersData.total);
    setEmails(emailsData.emails);
    setStatus(statusData);
  }, [search]);

  useEffect(() => {
    if (!session.signedIn) return;
    load().catch((err) => setMessage({ type: 'error', text: err.message }));
  }, [session.signedIn, load]);

  const removeUser = async (user) => {
    const sure = window.confirm(
      `Remove the account "${user.username}" (${user.email})?\n\nThis cannot be undone.`,
    );
    if (!sure) return;

    try {
      await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      setMessage({ type: 'ok', text: `${user.username} was removed.` });
      load().catch(() => {});
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  /* ---- the card of a player ---- */
  const setCard = async (user) => {
    const answer = window.prompt(
      `Card number for ${user.username}:\n\nLeave it empty to take the card away.`,
      user.rfidUid ?? '',
    );
    if (answer === null) return;

    try {
      const body = await api(`/api/admin/users/${user.id}/card`, {
        method: 'PATCH',
        body: JSON.stringify({ card: answer.trim() }),
      });
      setMessage({ type: 'ok', text: body.message });
      load().catch(() => {});
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  /* ---- the sign in screen ---- */
  if (session.known && !session.signedIn) {
    return (
      <div className="admin-login">
        <form className="admin-login-card" onSubmit={signIn}>
          <p className="admin-login-brand">BAYANSAFE</p>
          <h1>Admin dashboard</h1>
          <p className="admin-login-hint">Sign in to see the accounts and the numbers.</p>

          {!session.configured && (
            <p className="admin-login-error">
              No admin password is set. Add <code>ADMIN_PASSWORD</code> to <code>server/.env</code>.
            </p>
          )}

          <label className="admin-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>

          {loginError && <p className="admin-login-error">{loginError}</p>}

          <button type="submit" className="admin-button" disabled={busy || !session.configured}>
            {busy ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          <Link className="admin-login-back" to="/">
            &larr; Back to the site
          </Link>
        </form>
      </div>
    );
  }

  /* ---- the dashboard ---- */
  const max = Math.max(1, ...(stats?.chart ?? []).map((d) => d.count));

  return (
    <div className="admin">
      <header className="admin-header">
        <div>
          <p className="admin-brand">BAYANSAFE</p>
          <h1>Admin dashboard</h1>
        </div>
        <button type="button" className="admin-button admin-button--ghost" onClick={signOut}>
          SIGN OUT
        </button>
      </header>

      {message && (
        <p className={`admin-message admin-message--${message.type}`}>
          {message.text}
          <button type="button" onClick={() => setMessage(null)}>
            x
          </button>
        </p>
      )}

      <section className="admin-tiles">
        <div className="admin-tile">
          <span className="admin-tile-value">{stats?.totals.accounts ?? '-'}</span>
          <span className="admin-tile-label">Accounts</span>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-value">{stats?.totals.today ?? '-'}</span>
          <span className="admin-tile-label">New today</span>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-value">{stats?.totals.week ?? '-'}</span>
          <span className="admin-tile-label">New this week</span>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-value">{stats?.totals.cards ?? '-'}</span>
          <span className="admin-tile-label">Cards linked</span>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-value">{stats?.totals.emails ?? '-'}</span>
          <span className="admin-tile-label">Emails sent</span>
        </div>
        <div className="admin-tile">
          <span className="admin-tile-value">{stats?.totals.emails_failed ?? '-'}</span>
          <span className="admin-tile-label">Emails failed</span>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-panel admin-panel--chart">
          <h2>New accounts, last 14 days</h2>
          <div className="admin-chart">
            {(stats?.chart ?? []).map((day, index) => (
              <div className="admin-chart-col" key={day.day} title={`${day.day}: ${day.count}`}>
                <div className="admin-chart-bar" style={{ height: `${(day.count / max) * 100}%` }} />
                <span className="admin-chart-count">{day.count || ''}</span>
                {/* every other label, so they do not crowd each other */}
                <span className="admin-chart-day">{index % 2 === 0 ? day.day.slice(8) : ''}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <h2>System</h2>
          <ul className="admin-status">
            <li>
              <span className={`admin-dot ${status?.database.ok ? 'is-ok' : 'is-bad'}`} />
              <div>
                <strong>Database</strong>
                <p>{status?.database.message ?? '...'}</p>
                {status?.database.version && <small>PostgreSQL {status.database.version}</small>}
              </div>
            </li>
            <li>
              <span className={`admin-dot ${status?.mail.ok ? 'is-ok' : 'is-bad'}`} />
              <div>
                <strong>Email ({status?.mail.provider ?? '-'})</strong>
                <p>{status?.mail.message ?? '...'}</p>
                {status?.mail.recipient && <small>To {status.mail.recipient}</small>}
              </div>
            </li>
          </ul>
        </section>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={tab === 'users' ? 'is-active' : ''}
          onClick={() => setTab('users')}
        >
          Accounts ({total})
        </button>
        <button
          type="button"
          className={tab === 'emails' ? 'is-active' : ''}
          onClick={() => setTab('emails')}
        >
          Email log
        </button>
      </div>

      {tab === 'users' && (
        <section className="admin-panel">
          <div className="admin-toolbar">
            <input
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="admin-toolbar-count">{total} account(s)</span>
          </div>

          <table className="admin-table admin-table--users">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Card</th>
                <th>Registered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    No accounts yet.
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="admin-strong">{user.username}</td>
                  <td>{user.email}</td>
                  <td className="admin-card">{user.rfidUid ?? '-'}</td>
                  <td className="admin-muted">{formatDate(user.createdAt)}</td>
                  <td className="admin-actions">
                    <button type="button" onClick={() => setCard(user)}>
                      Card
                    </button>
                    <button type="button" onClick={() => removeUser(user)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'emails' && (
        <section className="admin-panel">
          <table className="admin-table admin-table--emails">
            <thead>
              <tr>
                <th>To</th>
                <th>Subject</th>
                <th>Kind</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {emails.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    No emails yet.
                  </td>
                </tr>
              )}
              {emails.map((mail) => (
                <tr key={mail.id}>
                  <td className="admin-strong">{mail.to_address}</td>
                  <td>{mail.subject}</td>
                  <td>
                    <span className={`admin-tag ${mail.ok ? 'is-ok' : 'is-bad'}`}>
                      {mail.ok ? mail.kind : 'failed'}
                    </span>
                  </td>
                  <td className="admin-muted">{formatDate(mail.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="admin-footer">
        <Link to="/">&larr; Back to the site</Link>
      </footer>
    </div>
  );
}
