import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

// Hard policy-acceptance gate. Bumps with every policy change.
// When you materially update PrivacyPage.jsx or TermsPage.jsx, increment
// POLICY_VERSION — old users will see the gate again on next visit.
export const POLICY_VERSION = 1;
const STORAGE_KEY = 'll_policy_v1';

const isAccepted = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= POLICY_VERSION;
};

const PolicyGate = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  // null = still checking, true = accepted, false = blocked
  const [accepted, setAccepted] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Always allow reading the policy + terms pages — the user has to be
  // able to read them in order to accept. The gate re-appears on any
  // other route.
  const isPolicyRoute = pathname === '/privacy' || pathname === '/terms';

  useEffect(() => {
    if (loading) return;
    let cancelled = false;

    let lsAccepted = false;
    try { lsAccepted = isAccepted(localStorage.getItem(STORAGE_KEY)); } catch { /* ignore */ }

    if (user && db) {
      // Signed in — Firestore is the source of truth, but localStorage
      // can short-circuit a re-prompt if the user already accepted as a
      // guest on this device. In that case we sync to Firestore in the
      // background so the acceptance is portable.
      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (cancelled) return;
          const fsVersion = snap.exists() ? snap.data().policyVersion : null;
          const fsAccepted = typeof fsVersion === 'number' && fsVersion >= POLICY_VERSION;
          if (fsAccepted) {
            setAccepted(true);
            try { localStorage.setItem(STORAGE_KEY, String(POLICY_VERSION)); } catch { /* ignore */ }
          } else if (lsAccepted) {
            setAccepted(true);
            setDoc(doc(db, 'users', user.uid), { policyVersion: POLICY_VERSION }, { merge: true })
              .catch((err) => console.warn('Policy sync failed:', err?.code || err?.message));
          } else {
            setAccepted(false);
          }
        })
        .catch((err) => {
          console.warn('Policy check failed:', err?.code || err?.message);
          if (!cancelled) setAccepted(lsAccepted);
        });
    } else {
      setAccepted(lsAccepted);
    }

    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading || accepted === null) return null;
  if (accepted) return null;
  if (isPolicyRoute) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    // Always write localStorage first so the gate clears even if Firestore
    // is unreachable.
    try { localStorage.setItem(STORAGE_KEY, String(POLICY_VERSION)); } catch { /* ignore */ }
    try {
      if (user && db) {
        await setDoc(
          doc(db, 'users', user.uid),
          { policyVersion: POLICY_VERSION },
          { merge: true },
        );
      }
    } catch (err) {
      console.warn('Policy save failed (kept localStorage):', err?.code || err?.message);
    } finally {
      setAccepted(true);
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-gate-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface-container-lowest)',
          color: 'var(--on-surface)',
          borderRadius: '1.25rem',
          padding: '2rem 1.75rem',
          maxWidth: 480,
          width: '100%',
          border: '1px solid var(--outline-variant)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield size={20} style={{ color: 'var(--primary)' }} />
          <h2
            id="policy-gate-title"
            className="font-headline"
            style={{ fontSize: '1.35rem', margin: 0 }}
          >
            Welcome to LeaderLedger
          </h2>
        </div>

        <p
          style={{
            marginTop: '0.9rem',
            fontSize: '0.92rem',
            lineHeight: 1.55,
            color: 'var(--on-surface-variant)',
          }}
        >
          LeaderLedger shows public information about Andhra Pradesh Assembly
          candidates from Election Commission affidavits. Before continuing,
          please review our{' '}
          <a href="#/privacy" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>
            Privacy Policy
          </a>
          {' '}and{' '}
          <a href="#/terms" style={{ color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>
            Terms of Service
          </a>.
        </p>

        <p
          style={{
            marginTop: '0.7rem',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: 'var(--on-surface-variant)',
          }}
        >
          By tapping <strong>I accept</strong> you confirm you’ve read both
          documents and agree to them. You can withdraw consent any time
          from your account page.
        </p>

        <button
          onClick={handleAccept}
          disabled={submitting}
          style={{
            marginTop: '1.4rem',
            width: '100%',
            padding: '0.8rem 1rem',
            background: 'var(--primary)',
            color: 'var(--on-primary, #fff)',
            border: 'none',
            borderRadius: '9999px',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'I accept'}
        </button>

        <p
          style={{
            marginTop: '0.9rem',
            fontSize: '0.72rem',
            textAlign: 'center',
            color: 'var(--on-surface-variant)',
          }}
        >
          If you don’t accept, please close this tab.
        </p>
      </div>
    </div>
  );
};

export default PolicyGate;
