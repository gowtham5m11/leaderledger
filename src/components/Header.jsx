import React from 'react';
import { Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthButton from './AuthButton';

const Header = ({ theme, toggleTheme }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDistrict = pathname.includes('/district');
  const isCandidate = pathname.includes('/list') || pathname.includes('/profile');
  const isListPage = pathname.includes('/list');

  const query = searchParams.get('q') || '';
  const onSearchChange = (e) => {
    const v = e.target.value;
    if (v) {
      setSearchParams({ q: v }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const navBtn = (active, onClick, label) => (
    <button
      style={{
        padding: '0.5rem 1.25rem',
        borderRadius: '0.5rem',
        fontSize: '0.95rem',
        fontWeight: 500,
        transition: 'all 0.2s',
        backgroundColor: active ? 'var(--surface-container-lowest)' : 'transparent',
        boxShadow: active ? 'var(--shadow-1)' : 'none',
        color: active ? 'var(--on-surface)' : 'var(--on-surface-variant)',
        border: 'none',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <header
      className="glass-nav relative z-100 flex items-center justify-between header-container"
    >
      <h1
        className="font-headline tracking-tight text-primary header-title"
        onClick={() => navigate('/')}
      >
        LeaderLedger.in
      </h1>

      {isListPage && (
        <div className="header-search">
          <Search className="header-search-icon" size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search candidate, constituency or ministry…"
            value={query}
            onChange={onSearchChange}
            aria-label="Search candidates and constituencies"
          />
        </div>
      )}

      <nav className="header-nav-cluster flex items-center gap-6">
        <div className="header-nav-group">
          {navBtn(isDistrict, () => navigate('/district'), 'District')}
          {navBtn(isCandidate, () => navigate('/list'), 'Candidate')}
        </div>

        <AuthButton theme={theme} toggleTheme={toggleTheme} />
      </nav>
    </header>
  );
};

export default Header;
