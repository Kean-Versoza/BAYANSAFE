import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const COOKIE_KEY = 'bayansafe_cookie_ok';

function alreadyAccepted() {
  try {
    return !!localStorage.getItem(COOKIE_KEY);
  } catch {
    return false;
  }
}

/**
 * The bar at the bottom of the screen. It stays hidden after someone clicks OK.
 *
 * The bar always stays in the page (it is only hidden), because the loader
 * measures it to draw the matching grey block.
 */
export default function CookieBanner({ config }) {
  const { cookie } = config;
  const [accepted, setAccepted] = useState(() => alreadyAccepted());
  const hidden = !cookie.show || accepted;

  // Keeps the page from hiding content behind the bar
  useEffect(() => {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return undefined;

    const setSpace = () => {
      if (banner.hidden) {
        document.body.classList.remove('cookie-open');
        return;
      }
      document.documentElement.style.setProperty('--cookie-h', `${banner.offsetHeight}px`);
      document.body.classList.add('cookie-open');
    };

    setSpace();
    window.addEventListener('resize', setSpace);
    return () => window.removeEventListener('resize', setSpace);
  }, [hidden]);

  const accept = () => {
    setAccepted(true);
    try {
      localStorage.setItem(COOKIE_KEY, '1');
    } catch {
      /* the browser does not allow saving, the bar comes back next time */
    }
  };

  return (
    <div className="cookie-banner" id="cookieBanner" role="region" aria-label="Cookie notice" hidden={hidden}>
      <p>
        {cookie.text} <Link to={cookie.linkUrl}>{cookie.linkLabel}</Link>.
      </p>
      <button type="button" id="cookieOk" onClick={accept}>
        {cookie.button}
      </button>
    </div>
  );
}
