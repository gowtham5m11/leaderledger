import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import IntroGuide from './components/IntroGuide';
import DesktopHint from './components/DesktopHint';
import ComplianceNotice from './components/ComplianceNotice';
import PolicyGate from './components/PolicyGate';
import { AuthProvider } from './auth/AuthContext';
import { ReactionsProvider } from './reactions/ReactionsContext';
import { NewsReactionsProvider } from './reactions/NewsReactionsContext';
import { useIsMobile } from './hooks/useIsMobile';
import { DistrictSkeleton, ListSkeleton, ProfileSkeleton, GenericPageSkeleton } from './components/Skeletons';
import ErrorBoundary from './components/ErrorBoundary';

const DistrictView = React.lazy(() => import('./components/DistrictView'));
const CandidateList = React.lazy(() => import('./components/CandidateList'));
const CandidateProfile = React.lazy(() => import('./components/CandidateProfile'));
const AccountPage = React.lazy(() => import('./pages/AccountPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const NewsPage = React.lazy(() => import('./pages/NewsPage'));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage'));

// Landing route. Mobile users start on the candidates list (the map is hard
// to use on a small screen — see DesktopHint); desktop users start on the
// district map. useIsMobile resolves synchronously on first render from
// matchMedia, so the redirect picks the right target with no flash.
const HomeRedirect = () => {
  const isMobile = useIsMobile();
  return <Navigate to={isMobile ? '/list' : '/district'} replace />;
};

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
      <ReactionsProvider>
      <NewsReactionsProvider>
      <Router>
        <ScrollToTop />
        <div className={`app-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
          <Header theme={theme} toggleTheme={toggleTheme} />

          <main className="main-content">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
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
                <Route path="/insights" element={
                  <Suspense fallback={<GenericPageSkeleton />}>
                    <InsightsPage />
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
            </ErrorBoundary>
          </main>

          <FloatingNav />
          <IntroGuide />
          <DesktopHint />
          <ComplianceNotice />
          <PolicyGate />
        </div>
      </Router>
      </NewsReactionsProvider>
      </ReactionsProvider>
    </AuthProvider>
  );
}

// Separate component for footer to use useLocation/useNavigate


const FloatingNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const viewMode = pathname.includes('/district') ? 'district' :
                   pathname.includes('/list') ? 'list' :
                   pathname.includes('/news') ? 'news' :
                   pathname.includes('/insights') ? 'insights' : '';

  return (
    <div className="floating-nav">
      {[
        { label: 'Map', icon: 'explore', path: '/district', view: 'district' },
        { label: 'List', icon: 'format_list_bulleted', path: '/list', view: 'list' },
        { label: 'News', icon: 'newspaper', path: '/news', view: 'news' },
        { label: 'Insights', icon: 'insights', path: '/insights', view: 'insights' },
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

