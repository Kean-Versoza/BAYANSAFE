import { Link } from 'react-router-dom';

import PixelAvatar from './PixelAvatar';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The head of the account page of a player that is signed in.
 *
 * It is the "you are in" panel of the page: the face of the player, the name,
 * and a few numbers that say how the account is doing. The card of the RFID
 * reader is one of them, because a player without a card still gets a full
 * account, and the panel says so instead of looking empty.
 */
export default function AccountBanner({ user, onSignOut }) {
  const linked = Boolean(user.card);

  const stats = [
    { label: 'PLAYER #', value: user.number, tone: 'number' },
    { label: 'MEMBER SINCE', value: formatDate(user.createdAt) },
    {
      label: 'LAST SIGN IN',
      value: user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Your first time here',
    },
    {
      label: 'RFID CARD',
      value: linked ? user.card : 'NOT LINKED YET',
      tone: linked ? 'good' : 'warn',
      action: linked ? null : { label: 'ADD ONE', href: '#account-card' },
    },
  ];

  return (
    <header className="account-banner">
      <div className="account-banner-top">
        <PixelAvatar name={user.username} size={84} />

        <div className="account-banner-text">
          <p className="account-kicker">WELCOME BACK</p>
          <h1 className="account-name">{user.username}</h1>
          <p className="account-banner-meta">
            Player {user.number} · Playing since {formatDate(user.createdAt)}
          </p>
        </div>

        <div className="account-banner-actions">
          <Link className="account-play" to="/">
            PLAY THE GAME
          </Link>
          <button type="button" className="account-signout" onClick={onSignOut}>
            SIGN OUT
          </button>
        </div>
      </div>

      <ul className="account-stats">
        {stats.map((stat) => (
          <li
            key={stat.label}
            className={`account-stat${stat.tone ? ` account-stat--${stat.tone}` : ''}`}
          >
            <span className="account-stat-label">{stat.label}</span>
            <span className="account-stat-value">{stat.value}</span>
            {stat.action && (
              <a className="account-stat-action" href={stat.action.href}>
                {stat.action.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </header>
  );
}
