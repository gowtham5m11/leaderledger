import React from 'react';
import { useNavigate } from 'react-router-dom';

/* ─── Category metadata ───────────────────────────────────────────────────── */
const CATEGORY_META = {
  'Serious/Violent':    { color: '#c0392b', bg: 'rgba(192,57,43,0.10)',  icon: 'dangerous',       label: 'Serious / Violent'   },
  'Corruption & Fraud': { color: '#d4780a', bg: 'rgba(212,120,10,0.10)', icon: 'account_balance', label: 'Corruption & Fraud'   },
  'Election Offenses':  { color: '#7b33b3', bg: 'rgba(123,51,179,0.10)', icon: 'how_to_vote',     label: 'Election Offenses'   },
  'Political/Protest':  { color: '#1a6fbf', bg: 'rgba(26,111,191,0.10)', icon: 'campaign',        label: 'Political / Protest' },
  'Minor/Other':        { color: '#5a7080', bg: 'rgba(90,112,128,0.10)', icon: 'info',            label: 'Minor / Other'       },
};
const CATEGORY_ORDER = [
  'Serious/Violent',
  'Corruption & Fraud',
  'Election Offenses',
  'Political/Protest',
  'Minor/Other',
];

/* ─── Main component ──────────────────────────────────────────────────────── */
const CriminalRecordsSection = ({ candidate }) => {
  const navigate = useNavigate();
  const displayCriminalCases = candidate.criminal_cases || '0';
  const summary        = candidate.criminal_summary || {};
  const numConvictions = summary.num_convictions || 0;
  const hasNoCases     = (displayCriminalCases === '0' || displayCriminalCases === 0) && numConvictions === 0;
  const catBreakdown   = summary.pending_by_category || {};

  return (
    <section
      data-tour="criminal"
      className="profile-criminal"
      style={{
        backgroundColor: hasNoCases
          ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
          : 'var(--surface-container-low)',
        borderLeft: `4px solid ${hasNoCases ? 'var(--primary)' : 'var(--error)'}`,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          color: hasNoCases ? 'var(--primary)' : 'var(--error)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
            {hasNoCases ? 'verified_user' : 'gavel'}
          </span>
          <h3 style={{
            fontWeight: 700, fontSize: '0.875rem',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {hasNoCases ? 'Clean Record' : 'Criminal Disclosures'}
          </h3>
        </div>

        <span style={{
          fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', padding: '0.2rem 0.55rem',
          borderRadius: '9999px', whiteSpace: 'nowrap',
          backgroundColor: 'var(--surface-container-high)',
          color: 'var(--on-surface-variant)',
          border: '1px solid var(--outline-variant)',
        }}>
          ECI Affidavit · 2024
        </span>
      </div>

      {/* ── Clean record ──────────────────────────────────────────────── */}
      {hasNoCases && (
        <div>
          <p style={{
            fontSize: '1.5rem', fontWeight: 800,
            color: 'var(--primary)', marginBottom: '0.35rem',
          }}>
            No Cases Declared
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
            This candidate disclosed no pending criminal cases or convictions in their ECI election affidavit.
          </p>
        </div>
      )}

      {/* ── Cases: count + category pills only ────────────────────────── */}
      {!hasNoCases && (
        <>
          {/* Count */}
          <div style={{
            display: 'flex', alignItems: 'baseline',
            gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem',
          }}>
            <span style={{
              fontSize: '2.25rem', fontWeight: 800,
              color: 'var(--error)', lineHeight: 1,
            }}>
              {displayCriminalCases}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
              pending case{Number(displayCriminalCases) !== 1 ? 's' : ''}
              {numConvictions > 0 && (
                <> · {numConvictions} conviction{numConvictions !== 1 ? 's' : ''}</>
              )}
            </span>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
            {CATEGORY_ORDER.map(cat => {
              const count = catBreakdown[cat] || 0;
              if (!count) return null;
              const meta = CATEGORY_META[cat];
              return (
                <span key={cat} style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  padding: '0.22rem 0.6rem', borderRadius: '9999px',
                  backgroundColor: meta.bg, color: meta.color,
                  border: `1px solid ${meta.color}38`,
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.72rem' }}>
                    {meta.icon}
                  </span>
                  {count} {meta.label}
                </span>
              );
            })}
          </div>

          {/* View full disclosure */}
          <button
            onClick={() => navigate(`/criminal/${candidate.id}`)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
              padding: '0.6rem 1rem', borderRadius: '0.5rem',
              backgroundColor: 'color-mix(in srgb, var(--error) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--error) 28%, transparent)',
              color: 'var(--error)', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.01em',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
            View full disclosure table
          </button>
        </>
      )}
    </section>
  );
};

export default CriminalRecordsSection;
