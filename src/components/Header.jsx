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

  // Hidden triggers — type a phrase + Enter to invoke. Lets phone users
  // re-run onboarding without DevTools.
  const onSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const v = e.currentTarget.value.trim().toLowerCase();
    if (v === 'tour_guide_replay') {
      e.preventDefault();
      // Also clear the legacy v2 key in case it's still around.
      try {
        localStorage.removeItem('ll_tour_step_v3');
        localStorage.removeItem('ll_tour_step_v2');
      } catch (_e) { /* ignore */ }
      window.location.hash = '#/district';
      window.location.reload();
      return;
    }
    if (v === 'dev_request_replay') {
      e.preventDefault();
      try { localStorage.removeItem('ll_desktop_hint_v1'); } catch (_e) { /* ignore */ }
      // Clear the search and fire the popup now via a custom event so the
      // user doesn't have to wait the usual 10s on this reload.
      setSearchParams({}, { replace: true });
      window.dispatchEvent(new CustomEvent('ll:show-desktop-hint'));
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
        style={{ fontSize: 'clamp(1.1rem, 4vw, 1.85rem)', cursor: 'pointer' }}
      >
        LeaderLedger.in
      </h1>

      {isListPage && (
        <div className="header-search" data-tour="search">
          <Search className="header-search-icon" size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search candidate, constituency or ministry…"
            value={query}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            aria-label="Search candidates and constituencies"
          />
        </div>
      )}

      <nav className="header-nav-cluster flex items-center gap-2 md:gap-6">
        <div className="header-nav-group hidden md:flex">
          {navBtn(isDistrict, () => navigate('/district'), 'District')}
          {navBtn(isCandidate, () => navigate('/list'), 'Candidate')}
        </div>

        <AuthButton theme={theme} toggleTheme={toggleTheme} />
      </nav>
    </header>
  );
};

export default Header;
