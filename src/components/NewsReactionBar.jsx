import React, { useState } from 'react';
import { useNewsReactions } from '../reactions/NewsReactionsContext';
import { useAuth } from '../auth/AuthContext';

// Compact, dense variant of the reaction bar for news cards (cards already
// carry a lot of metadata). One row of two pill buttons: emoji + count.
const REACTIONS = [
  { key: 'useful', emoji: '👍', label: 'Thumbs Up' },
  { key: 'concerned', emoji: '👎', label: 'Thumbs Down' },
];
const EMPTY_COUNTS = { useful: 0, concerned: 0, needs_investigation: 0 };

// `counts` is passed in by the page (it owns the per-screen count listener
// via useNewsReactionCounts); the user's own reaction + the write path come
// from the NewsReactions context.
const NewsReactionBar = ({ articleId, counts }) => {
  const { configured } = useAuth();
  const { getMyReaction, react } = useNewsReactions();
  const [busy, setBusy] = useState(false);

  if (!configured || !articleId) return null;

  const c = counts || EMPTY_COUNTS;
  const mine = getMyReaction(articleId);

  const handleClick = async (key) => {
    if (busy) return;
    setBusy(true);
    try {
      await react(articleId, key);
    } catch (err) {
      console.error('News reaction failed:', err?.message || err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.4rem',
        flexWrap: 'wrap',
        marginTop: '0.65rem',
      }}
    >
      {REACTIONS.map((r) => {
        const active = mine === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => handleClick(r.key)}
            disabled={busy}
            aria-pressed={active}
            aria-label={`${r.label}: ${c[r.key]} ${
              c[r.key] === 1 ? 'reaction' : 'reactions'
            }`}
            title={
              active
                ? `Remove '${r.label}'`
                : r.label
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              minHeight: 44,
              padding: '0.4rem 0.8rem',
              borderRadius: '9999px',
              cursor: busy ? 'wait' : 'pointer',
              background: active
                ? 'color-mix(in srgb, var(--primary) 16%, transparent)'
                : 'var(--surface-container-high)',
              color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
              border: active
                ? '1px solid color-mix(in srgb, var(--primary) 42%, transparent)'
                : '1px solid var(--outline-variant)',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.82rem',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.95rem' }} aria-hidden="true">
              {r.emoji}
            </span>
            <span>{c[r.key]}</span>
          </button>
        );
      })}
    </div>
  );
};

export default NewsReactionBar;
