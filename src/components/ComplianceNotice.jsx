import React, { useEffect, useState } from 'react';

// Cookie consent banner — gates Google Analytics behind explicit user
// acceptance using Google Consent Mode v2. The default in index.html is
// `analytics_storage: 'denied'`; this banner flips it to 'granted' on
// accept. Decline keeps it denied. Either choice is remembered in
// localStorage so the banner only appears once.
//
// Trigger the banner again from anywhere with:
//   window.dispatchEvent(new CustomEvent('ll:show-consent'))
// — used by the "Manage cookies" footer link.

const STORAGE_KEY = 'll_consent_v1';

const setConsent = (value) => {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage: value === 'granted' ? 'granted' : 'denied',
    });
  }
};

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (!stored) setVisible(true);
    else setConsent(stored); // re-assert on every page load so gtag stays in sync

    const onShow = () => setVisible(true);
    window.addEventListener('ll:show-consent', onShow);
    return () => window.removeEventListener('ll:show-consent', onShow);
  }, []);

  if (!visible) return null;

  const accept = () => { setConsent('granted'); setVisible(false); };
  const decline = () => { setConsent('denied'); setVisible(false); };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
        maxWidth: 720,
        margin: '0 auto',
        background: 'var(--surface-container-lowest)',
        color: 'var(--on-surface)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '1rem',
        padding: '1rem 1.1rem',
        boxShadow: 'var(--shadow-2, 0 12px 30px rgba(0,0,0,0.25))',
        zIndex: 900,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.88rem',
        lineHeight: 1.45,
      }}
    >
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        We use a small amount of Google Analytics to understand how the site is
        used. No cookies are set until you accept. See our{' '}
        <a href="#/privacy" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Privacy Policy</a>.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '9999px',
            background: 'transparent',
            color: 'var(--on-surface)',
            border: '1px solid var(--outline-variant)',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '9999px',
            background: 'var(--primary)',
            color: 'var(--on-primary, #fff)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
