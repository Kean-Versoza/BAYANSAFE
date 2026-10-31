import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import AccountPage from './pages/AccountPage';
import AdminPage from './pages/AdminPage';
import HelpPage from './pages/HelpPage';

/** SPA route changes behave like real page loads: start at the top. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return; // in-page anchors handle their own scrolling
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  // index.html starts with data-section="home", and the home page keeps that
  // attribute in step while it scrolls. On any other page it must not stay
  // "home": the stylesheet hides the brand logo for that value, so a reload
  // of /account (or any other page) would make the logo disappear.
  useEffect(() => {
    if (pathname === '/') return;
    const first = pathname.split('/').filter(Boolean)[0] || 'home';
    document.body.dataset.section = first;
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Old addresses still work: they jump to the section on the one page */}
        <Route path="/about" element={<Navigate to="/#about" replace />} />
        <Route path="/registration" element={<Navigate to="/#registration" replace />} />

        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* The account of the player, reached from the ACCOUNT tab */}
        <Route path="/account" element={<AccountPage />} />

        {/* The dashboard for the team */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/dashboard" element={<AdminPage />} />

        {/* The "Send us a message" form on its own page */}
        <Route path="/help" element={<HelpPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
