import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { LogIn, Bookmark as BookmarkIcon, AlertCircle, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useBookmarks } from '../hooks/useBookmarks';
import candidates from '../data/candidates.json';
import LeaderCard from '../components/LeaderCard';

// Right-to-erasure: wipes all bookmarks (subcollection), the throttle doc,
// then the user doc itself. Reports are kept (moderation records about
// candidate data, not about you — privacy policy documents this).
// Firestore SDK can't delete a subcollection in one call, so we batch the
// children first, then delete the parent.
async function deleteUserData(uid) {
  if (!db || !uid) return;
  const bookmarksSnap = await getDocs(collection(db, 'users', uid, 'bookmarks'));
  const docs = bookmarksSnap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'users', uid, 'meta', 'throttle')).catch(() => {});
  await deleteDoc(doc(db, 'users', uid));
}

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
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      'Delete your account?\n\n' +
      'This permanently removes your profile and all bookmarks.\n' +
      "Reports you've submitted are kept (they're moderation records about candidate data) but no longer linked to your identity.\n\n" +
      'This action cannot be undone.'
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUserData(user.uid);
      await signOutUser();
      navigate('/district');
    } catch (err) {
      console.error('Account delete failed:', err?.code || err?.message);
      setDeleteError('Could not delete account. Please try again or email support.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!user || !db) return;
    let cancelled = false;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (cancelled) return;
        setProfileMeta(snap.exists() ? snap.data() : null);
      })
      .catch((err) => console.warn('Profile fetch failed:', err.message));

    const q = query(
      collection(db, 'reports'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      if (cancelled) return;
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(fetched);
      setLoadingReports(false);
    }, (err) => {
      console.warn('Reports fetch failed:', err.message);
      if (!cancelled) setLoadingReports(false);
    });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleWithdrawReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to withdraw this report?')) return;
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'withdrawn' });
    } catch (err) {
      console.error('Failed to withdraw report:', err);
      alert('Failed to withdraw report.');
    }
  };

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
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
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            title="Permanently delete your account and bookmarks"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              background: 'transparent',
              color: 'var(--error, #b3261e)',
              border: '1px solid color-mix(in srgb, var(--error, #b3261e) 38%, transparent)',
              fontWeight: 500,
              fontSize: '0.8rem',
              cursor: deleting ? 'wait' : 'pointer',
              opacity: deleting ? 0.7 : 1,
            }}
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
          {deleteError && (
            <p role="alert" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--error, #b3261e)' }}>
              {deleteError}
            </p>
          )}
        </div>
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

      <section style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)' }} />
          <h2 className="font-headline" style={{ fontSize: '1.35rem', margin: 0 }}>
            My Reports
            {reports.length > 0 && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--on-surface-variant)', fontWeight: 400, fontSize: '1rem' }}>
                ({reports.length})
              </span>
            )}
          </h2>
        </div>

        {loadingReports ? (
          <p style={{ color: 'var(--on-surface-variant)' }}>Loading reports…</p>
        ) : reports.length === 0 ? (
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
              You haven't submitted any reports yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  background: 'var(--surface-container-low)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '1rem',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', color: 'var(--on-surface)' }}>
                      {report.candidateName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                        Field: <span style={{ color: 'var(--on-surface)' }}>{report.field}</span>
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>•</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                        {formatJoinedDate(report.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      background: report.status === 'resolved' 
                        ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
                        : report.status === 'withdrawn'
                          ? 'var(--surface-container-high)'
                          : 'color-mix(in srgb, var(--tertiary, #ffb4a9) 15%, transparent)',
                      color: report.status === 'resolved'
                        ? 'var(--primary)'
                        : report.status === 'withdrawn'
                          ? 'var(--on-surface-variant)'
                          : 'var(--tertiary, #e33)',
                    }}>
                      {report.status === 'resolved' ? <CheckCircle2 size={14} /> : report.status === 'withdrawn' ? <Clock size={14} /> : <AlertCircle size={14} />}
                      {report.status || 'open'}
                    </div>
                    {(!report.status || report.status === 'open') && (
                      <button
                        onClick={() => handleWithdrawReport(report.id)}
                        aria-label="Withdraw report"
                        title="Withdraw this report"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--on-surface-variant)',
                          cursor: 'pointer',
                          padding: '0.4rem',
                          borderRadius: '9999px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--error, #b3261e) 12%, transparent)';
                          e.currentTarget.style.color = 'var(--error, #b3261e)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--on-surface-variant)';
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}>
                  {report.currentValue && (
                    <div>
                      <span style={{ color: 'var(--on-surface-variant)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '0.2rem' }}>Current Value</span>
                      <div style={{ background: 'var(--surface-container-lowest)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid var(--outline-variant)', wordBreak: 'break-word' }}>
                        {report.currentValue}
                      </div>
                    </div>
                  )}
                  {report.suggestion && (
                    <div>
                      <span style={{ color: 'var(--on-surface-variant)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '0.2rem' }}>Suggested Correction</span>
                      <div style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', color: 'var(--on-surface)', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', wordBreak: 'break-word' }}>
                        {report.suggestion}
                      </div>
                    </div>
                  )}
                  {report.reason && (
                    <div>
                      <span style={{ color: 'var(--on-surface-variant)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '0.2rem' }}>Reason / Source</span>
                      <div style={{ padding: '0.2rem 0', color: 'var(--on-surface)', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {report.reason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
