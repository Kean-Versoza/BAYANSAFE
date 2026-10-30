import { useEffect, useState } from 'react';

import PixelAvatar from './PixelAvatar.jsx';
import RfidEnrollment from './RfidEnrollment.jsx';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The account of the player.
 *
 * Everything the player can change about the account lives here: the name,
 * the email, the RFID card enrollment, the password, and the removal of
 * the account.
 */
export default function AccountDetails({ user, onSaveDetails, onSavePassword, onRemove, onSignOut }) {
  const [name, setName] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [detailsMessage, setDetailsMessage] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [removing, setRemoving] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [removeMessage, setRemoveMessage] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // The account of the server is the truth: it is filled in again after a change
  useEffect(() => {
    setName(user.username);
    setEmail(user.email);
  }, [user]);

  /* ---- the name and the email ---- */
  const saveDetails = async (event) => {
    event.preventDefault();
    setDetailsMessage(null);
    setDetailsBusy(true);

    try {
      const data = await onSaveDetails({ username: name.trim(), email: email.trim() });
      setDetailsMessage({ type: 'ok', text: data.message });
    } catch (err) {
      setDetailsMessage({ type: 'error', text: err.message });
    } finally {
      setDetailsBusy(false);
    }
  };

  /* ---- the password ---- */
  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== repeatPassword) {
      setPasswordMessage({ type: 'error', text: 'The two new passwords are not the same.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Please use a password of at least 8 characters.' });
      return;
    }

    setPasswordBusy(true);
    try {
      const data = await onSavePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setPasswordMessage({ type: 'ok', text: data.message });
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordBusy(false);
    }
  };

  /* ---- removing the account ---- */
  const removeAccount = async (event) => {
    event.preventDefault();
    setRemoveMessage(null);
    setRemoveBusy(true);

    try {
      await onRemove(removePassword);
    } catch (err) {
      setRemoveMessage({ type: 'error', text: err.message });
      setRemoveBusy(false);
    }
  };

  /* ---- a copy of the account for the player ---- */
  const downloadData = () => {
    const blob = new Blob(
      [JSON.stringify({ ...user, note: 'This is the data BayanSafe keeps about you.' }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bayansafe-${user.number}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="account-card">
      {/* ---------- the head of the card ---------- */}
      <header className="account-head">
        <PixelAvatar name={user.username} />

        <div className="account-head-text">
          <p className="form-title">MY ACCOUNT</p>
          <p className="account-number">{user.number}</p>
          <p className="account-meta">
            Playing since {formatDate(user.createdAt)}
            {user.lastLoginAt ? ` \u00b7 Last sign in ${formatDate(user.lastLoginAt)}` : ''}
          </p>
        </div>

        <button type="button" className="account-signout" onClick={onSignOut}>
          SIGN OUT
        </button>
      </header>

      {/* ---------- the name and the email ---------- */}
      <section className="account-section account-section--details">
        <h2>ACCOUNT DETAILS</h2>

        <form className="account-form" onSubmit={saveDetails}>
          <label className="account-field">
            <span>ACCOUNT NAME</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={3}
              maxLength={32}
              required
              autoComplete="username"
            />
          </label>

          <label className="account-field">
            <span>EMAIL ADDRESS</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <div className="account-actions">
            <button type="submit" className="btn-submit" disabled={detailsBusy}>
              {detailsBusy ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
            <button type="button" className="account-link" onClick={downloadData}>
              Download my data
            </button>
          </div>

          {detailsMessage && (
            <p className={`form-status form-status--${detailsMessage.type}`}>{detailsMessage.text}</p>
          )}
        </form>
      </section>

      {/* ---------- RFID card enrollment ---------- */}
      <RfidEnrollment user={user} />

      {/* ---------- the password ---------- */}
      <section className="account-section account-section--password">
        <h2>PASSWORD</h2>
        <p className="account-hint">
          Your password is kept as a hash, so it cannot be shown. You can always set a new one.
        </p>

        <form className="account-form" onSubmit={savePassword}>
          <label className="account-field">
            <span>CURRENT PASSWORD</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          <label className="account-field">
            <span>NEW PASSWORD</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>

          <label className="account-field">
            <span>REPEAT THE NEW PASSWORD</span>
            <input
              type="password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>

          <div className="account-actions">
            <button type="submit" className="btn-submit" disabled={passwordBusy}>
              {passwordBusy ? 'SAVING...' : 'CHANGE PASSWORD'}
            </button>
          </div>

          {passwordMessage && (
            <p className={`form-status form-status--${passwordMessage.type}`}>{passwordMessage.text}</p>
          )}
        </form>
      </section>

      {/* ---------- removing the account ---------- */}
      <section className="account-section account-danger account-section--danger">
        <h2>DANGER ZONE</h2>
        <p className="account-hint">
          Removing the account takes away your name, your email and your card. It cannot be undone.
        </p>

        {!removing ? (
          <div className="account-actions">
            <button type="button" className="btn-danger" onClick={() => setRemoving(true)}>
              REMOVE MY ACCOUNT
            </button>
          </div>
        ) : (
          <form className="account-form" onSubmit={removeAccount}>
            <label className="account-field">
              <span>YOUR PASSWORD</span>
              <input
                type="password"
                value={removePassword}
                onChange={(event) => setRemovePassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <div className="account-actions">
              <button type="submit" className="btn-danger" disabled={removeBusy}>
                {removeBusy ? 'REMOVING...' : 'YES, REMOVE MY ACCOUNT'}
              </button>
              <button type="button" className="account-link" onClick={() => { setRemoving(false); setRemoveMessage(null); }}>
                Keep my account
              </button>
            </div>

            {removeMessage && (
              <p className={`form-status form-status--${removeMessage.type}`}>{removeMessage.text}</p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}