// Shared vocabulary for the Achievements feature — categories, manifesto
// statuses, action types, and the theme-aware style helpers that render their
// badges/pills. Single source of truth consumed by AchievementCard,
// SubmitAchievementModal, AchievementsPage and the detail page so the labels,
// colours and icons never drift between screens.

// --- Categories ----------------------------------------------------------
// `icon` values are Material Symbols (the same font set LeaderCard uses).
const CATEGORY_META = {
  infrastructure: { label: 'Infrastructure', icon: 'construction' },
  welfare: { label: 'Welfare', icon: 'volunteer_activism' },
  investment: { label: 'Investment', icon: 'trending_up' },
  policy: { label: 'Policy', icon: 'gavel' },
};

export const CATEGORIES = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value,
  ...meta,
}));

export const categoryMeta = (category) =>
  CATEGORY_META[category] || { label: category || 'Other', icon: 'category' };

// --- Manifesto status ----------------------------------------------------
// Each status carries a fixed accent hex. We don't route these through the
// party/CSS-variable system because the meaning (delivered = green, broken =
// red) must stay stable across light/dark; color-mix keeps them legible on
// either surface.
const MANIFESTO_META = {
  promised: { label: 'Promised', hex: '#1565c0' },
  in_progress: { label: 'In Progress', hex: '#b26a00' },
  delivered: { label: 'Delivered', hex: '#2e7d32' },
  broken: { label: 'Broken', hex: '#b3261e' },
  unplanned: { label: 'Unplanned', hex: '#5f6368' },
};

export const MANIFESTO_STATUSES = Object.entries(MANIFESTO_META).map(
  ([value, meta]) => ({ value, ...meta }),
);

export const manifestoMeta = (status) =>
  MANIFESTO_META[status] || MANIFESTO_META.unplanned;

// Pill style object ({ background, color, border }) for a manifesto status.
export const manifestoPillStyle = (status) => {
  const { hex } = manifestoMeta(status);
  return {
    background: `color-mix(in srgb, ${hex} 14%, transparent)`,
    color: hex,
    border: `1px solid color-mix(in srgb, ${hex} 36%, transparent)`,
  };
};

// --- Action type ---------------------------------------------------------
export const ACTION_TYPES = [
  { value: 'positive', label: 'Positive', hex: '#2e7d32' },
  { value: 'negative', label: 'Negative', hex: '#b3261e' },
];

export const actionAccent = (actionType) =>
  actionType === 'negative' ? '#b3261e' : '#2e7d32';

// --- Source tier ---------------------------------------------------------
export const sourceTierMeta = (tier) =>
  tier === 'official'
    ? { label: 'Official Source', hex: '#2e7d32', icon: 'verified' }
    : { label: 'Community Submission', hex: '#b26a00', icon: 'groups' };

// --- Parties (matches the values used across candidates.json) -------------
export const PARTIES = ['TDP', 'YSRCP', 'JSP'];

// --- Report reasons (mirrors the achievement_reports.reason enum) ---------
export const REPORT_REASONS = [
  { value: 'false_info', label: 'Contains false information' },
  { value: 'misleading', label: 'Misleading or out of context' },
  { value: 'spam', label: 'Spam or self-promotion' },
  { value: 'other', label: 'Something else' },
];

// Threshold at which an entry auto-escalates to review (kept here so the hook
// and any future Cloud Function agree on the number).
export const AUTO_ESCALATE_AT = 10;
