import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import HomePage from './pages/HomePage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AccountPage from './pages/AccountPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Old addresses still work: they jump to the section on the one page */}
        <Route path="/about" element={<Navigate to={{ pathname: '/', hash: '#about' }} replace />} />
        <Route path="/registration" element={<Navigate to={{ pathname: '/', hash: '#registration' }} replace />} />

        {/* Legal pages (separate pages, no loader) */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* The account of the player */}
        <Route path="/account" element={<AccountPage />} />

        {/* The dashboard for the team */}
        <Route path="/admin" element={<AdminPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
