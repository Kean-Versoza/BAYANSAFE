import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import NavPill from '../components/NavPill';
import SiteFooter from '../components/SiteFooter';
import AccountSignIn from '../components/AccountSignIn';
import AccountDetails from '../components/AccountDetails';
import { useAccount } from '../hooks/useAccount';
import { useSiteConfig } from '../hooks/useSiteConfig';
import {
  LEAVE_DELAY,
  MIN_SHOW,
  NAV_LOADER_MS,
  SHOW_LOADER_ON_NAV,
  buildSkeleton,
} from '../lib/skeleton';

/**
 * The account page of the player.
 *
 * It shows the account of the player that is signed in, and everything that
 * can be changed about it. It has the same look as the rest of the site.
 */
export default function AccountPage() {
  const config = useSiteConfig();
  const skeletonRef = useRef(null);
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

  const showSkeleton = useCallback(() => {
    const skeleton = skeletonRef.current;
    if (!skeleton) return;
    buildSkeleton(skeleton, 'account');
    skeleton.classList.add('is-active');
  }, []);

  const hideSkeleton = useCallback(() => {
    skeletonRef.current?.classList.remove('is-active');
  }, []);

  useEffect(() => {
    if (!SHOW_LOADER_ON_NAV) return undefined;
    const nav = document.querySelector('.nav-pill');
    if (!nav) return undefined;

    const handler = (event) => {
      const anchor = event.target.closest('a');
      if (!anchor || !nav.contains(anchor)) return;
      const href = anchor.getAttribute('href') || '';
      const to = anchor.getAttribute('to');
      // Only show the loader when jumping to other pages/sections, not staying on account
      if (to === '/account' || href.endsWith('/account')) return;
      if (skeletonRef.current) {
        showSkeleton();
        window.setTimeout(hideSkeleton, NAV_LOADER_MS);
      }
    };

    nav.addEventListener('click', handler);
    return () => nav.removeEventListener('click', handler);
  }, [showSkeleton, hideSkeleton]);

  useEffect(() => {
    if (known) return undefined;
    let shownAt = 0;
    let timer;
    if (SHOW_LOADER_ON_NAV && skeletonRef.current) {
      showSkeleton();
      shownAt = Date.now();
    }
    return () => {
      const wait = Math.max(0, MIN_SHOW - (Date.now() - shownAt));
      timer = window.setTimeout(hideSkeleton, wait);
    };
  }, [known, showSkeleton, hideSkeleton]);

  return (
    <>
      <div ref={skeletonRef} className="page-skeleton" aria-hidden="true" />
      <NavPill items={config.nav} active="account" />

      <section id="account" className="section frame frame-inner account-frame">
        <div className="section-top section-top--logo">
          <Link className="logo" to="/" aria-label="Back to BAYANSAFE">
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
