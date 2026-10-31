import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import '../styles/admin.css';

const PAGE_SIZE = 25;

/* The sign in page and the panel have their own addresses, so a signed in
   admin can be linked straight to the panel, and signing in takes you there. */
const SIGN_IN_PATH = '/admin';
const PANEL_PATH = '/admin/dashboard';

/** A small helper for the API calls. */
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A reply that is not JSON means the request never reached the API - the
    // development server was not running, for example - so the status is said
    // out loud instead of a sentence that explains nothing.
    const error = new Error(
      body.error ??
        (res.status >= 500
          ? `The server could not answer (HTTP ${res.status}). Check that the API is running.`
          : `The request failed (HTTP ${res.status}).`),
    );
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
  const navigate = useNavigate();
  const location = useLocation();
  const onPanel = location.pathname.startsWith(PANEL_PATH);

  const [session, setSession] = useState({ known: false, signedIn: false, configured: false });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messageTotal, setMessageTotal] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [search, setSearch] = useState('');
  const [emails, setEmails] = useState([]);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState('users');
  const [refreshing, setRefreshing] = useState(false);

  /* The name of the tab, so the window says which page is open */
  useEffect(() => {
    document.title = 'BayanSafe | Admin';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

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
        body: JSON.stringify({ email, password }),
      });
      setSession((s) => ({ ...s, signedIn: true }));
      setEmail('');
      setPassword('');
      // Straight to the panel.
      navigate(PANEL_PATH, { replace: true });
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
    // Back to the sign in page.
    navigate(SIGN_IN_PATH, { replace: true });
  };

  /* ---- the right page for the session ---- */
  // A signed in admin belongs on the panel, a signed out one on the sign in
  // page. When the two do not match, the other page is on its way.
  useEffect(() => {
    if (!session.known) return;
    if (session.signedIn && !onPanel) {
      navigate(PANEL_PATH, { replace: true });
    } else if (!session.signedIn && onPanel) {
      navigate(SIGN_IN_PATH, { replace: true });
    }
  }, [session.known, session.signedIn, onPanel, navigate]);

  /* ---- loading the dashboard ---- */
  const load = useCallback(async () => {
    const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
    const [statsData, usersData, emailsData, statusData, messagesData] = await Promise.all([
      api('/api/admin/stats'),
      api(`/api/admin/users${query}`),
      api('/api/admin/emails?limit=15'),
      api('/api/admin/status'),
      api('/api/admin/messages?limit=50'),
    ]);
    setStats(statsData);
    setUsers(usersData.users);
    setTotal(usersData.total);
    setEmails(emailsData.emails);
    setStatus(statusData);
    setMessages(messagesData.messages);
    setMessageTotal(messagesData.total);
    setUnreadMessages(messagesData.unread);
  }, [search]);

  useEffect(() => {
    if (!session.signedIn) return;
    load().catch((err) => setMessage({ type: 'error', text: err.message }));
  }, [session.signedIn, load]);

  /* The refresh button in the header: asks the server for everything again. */
  const reload = async () => {
    setRefreshing(true);
    try {
      await load();
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRefreshing(false);
    }
  };

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

  /* ---- a message from the contact form / help center ---- */
  const markMessageRead = async (message) => {
    if (message.is_read) return;

    // Show it as read straight away; the request only makes it stick.
    setMessages((list) =>
      list.map((item) => (item.id === message.id ? { ...item, is_read: true } : item)),
    );
    setUnreadMessages((count) => Math.max(0, count - 1));

    try {
      await api(`/api/admin/messages/${message.id}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
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
  // While the session is being checked, or while the other page is on its
  // way, a short message is shown instead of the wrong screen.
  if (!session.known || onPanel !== session.signedIn) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <p className="admin-login-brand">BAYANSAFE</p>
          <p className="admin-login-hint">One moment...</p>
        </div>
      </div>
    );
  }

  if (!session.signedIn) {
    return (
      <div className="admin-login">
        <form className="admin-login-card" onSubmit={signIn}>
          <p className="admin-login-brand">BAYANSAFE</p>
          <h1>Admin dashboard</h1>
          <p className="admin-login-hint">Sign in to see the accounts and the numbers.</p>

          {!session.configured && (
            <p className="admin-login-error">
              No admin email or password is set. Add <code>ADMIN_EMAIL</code> and{' '}
              <code>ADMIN_PASSWORD</code> to <code>.env</code>.
            </p>
          )}

          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="admin-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

  /* The numbers at the top of the page. The tone gives each one its colour. */
  const tiles = [
    { label: 'Accounts', value: stats?.totals.accounts, tone: 'brand' },
    { label: 'New today', value: stats?.totals.today, tone: 'ok' },
    { label: 'New this week', value: stats?.totals.week, tone: 'sky' },
    { label: 'Cards linked', value: stats?.totals.cards, tone: 'violet' },
    { label: 'Emails sent', value: stats?.totals.emails, tone: 'teal' },
    { label: 'Emails failed', value: stats?.totals.emails_failed, tone: 'bad' },
  ];

  return (
    <div className="admin">
      <header className="admin-header">
        <div className="admin-header-brand">
          <p className="admin-brand">BAYANSAFE</p>
          <div className="admin-header-text">
            <h1>Admin dashboard</h1>
            <p className="admin-subtitle">Accounts, cards, messages and email — all in one place.</p>
          </div>
        </div>

        <div className="admin-header-actions">
          <span className={`admin-live${status && !status.database.ok ? ' is-down' : ''}`}>
            <span className="admin-live-dot" />
            {status && !status.database.ok ? 'Database offline' : 'Live'}
          </span>
          <button
            type="button"
            className="admin-button admin-button--ghost"
            onClick={reload}
            disabled={refreshing}
          >
            {refreshing ? 'REFRESHING...' : 'REFRESH'}
          </button>
          <button type="button" className="admin-button" onClick={signOut}>
            SIGN OUT
          </button>
        </div>
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
        {tiles.map((tile) => (
          <div className={`admin-tile admin-tile--${tile.tone}`} key={tile.label}>
            <span className="admin-tile-value">{tile.value ?? '-'}</span>
            <span className="admin-tile-label">{tile.label}</span>
          </div>
        ))}
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
          className={tab === 'messages' ? 'is-active' : ''}
          onClick={() => setTab('messages')}
        >
          Messages ({messageTotal})
          {unreadMessages > 0 && <span className="admin-tab-badge">{unreadMessages}</span>}
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
                    <button
                      type="button"
                      className="admin-action--danger"
                      onClick={() => removeUser(user)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'messages' && (
        <section className="admin-panel">
          <div className="admin-toolbar">
            <span className="admin-toolbar-count">
              {messageTotal} message(s) &middot; {unreadMessages} unread
            </span>
          </div>

          <div className="admin-messages">
            {messages.length === 0 && <p className="admin-empty">No messages yet.</p>}

            {messages.map((item) => (
              <details
                key={item.id}
                className={`admin-message-item${item.is_read ? '' : ' is-unread'}`}
                onToggle={(event) => {
                  if (event.currentTarget.open) markMessageRead(item);
                }}
              >
                <summary className="admin-message-head">
                  <span className="admin-message-from">
                    <strong>{item.name}</strong>
                    <span>{item.email}</span>
                  </span>

                  <span className="admin-message-subject">
                    {item.subject || '(no subject)'}
                  </span>

                  <span className="admin-message-meta">
                    <span className={`admin-tag ${item.source === 'help' ? 'is-help' : 'is-ok'}`}>
                      {item.source === 'help' ? 'Help Center' : 'Contact us'}
                    </span>
                    {!item.is_read && <span className="admin-tag is-new">New</span>}
                    <span className="admin-muted">{formatDate(item.created_at)}</span>
                  </span>
                </summary>

                <p className="admin-message-body">{item.message}</p>

                <a
                  className="admin-message-reply"
                  href={`mailto:${item.email}?subject=${encodeURIComponent(
                    `Re: ${item.subject || 'Your message to BayanSafe'}`,
                  )}`}
                >
                  Reply by email
                </a>
              </details>
            ))}
          </div>
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
