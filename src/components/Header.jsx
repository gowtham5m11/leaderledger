import React from 'react';
import { Search, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const Header = () => {
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
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--surface-container-low)',
          borderRadius: '9999px',
          padding: '0.5rem 1rem',
          border: '1px solid var(--outline-variant)',
          width: '20rem'
        }}>
          <Search size={18} style={{ color: 'var(--outline)' }} />
          <input 
            type="text" 
            placeholder="Search districts or leaders..." 
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.875rem',
              width: '100%',
              marginLeft: '0.5rem',
              fontFamily: "'Outfit', sans-serif"
            }}
          />
        </div>
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
      </nav>
    </header>
  );
};

export default Header;

