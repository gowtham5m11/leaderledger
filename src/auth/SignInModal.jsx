import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
  </svg>
);

const SignInModal = ({ open, onClose, onSignIn, error }) => {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setLocalError(null);
      return;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSignIn = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      await onSignIn();
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // user cancelled — silent
      } else {
        setLocalError(err?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const displayError = localError || error;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container-lowest)',
          color: 'var(--on-surface)',
          borderRadius: '1.25rem',
          padding: '2.25rem 2rem 2rem',
          maxWidth: 420,
          width: '100%',
          position: 'relative',
          border: '1px solid var(--outline-variant)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35), var(--shadow-strong)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '0.85rem',
            right: '0.85rem',
            background: 'transparent',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.4rem',
            cursor: 'pointer',
            color: 'var(--on-surface-variant)',
            display: 'flex',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
        </button>

        <h2
          id="signin-title"
          className="font-headline"
          style={{ fontSize: '1.5rem', margin: 0, color: 'var(--on-surface)' }}
        >
          Sign in to LeaderLedger
        </h2>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
          Sign in to bookmark candidates and report inaccuracies. We only use your
          Google profile to identify you — nothing is shared.
        </p>

        {displayError && (
          <div
            role="alert"
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem 0.9rem',
              borderRadius: '0.6rem',
              fontSize: '0.85rem',
              background: 'color-mix(in srgb, var(--error, #b3261e) 14%, transparent)',
              color: 'var(--error, #b3261e)',
              border: '1px solid color-mix(in srgb, var(--error, #b3261e) 38%, transparent)',
            }}
          >
            {displayError}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={busy}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: '#fff',
            color: '#1f1f1f',
            fontFamily: "'Google Sans', 'Outfit', sans-serif",
            fontSize: '0.95rem',
            fontWeight: 500,
            border: '1px solid #dadce0',
            borderRadius: '0.6rem',
            cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 1px 2px rgba(60,64,67,0.12)',
            transition: 'box-shadow 0.2s, background 0.2s',
          }}
          onMouseOver={(e) => {
            if (!busy) e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67,0.18), 0 4px 8px rgba(60,64,67,0.12)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.12)';
          }}
        >
          <GoogleG />
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--on-surface-variant)', textAlign: 'center', lineHeight: 1.5 }}>
          By signing in you agree that your name, email, and profile picture will
          be stored to power bookmarks and reports, and that you accept our{' '}
          <a href="#/terms" style={{ color: 'var(--primary)' }}>Terms</a> and{' '}
          <a href="#/privacy" style={{ color: 'var(--primary)' }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default SignInModal;
