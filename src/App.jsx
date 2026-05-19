import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from './components/Header';
import IntroGuide from './components/IntroGuide';
import DesktopHint from './components/DesktopHint';
import CookieConsent from './components/CookieConsent';
import PolicyGate from './components/PolicyGate';
import { AuthProvider } from './auth/AuthContext';
import { DistrictSkeleton, ListSkeleton, ProfileSkeleton, GenericPageSkeleton } from './components/Skeletons';

const DistrictView = React.lazy(() => import('./components/DistrictView'));
const CandidateList = React.lazy(() => import('./components/CandidateList'));
const CandidateProfile = React.lazy(() => import('./components/CandidateProfile'));
const AccountPage = React.lazy(() => import('./pages/AccountPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const NewsPage = React.lazy(() => import('./pages/NewsPage'));

const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  React.useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  }, [pathname]);

  return null;
};

function App() {
  const [theme, setTheme] = React.useState(() => {
    try {
      return localStorage.getItem('theme') || 'light';
    } catch (e) {
      return 'light';
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // safe fallback
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <div className={`app-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
          <Header theme={theme} toggleTheme={toggleTheme} />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/district" replace />} />
              <Route path="/district" element={
                <Suspense fallback={<DistrictSkeleton />}>
                  <DistrictView />
                </Suspense>
              } />
              <Route path="/list" element={
                <Suspense fallback={<ListSkeleton />}>
                  <CandidateList />
                </Suspense>
              } />
              <Route path="/news" element={
                <Suspense fallback={<GenericPageSkeleton />}>
                  <NewsPage />
                </Suspense>
              } />
              <Route path="/profile/:id" element={
                <Suspense fallback={<ProfileSkeleton />}>
                  <CandidateProfile />
                </Suspense>
              } />
              <Route path="/account" element={
                <Suspense fallback={<GenericPageSkeleton />}>
                  <AccountPage />
                </Suspense>
              } />
              <Route path="/privacy" element={
                <Suspense fallback={<GenericPageSkeleton />}>
                  <PrivacyPage />
                </Suspense>
              } />
              <Route path="/terms" element={
                <Suspense fallback={<GenericPageSkeleton />}>
                  <TermsPage />
                </Suspense>
              } />
            </Routes>
          </main>

          <FloatingNav />
          <IntroGuide />
          <DesktopHint />
          <CookieConsent />
          <PolicyGate />
        </div>
      </Router>
    </AuthProvider>
  );
}

// Separate component for footer to use useLocation/useNavigate


const FloatingNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const viewMode = pathname.includes('/district') ? 'district' :
                   pathname.includes('/list') ? 'list' :
                   pathname.includes('/news') ? 'news' :
                   pathname.includes('/profile') ? 'profile' : '';

  return (
    <div className="floating-nav">
      {[
        { label: 'Map', icon: 'explore', path: '/district', view: 'district' },
        { label: 'List', icon: 'format_list_bulleted', path: '/list', view: 'list' },
        { label: 'News', icon: 'newspaper', path: '/news', view: 'news' },
        { label: 'Compare', icon: 'compare_arrows', path: null, view: null },
        { label: 'Profile', icon: 'account_circle', path: id ? `/profile/${id}` : (pathname.includes('/profile') ? pathname : null), view: 'profile' },
      ].map(({ label, icon, path, view }) => {
        const isActive = viewMode === view;
        return (
          <div
            key={label}
            data-tour={view === 'list' ? 'nav-list' : undefined}
            onClick={() => path && navigate(path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              cursor: path ? 'pointer' : 'default',
              opacity: path ? (isActive ? 1 : 0.5) : 0.1,
              color: isActive ? 'var(--primary)' : 'var(--on-surface)',
              transition: 'all 0.2s'
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", fontSize: '22px' }}
            >
              {icon}
            </span>
            <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default App;

