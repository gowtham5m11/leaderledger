import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ThumbsUp,
  MessageSquare,
  Share2,
  Flag,
  ArrowLeft,
  ExternalLink,
  Check,
  Trash2,
} from 'lucide-react';
import { useAchievement } from '../hooks/useAchievements';
import { useAchievementComments } from '../hooks/useAchievementComments';
import { useAchievementLike } from '../hooks/useAchievementLike';
import { useAuth } from '../auth/AuthContext';
import { safeHref } from '../utils/safeHref';
import { actionAccent } from '../config/achievements';
import {
  PartyBadge,
  CategoryBadge,
  ManifestoPill,
  SourceTierBadge,
} from '../components/AchievementBadges';
import AchievementReportModal from '../components/AchievementReportModal';
import Footer from '../components/Footer';

// Firestore Timestamp | null -> readable month/year, or '' when absent.
const fmtDate = (ts) => {
  if (!ts) return '';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

const AchievementDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { achievement, loading, error } = useAchievement(id);
  const { comments, addComment, deleteComment, COMMENT_MAX } =
    useAchievementComments(id);
  const { liked, toggleLike } = useAchievementLike(id);
  const { user } = useAuth();

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: achievement?.title || 'LeaderLedger', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user cancelled share / clipboard blocked — ignore */
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await addComment(text);
      setDraft('');
    } catch {
      /* listener will stay as-is; surfaced via console in the hook */
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <main className="page-main">
          <p className="body-md text-on-surface-variant">Loading…</p>
        </main>
      </div>
    );
  }

  if (error || !achievement) {
    return (
      <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <main className="page-main">
          <BackLink onClick={() => navigate('/achievements')} />
          <div style={{ textAlign: 'center', padding: '4rem 0', opacity: 0.7 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>
              search_off
            </span>
            <p className="headline-md">Entry unavailable</p>
            <p className="body-md text-on-surface-variant" style={{ marginTop: '0.5rem' }}>
              This achievement may be under review or no longer published.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const accent = actionAccent(achievement.action_type);
  const href = safeHref(achievement.source_url);
  const tenure = [fmtDate(achievement.tenure_start), fmtDate(achievement.tenure_end) || 'present']
    .filter(Boolean)
    .join(' – ');

  return (
    <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <main className="page-main" style={{ maxWidth: '52rem', margin: '0 auto' }}>
        <BackLink onClick={() => navigate('/achievements')} />

        <article
          className="bg-surface-container-lowest"
          style={{
            borderRadius: '1.25rem',
            border: '1px solid var(--outline-variant)',
            borderLeft: `5px solid ${accent}`,
            padding: '1.75rem',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
            <PartyBadge party={achievement.party} />
            <CategoryBadge category={achievement.category} />
            <ManifestoPill status={achievement.manifesto_status} />
            <SourceTierBadge tier={achievement.source_tier} domain={achievement.source_domain} />
            {achievement.status === 'under_review' && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  color: '#b26a00',
                  background: 'color-mix(in srgb, #b26a00 14%, transparent)',
                  border: '1px solid color-mix(in srgb, #b26a00 34%, transparent)',
                }}
              >
                Under review
              </span>
            )}
          </div>

          <h1
            className="font-headline"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', margin: '1rem 0 0.5rem', color: 'var(--on-surface)' }}
          >
            {achievement.title}
          </h1>

          <p className="body-md text-on-surface-variant" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {achievement.description}
          </p>

          <dl style={metaGrid}>
            {achievement.government && (
              <MetaRow icon="account_balance" label="Government" value={achievement.government} />
            )}
            {tenure && <MetaRow icon="calendar_month" label="Tenure" value={tenure} />}
            <MetaRow
              icon={achievement.action_type === 'negative' ? 'trending_down' : 'trending_up'}
              label="Action type"
              value={achievement.action_type === 'negative' ? 'Negative / unmet' : 'Positive'}
            />
          </dl>

          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginTop: '1.25rem',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={16} /> View source · {achievement.source_domain}
            </a>
          )}

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--outline-variant)',
            }}
          >
            <button
              type="button"
              onClick={toggleLike}
              aria-pressed={liked}
              style={{ ...actionBtn, color: liked ? 'var(--primary)' : 'var(--on-surface)', borderColor: liked ? 'var(--primary)' : 'var(--outline-variant)' }}
            >
              <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
              {achievement.like_count || 0}
            </button>
            <button type="button" style={{ ...actionBtn, cursor: 'default', color: 'var(--on-surface-variant)' }}>
              <MessageSquare size={16} />
              {achievement.comment_count || 0}
            </button>
            <button type="button" onClick={share} style={actionBtn}>
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              {copied ? 'Copied' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              style={{ ...actionBtn, marginLeft: 'auto', color: 'var(--on-surface-variant)' }}
            >
              <Flag size={16} /> Report
            </button>
          </div>
        </article>

        {/* Comments */}
        <section style={{ marginTop: '2rem' }}>
          <h2 className="headline-md" style={{ marginBottom: '1rem' }}>
            Comments{' '}
            <span style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>
              ({comments.length})
            </span>
          </h2>

          <form onSubmit={postComment} style={{ marginBottom: '1.5rem' }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, COMMENT_MAX))}
              rows={3}
              placeholder={user ? 'Add a comment…' : 'Sign in to comment…'}
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                fontSize: '0.95rem',
                borderRadius: '0.65rem',
                border: '1px solid var(--outline-variant)',
                background: 'var(--surface-container-low)',
                color: 'var(--on-surface)',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: 72,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span className="label-sm text-on-surface-variant">
                {draft.length}/{COMMENT_MAX}
              </span>
              <button
                type="submit"
                disabled={posting || !draft.trim()}
                style={{
                  padding: '0.55rem 1.3rem',
                  borderRadius: '9999px',
                  background: 'var(--primary)',
                  color: 'var(--on-primary, #fff)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: posting || !draft.trim() ? 'default' : 'pointer',
                  opacity: posting || !draft.trim() ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>

          {comments.length === 0 ? (
            <p className="body-md text-on-surface-variant">
              No comments yet. Be the first to add context.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '0.85rem',
                    border: '1px solid var(--outline-variant)',
                    background: 'var(--surface-container-lowest)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="label-sm text-on-surface-variant">
                      {fmtDate(c.created_at) || 'Just now'}
                    </span>
                    {user && c.uid === user.uid && (
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id)}
                        aria-label="Delete comment"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--on-surface-variant)',
                          display: 'flex',
                          padding: '0.2rem',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <p className="body-md" style={{ marginTop: '0.35rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <AchievementReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        achievement={achievement}
      />

      <Footer />
    </div>
  );
};

const BackLink = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--on-surface-variant)',
      fontWeight: 600,
      fontSize: '0.9rem',
      fontFamily: 'inherit',
      marginBottom: '1.25rem',
      padding: 0,
    }}
  >
    <ArrowLeft size={16} /> All achievements
  </button>
);

const MetaRow = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '1.15rem', color: 'var(--outline)' }}>
      {icon}
    </span>
    <span className="label-sm text-on-surface-variant" style={{ minWidth: '6rem' }}>
      {label}
    </span>
    <span className="body-md" style={{ fontWeight: 600 }}>{value}</span>
  </div>
);

const metaGrid = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  marginTop: '1.5rem',
  padding: '1rem 1.1rem',
  borderRadius: '0.85rem',
  background: 'var(--surface-container-low)',
  border: '1px solid var(--outline-variant)',
};

const actionBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.55rem 1rem',
  borderRadius: '9999px',
  background: 'transparent',
  border: '1px solid var(--outline-variant)',
  color: 'var(--on-surface)',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export default AchievementDetailPage;
