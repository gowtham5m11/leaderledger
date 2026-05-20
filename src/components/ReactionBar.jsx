import React, { useState } from 'react';
import { useReactions } from '../reactions/ReactionsContext';
import { useAuth } from '../auth/AuthContext';

// Display order + labels for the three reactions. Touch targets are sized
// generously (min 44px) since ~70% of traffic is mobile.
const REACTIONS = [
  { key: 'useful', emoji: '👍', label: 'Useful' },
  { key: 'concerned', emoji: '😠', label: 'Concerned' },
  { key: 'needs_investigation', emoji: '🔍', label: 'Needs Investigation' },
];

// Full interactive reaction bar — used on the candidate profile. Shows all
// three reactions with live counts. Signed-out users see the counts and can
// tap; tapping pops the sign-in modal (via requireAuth) rather than blocking.
const ReactionBar = ({ candidateId }) => {
  const { configured, user } = useAuth();
  const { getCounts, getMyReaction, react } = useReactions();
  const [busy, setBusy] = useState(false);

  // No Firebase config → hide entirely (matches BookmarkButton behaviour).
  if (!configured) return null;

  const counts = getCounts(candidateId);
  const mine = getMyReaction(candidateId);

  const handleClick = async (key) => {
    if (busy) return;
    setBusy(true);
    try {
      await react(candidateId, key);
    } catch (err) {
      console.error('Reaction failed:', err?.message || err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{
        backgroundColor: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '1rem',
        padding: '1.25rem',
      }}
    >
      <h3
        className="profile-section-title"
        style={{ marginBottom: '0.35rem' }}
      >
        Community Reactions
      </h3>
      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--on-surface-variant)',
          marginBottom: '1rem',
        }}
      >
        How readers responded to this candidate&rsquo;s public record.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {REACTIONS.map((r) => {
          const active = mine === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => handleClick(r.key)}
              disabled={busy}
              aria-pressed={active}
              aria-label={`${r.label} — ${counts[r.key]} ${
                counts[r.key] === 1 ? 'reaction' : 'reactions'
              }`}
              title={
                active
                  ? `Remove '${r.label}'`
                  : r.label
              }
              style={{
                flex: 1,
                minHeight: 44,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.2rem',
                padding: '0.6rem 0.35rem',
                borderRadius: '0.85rem',
                cursor: busy ? 'wait' : 'pointer',
                background: active
                  ? 'color-mix(in srgb, var(--primary) 16%, transparent)'
                  : 'var(--surface-container-high)',
                color: active ? 'var(--primary)' : 'var(--on-surface)',
                border: active
                  ? '1px solid color-mix(in srgb, var(--primary) 42%, transparent)'
                  : '1px solid var(--outline-variant)',
                transition: 'all 0.15s ease',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              <span style={{ fontSize: '1.35rem', lineHeight: 1 }} aria-hidden="true">
                {r.emoji}
              </span>
              <span
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {counts[r.key]}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  lineHeight: 1.15,
                  opacity: 0.85,
                }}
              >
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      {!user && (
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--on-surface-variant)',
            marginTop: '0.85rem',
            textAlign: 'center',
          }}
        >
          Sign in to react — counts stay visible to everyone.
        </p>
      )}
    </section>
  );
};

export default ReactionBar;
