import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import candidates from './data/candidates.json';
import Header from './components/Header';
import DistrictView from './components/DistrictView';
import CandidateList from './components/CandidateList';
import CandidateProfile from './components/CandidateProfile';
import AccountPage from './pages/AccountPage';
import { AuthProvider } from './auth/AuthContext';

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
  const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'light');

  React.useEffect(() => {
    localStorage.setItem('theme', theme);
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
              <Route path="/district" element={<DistrictView />} />
              <Route path="/list" element={<CandidateList />} />
              <Route path="/profile/:id" element={<CandidateProfile />} />
              <Route path="/account" element={<AccountPage />} />
            </Routes>
          </main>

          <FloatingNav />
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
                   pathname.includes('/profile') ? 'profile' : '';

  return (
    <div className="floating-nav">
      {[
        { label: 'Map', icon: 'explore', path: '/district', view: 'district' },
        { label: 'List', icon: 'format_list_bulleted', path: '/list', view: 'list' },
        { label: 'Compare', icon: 'compare_arrows', path: null, view: null },
        { label: 'Profile', icon: 'account_circle', path: id ? `/profile/${id}` : (pathname.includes('/profile') ? pathname : null), view: 'profile' },
      ].map(({ label, icon, path, view }) => {
        const isActive = viewMode === view;
        return (
          <div
            key={label}
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
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", fontSize: '24px' }}
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

