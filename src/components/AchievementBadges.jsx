import React from 'react';
import { partyColor } from '../data/mockData';
import {
  categoryMeta,
  manifestoMeta,
  manifestoPillStyle,
  sourceTierMeta,
} from '../config/achievements';

// Shared badge/pill set for achievement cards and the detail page so the two
// surfaces never drift. All theme-aware via CSS custom properties + color-mix.

const baseBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  padding: '0.3rem 0.65rem',
  borderRadius: '9999px',
  whiteSpace: 'nowrap',
};

export const PartyBadge = ({ party }) => {
  const hex = partyColor(party);
  return (
    <span
      style={{
        ...baseBadge,
        color: hex,
        background: `color-mix(in srgb, ${hex} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${hex} 34%, transparent)`,
      }}
    >
      {party}
    </span>
  );
};

export const CategoryBadge = ({ category }) => {
  const { label, icon } = categoryMeta(category);
  return (
    <span
      style={{
        ...baseBadge,
        color: 'var(--on-surface-variant)',
        background: 'var(--surface-container-high)',
        border: '1px solid var(--outline-variant)',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
        {icon}
      </span>
      {label}
    </span>
  );
};

export const ManifestoPill = ({ status }) => {
  const { label } = manifestoMeta(status);
  return (
    <span style={{ ...baseBadge, ...manifestoPillStyle(status) }}>{label}</span>
  );
};

export const SourceTierBadge = ({ tier, domain }) => {
  const { label, hex, icon } = sourceTierMeta(tier);
  return (
    <span
      style={{
        ...baseBadge,
        color: hex,
        background: `color-mix(in srgb, ${hex} 13%, transparent)`,
        border: `1px solid color-mix(in srgb, ${hex} 34%, transparent)`,
      }}
      title={domain ? `${label} · ${domain}` : label}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
        {icon}
      </span>
      {domain || label}
    </span>
  );
};
