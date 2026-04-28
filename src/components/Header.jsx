import React from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const Header = ({ theme, toggleTheme }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  
  const isDistrict = pathname.includes('/district');
  const isCandidate = pathname.includes('/list') || pathname.includes('/profile');

  return (
    <header className="glass-nav relative z-100 px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--outline-variant)' }}>
      <div className="flex items-center gap-8">
        <h1 className="font-headline tracking-tight text-primary" style={{ fontSize: '1.5rem', margin: 0, cursor: 'pointer' }} onClick={() => navigate('/')}>
          KnowYourLeader.com
        </h1>
      </div>

      <nav className="flex items-center gap-6">
        <div style={{ display: 'flex', backgroundColor: 'var(--surface-container-high)', padding: '0.25rem', borderRadius: '0.5rem' }}>
          <button 
            style={{
              padding: '0.375rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'all 0.2s',
              backgroundColor: isDistrict ? 'var(--surface-container-lowest)' : 'transparent',
              boxShadow: isDistrict ? '0 1px 2px 0 rgba(0,0,0,0.05)' : 'none',
              color: isDistrict ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/district')}
          >
            District
          </button>
          <button 
            style={{
              padding: '0.375rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'all 0.2s',
              backgroundColor: isCandidate ? 'var(--surface-container-lowest)' : 'transparent',
              boxShadow: isCandidate ? '0 1px 2px 0 rgba(0,0,0,0.05)' : 'none',
              color: isCandidate ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/list')}
          >
            Candidate
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            style={{
              padding: '0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              color: 'var(--on-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <button style={{
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '9999px',
            cursor: 'pointer',
            color: 'var(--on-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>
    </header>
  );
};

export default Header;

