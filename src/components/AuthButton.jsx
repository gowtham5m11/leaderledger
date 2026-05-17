import React, { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, User, Shield, Bookmark, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const AuthButton = ({ theme, toggleTheme }) => {
  const { user, loading, configured, isAdmin, openSignIn, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const themeToggleBtn = toggleTheme ? (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        width: 36,
        height: 36,
        borderRadius: '9999px',
        padding: 0,
        border: '1px solid var(--outline-variant)',
        backgroundColor: 'var(--surface-container-high)',
        color: 'var(--on-surface)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  ) : null;

  if (loading) return null;

  if (!configured) {
    // Sign-in not wired up — still expose the theme toggle so users can switch modes.
    return themeToggleBtn;
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {themeToggleBtn}
        <button
          onClick={openSignIn}
          title="Sign in with Google"
          aria-label="Sign in"
          className="auth-btn-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.9rem',
            backgroundColor: 'var(--surface-container-high)',
            color: 'var(--on-surface)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '9999px',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <LogIn size={16} />
          <span className="auth-btn-label">Sign in</span>
        </button>
      </div>
    );
  }

  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();

  const menuItem = (icon, label, onClick) => (
    <button
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.6rem 0.75rem',
        background: 'transparent',
        border: 'none',
        borderRadius: '0.5rem',
        color: 'var(--on-surface)',
        fontSize: '0.9rem',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={user.displayName || user.email || 'Account'}
        style={{
          width: 36,
          height: 36,
          borderRadius: '9999px',
          padding: 0,
          border: isAdmin
            ? '2px solid var(--primary)'
            : '1px solid var(--outline-variant)',
          backgroundColor: 'var(--surface-container-high)',
          color: 'var(--on-surface)',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.95rem',
          fontWeight: 600,
          position: 'relative',
        }}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initial || <User size={18} />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            minWidth: 240,
            background: 'var(--surface-container-lowest)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '0.75rem',
            boxShadow: 'var(--shadow-2)',
            padding: '0.5rem',
            zIndex: 300,
          }}
        >
          <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--outline-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--on-surface)' }}>
                {user.displayName || 'Signed in'}
              </div>
              {isAdmin && (
                <span
                  title="Admin"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '9999px',
                    background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                    color: 'var(--primary)',
                  }}
                >
                  <Shield size={10} />
                  Admin
                </span>
              )}
            </div>
            {user.email && (
              <div style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>
                {user.email}
              </div>
            )}
          </div>

          {menuItem(<Bookmark size={16} />, 'My bookmarks', () => navigate('/account'))}
          {toggleTheme && menuItem(
            theme === 'light' ? <Moon size={16} /> : <Sun size={16} />,
            theme === 'light' ? 'Dark mode' : 'Light mode',
            toggleTheme,
          )}
          {menuItem(<LogOut size={16} />, 'Sign out', signOutUser)}
        </div>
      )}
    </div>
  );
};

export default AuthButton;
