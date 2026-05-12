import React from 'react';
import { Menu, Sun, Moon, Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

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

  const iconBtn = (children, onClick, title) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '0.625rem',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: '9999px',
        cursor: 'pointer',
        color: 'var(--on-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </button>
  );

  return (
    <header
      className="glass-nav relative z-100 flex items-center justify-between"
      style={{ borderBottom: '1px solid var(--outline-variant)', padding: '1.5rem 2.25rem', gap: '2rem' }}
    >
      <h1
        className="font-headline tracking-tight text-primary"
        style={{ fontSize: '1.85rem', margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}
        onClick={() => navigate('/')}
      >
        KnowYourLeader.com
      </h1>

      {isListPage && (
        <div className="header-search">
          <Search className="header-search-icon" size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search candidate or constituency…"
            value={query}
            onChange={onSearchChange}
            aria-label="Search candidates and constituencies"
          />
        </div>
      )}

      <nav className="flex items-center gap-6">
        <div style={{ display: 'flex', backgroundColor: 'var(--surface-container-high)', padding: '0.3rem', borderRadius: '0.65rem' }}>
          {navBtn(isDistrict, () => navigate('/district'), 'District')}
          {navBtn(isCandidate, () => navigate('/list'), 'Candidate')}
        </div>

        <div className="flex items-center gap-2">
          {iconBtn(theme === 'light' ? <Moon size={22} /> : <Sun size={22} />, toggleTheme, `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`)}
          {iconBtn(<Menu size={26} />, undefined, 'Menu')}
        </div>
      </nav>
    </header>
  );
};

export default Header;
