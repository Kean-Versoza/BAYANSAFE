import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useFooter from '../hooks/useFooter';

const COOKIE_KEY = 'bayansafe_cookie_ok';

/**
 * Cookie bar pinned to the bottom of the screen.
 * Stays hidden once someone clicks OK (stored in localStorage) and lifts the
 * taglines by publishing its height as the `--cookie-h` custom property.
 */
export default function CookieBanner() {
  const { cookie } = useFooter();
  const bannerRef = useRef(null);
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(COOKIE_KEY);
    } catch {
      return true;
    }
  });

  // Report the bar's height so CSS can keep the taglines above it
  useEffect(() => {
    if (!visible) {
      document.body.classList.remove('cookie-open');
      return undefined;
    }

    const measure = () => {
      const height = bannerRef.current ? bannerRef.current.offsetHeight : 0;
      document.documentElement.style.setProperty('--cookie-h', `${height}px`);
      document.body.classList.add('cookie-open');
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [visible]);

  const accept = () => {
    setVisible(false);
    try {
      localStorage.setItem(COOKIE_KEY, '1');
    } catch {
      /* storage disabled: the bar simply reappears next visit */
    }
    document.body.classList.remove('cookie-open');
  };

  if (!cookie.show || !visible) return null;

  const internal = cookie.link_url.startsWith('/');

  return (
    <div className="cookie-banner" id="cookieBanner" role="region" aria-label="Cookie notice" ref={bannerRef}>
      <p>
        {cookie.text}{' '}
        {internal ? (
          <Link to={cookie.link_url}>{cookie.link_label}</Link>
        ) : (
          <a href={cookie.link_url}>{cookie.link_label}</a>
        )}
        .
      </p>
      <button type="button" id="cookieOk" onClick={accept}>
        {cookie.button}
      </button>
    </div>
  );
}
