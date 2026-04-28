import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import DistrictView from './components/DistrictView';
import CandidateList from './components/CandidateList';
import CandidateProfile from './components/CandidateProfile';

function App() {
  const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'light');

  React.useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <Router>
      <div className={`app-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <Header theme={theme} toggleTheme={toggleTheme} />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/district" replace />} />
            <Route path="/district" element={<DistrictView />} />
            <Route path="/list" element={<CandidateList />} />
            <Route path="/profile/:id" element={<CandidateProfile />} />
          </Routes>
        </main>

        <FloatingNav />
      </div>
    </Router>
  );
}

// Separate component for footer to use useLocation/useNavigate
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import candidates from './data/candidates.json';

const FloatingNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const viewMode = pathname.includes('/district') ? 'district' : 
                   pathname.includes('/list') ? 'list' : 
                   pathname.includes('/profile') ? 'profile' : '';

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--surface-dim)', backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '9999px', padding: '0.75rem 2.5rem',
      display: 'flex', alignItems: 'center', gap: '2.5rem',
      zIndex: 200,
      boxShadow: '0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px var(--outline-variant)',
      transition: 'all 0.3s ease'
    }}>
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

