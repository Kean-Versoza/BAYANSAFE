import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import NavPill from '../components/NavPill.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import AccountSignIn from '../components/AccountSignIn.jsx';
import AccountDetails from '../components/AccountDetails.jsx';
import RfidEnrollment from '../components/RfidEnrollment.jsx';
import { useAccount } from '../hooks/useAccount.js';
import { useSiteConfig } from '../hooks/useSiteConfig.js';

/**
 * The account page of the player.
 *
 * It shows the account of the player that is signed in, and everything that
 * can be changed about it. It has the same look as the rest of the site.
 */
export default function AccountPage() {
  const config = useSiteConfig();
  const {
    user,
    known,
    busy,
    signIn,
    signOut,
    saveDetails,
    savePassword,
    saveCard,
    removeAccount,
  } = useAccount();

  useEffect(() => {
    document.title = 'My Account | BayanSafe';
    return () => {
      document.title = 'BayanSafe';
    };
  }, []);

  return (
    <>
      <NavPill items={config.nav} active="account" />

      <section id="account" className="section frame frame-inner account-frame">
        <div className="account-top">
          <Link className="account-logo" to="/" aria-label="Back to BAYANSAFE">
            <img src={config.brand.logo} alt={config.brand.name} />
          </Link>
        </div>

        <div className="register-page account-page">
          {user ? (
            <AccountDetails
              user={user}
              onSaveDetails={saveDetails}
              onSavePassword={savePassword}
              onSaveCard={saveCard}
              onRemove={removeAccount}
              onSignOut={signOut}
            />
          ) : (
            <AccountSignIn onSignIn={signIn} busy={busy} />
          )}

          {!known && <p className="account-loading">Loading your account...</p>}
        </div>
      </section>

      <SiteFooter config={config} />
    </>
  );
}
