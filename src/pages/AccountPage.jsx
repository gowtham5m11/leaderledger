import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { LogIn, Bookmark as BookmarkIcon } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useBookmarks } from '../hooks/useBookmarks';
import candidates from '../data/candidates.json';
import LeaderCard from '../components/LeaderCard';

const formatJoinedDate = (ts) => {
  if (!ts) return null;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  } catch {
    return null;
  }
};

const AccountPage = () => {
  const { user, loading, configured, openSignIn, signOutUser } = useAuth();
  const { ids, loading: bookmarksLoading } = useBookmarks();
  const [profileMeta, setProfileMeta] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !db) return;
    let cancelled = false;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (cancelled) return;
        setProfileMeta(snap.exists() ? snap.data() : null);
      })
      .catch((err) => console.warn('Profile fetch failed:', err.message));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!configured) {
    return (
      <div style={messageStyle}>
        <p>Sign-in isn't configured for this site yet.</p>
      </div>
    );
  }

  if (loading) return <div style={messageStyle}>Loading…</div>;

  if (!user) {
    return (
      <div style={messageStyle}>
        <h2 className="font-headline" style={{ fontSize: '1.6rem', margin: 0 }}>Sign in to see your account</h2>
        <p style={{ marginTop: '0.5rem', color: 'var(--on-surface-variant)', maxWidth: 420 }}>
          Bookmark candidates to keep track of who you're watching across constituencies.
        </p>
        <button
          onClick={openSignIn}
          style={{
            marginTop: '1.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.7rem 1.5rem',
            borderRadius: '9999px',
            background: 'var(--primary)',
            color: 'var(--on-primary, #fff)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <LogIn size={16} />
          Sign in with Google
        </button>
      </div>
    );
  }

  const bookmarkedCandidates = candidates.filter((c) => ids.has(String(c.id)));
  const joined = formatJoinedDate(profileMeta?.createdAt);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          padding: '1.75rem',
          background: 'var(--surface-container-lowest)',
          borderRadius: '1.25rem',
          border: '1px solid var(--outline-variant)',
          boxShadow: 'var(--shadow-1)',
        }}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            style={{
              width: 72,
              height: 72,
              borderRadius: '9999px',
              objectFit: 'cover',
              border: '2px solid var(--outline-variant)',
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '9999px',
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <h1 className="font-headline" style={{ 
            fontSize: '1.75rem', 
            margin: 0, 
            color: 'var(--on-surface)', 
            overflowWrap: 'break-word',
            lineHeight: 1.2
          }}>
            {user.displayName || 'Your account'}
          </h1>
          {user.email && (
            <p style={{ 
              margin: '0.25rem 0 0', 
              color: 'var(--on-surface-variant)', 
              fontSize: '0.95rem', 
              overflowWrap: 'break-word' 
            }}>
              {user.email}
            </p>
          )}
          {joined && (
            <p style={{ margin: '0.4rem 0 0', color: 'var(--on-surface-variant)', fontSize: '0.8rem' }}>
              Member since {joined}
            </p>
          )}
        </div>
        <button
          onClick={signOutUser}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '9999px',
            background: 'transparent',
            color: 'var(--on-surface)',
            border: '1px solid var(--outline-variant)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      <section style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <BookmarkIcon size={20} style={{ color: 'var(--primary)' }} />
          <h2 className="font-headline" style={{ fontSize: '1.35rem', margin: 0 }}>
            Bookmarks
            {ids.size > 0 && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--on-surface-variant)', fontWeight: 400, fontSize: '1rem' }}>
                ({ids.size})
              </span>
            )}
          </h2>
        </div>

        {bookmarksLoading ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>Loading bookmarks…</p>
        ) : bookmarkedCandidates.length === 0 ? (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              borderRadius: '1rem',
              border: '1px dashed var(--outline-variant)',
              color: 'var(--on-surface-variant)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.95rem' }}>
              No bookmarks yet. Tap the star on any candidate card to save them here.
            </p>
            <button
              onClick={() => navigate('/list')}
              style={{
                marginTop: '1.25rem',
                padding: '0.6rem 1.3rem',
                borderRadius: '9999px',
                background: 'var(--primary)',
                color: 'var(--on-primary, #fff)',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Browse candidates
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {bookmarkedCandidates.map((c) => (
              <LeaderCard key={c.id} leader={c} onClick={() => navigate(`/profile/${c.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const messageStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '6rem 1.5rem',
  color: 'var(--on-surface)',
};

export default AccountPage;
