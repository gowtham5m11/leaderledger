import React from 'react';
import { useReactions } from '../reactions/ReactionsContext';
import { useAuth } from '../auth/AuthContext';

// Word shown after the count for the leading reaction on a card.
const SUMMARY_WORD = {
  useful: 'found useful',
  concerned: 'concerned',
  needs_investigation: 'want a review',
};
const SUMMARY_EMOJI = {
  useful: '👍',
  concerned: '😠',
  needs_investigation: '🔍',
};

// Compact, read-only reaction line for LeaderCard: shows the single leading
// reaction and its count, e.g. "😠 189 concerned". Renders a muted placeholder
// when a candidate has no reactions yet, so card layout stays consistent.
const ReactionSummary = ({ candidateId }) => {
  const { configured } = useAuth();
  const { getCounts } = useReactions();

  if (!configured) return null;

  const counts = getCounts(candidateId);
  const total = counts.useful + counts.concerned + counts.needs_investigation;

  if (total === 0) {
    return (
      <span
        style={{
          fontSize: '0.72rem',
          color: 'var(--on-surface-variant)',
          opacity: 0.6,
        }}
      >
        No reactions yet
      </span>
    );
  }

  // Leading reaction — ties resolve by REACTION display order.
  const top = ['useful', 'concerned', 'needs_investigation'].reduce((a, b) =>
    counts[b] > counts[a] ? b : a,
  );

  return (
    <span
      title={`👍 ${counts.useful} · 😠 ${counts.concerned} · 🔍 ${counts.needs_investigation}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--on-surface-variant)',
      }}
    >
      <span aria-hidden="true">{SUMMARY_EMOJI[top]}</span>
      <strong style={{ color: 'var(--on-surface)' }}>{counts[top]}</strong>
      {SUMMARY_WORD[top]}
    </span>
  );
};

export default ReactionSummary;
