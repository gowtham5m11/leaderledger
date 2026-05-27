import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import candidates from '../data/candidates.json';
import { partyColor as partyColorVar } from '../data/mockData';

/* ── shared helpers (duplicated from CriminalRecordsSection to keep page self-contained) ── */
const INVALID_VALS = new Set(['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', '-', '']);
const isInvalid = (val) => {
  if (val == null) return true;
  const s = val.toString().trim().toUpperCase();
  return INVALID_VALS.has(s) || s.startsWith('NOT APPLICABLE');
};

const CATEGORY_META = {
  'Serious/Violent':    { color: '#c0392b', label: 'Serious / Violent'   },
  'Corruption & Fraud': { color: '#d4780a', label: 'Corruption & Fraud'   },
  'Election Offenses':  { color: '#7b33b3', label: 'Election Offenses'   },
  'Political/Protest':  { color: '#1a6fbf', label: 'Political / Protest' },
  'Minor/Other':        { color: '#5a7080', label: 'Minor / Other'       },
};
const CATEGORY_ORDER = [
  'Serious/Violent', 'Corruption & Fraud', 'Election Offenses', 'Political/Protest', 'Minor/Other',
];

function categoryOf(cat) {
  return CATEGORY_META[cat] || { color: '#5a7080', label: cat || 'Other' };
}

/* ── CriminalDisclosurePage ─────────────────────────────────────────────── */
export default function CriminalDisclosurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const candidate = candidates.find(c => String(c.id) === String(id));

  if (!candidate) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
        Candidate not found.
      </div>
    );
  }

  const partyColor = partyColorVar(candidate.party);
  const displayCount = candidate.criminal_cases || '0';
  const summary = candidate.criminal_summary || {};
  const numConvictions = summary.num_convictions || 0;

  const validPending = (candidate.criminal_details_pending || []).filter(
    c => !(isInvalid(c.fir_no) && isInvalid(c.description)),
  );
  const validConvictions = (candidate.criminal_details_convictions || []).filter(
    c => !(isInvalid(c.fir_no) && isInvalid(c.description)),
  );

  /* Sort pending by category order then original index */
  const sortedPending = [...validPending].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const allRows = [
    ...sortedPending.map(c => ({ ...c, _type: 'pending' })),
    ...validConvictions.map(c => ({ ...c, _type: 'conviction' })),
  ];

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>

      {/* Back link */}
      <button
        onClick={() => navigate(`/profile/${id}`)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--on-surface-variant)', fontSize: '0.78rem', fontWeight: 600,
          padding: '0 0 1.25rem', letterSpacing: '0.01em',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
        Back to profile
      </button>

      {/* ── H1 ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '0.2rem 0.6rem',
            borderRadius: '9999px', backgroundColor: `${partyColor}1A`,
            color: partyColor, border: `1px solid ${partyColor}44`,
          }}>
            {candidate.party}
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '0.2rem 0.55rem',
            borderRadius: '9999px', backgroundColor: 'var(--surface-container-high)',
            color: 'var(--on-surface-variant)', border: '1px solid var(--outline-variant)',
          }}>
            ECI Affidavit · 2024
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(1.3rem, 4vw, 1.9rem)',
          fontWeight: 800, lineHeight: 1.2,
          color: 'var(--on-surface)', margin: '0 0 0.35rem',
        }}>
          {candidate.name}
        </h1>

        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface-variant)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--error)', fontWeight: 800, fontSize: '1.35rem' }}>
            {displayCount}
          </span>{' '}
          pending criminal case{Number(displayCount) !== 1 ? 's' : ''}
          {numConvictions > 0 && (
            <> &nbsp;·&nbsp;{' '}
              <span style={{ color: 'var(--error)', fontWeight: 800 }}>{numConvictions}</span>{' '}
              conviction{numConvictions !== 1 ? 's' : ''}
            </>
          )}
          {' '}declared in election affidavit
          {candidate.constituency && (
            <> · <span style={{ color: partyColor }}>{candidate.constituency}</span></>
          )}
        </p>
      </div>

      {/* ── No cases ───────────────────────────────────────────────────── */}
      {allRows.length === 0 && (
        <div style={{
          padding: '2rem', textAlign: 'center',
          backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          borderRadius: '0.75rem', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
          color: 'var(--on-surface-variant)', fontSize: '0.9rem',
        }}>
          {Number(displayCount) === 0
            ? 'No criminal cases declared in this candidate\'s affidavit.'
            : 'Case details are being extracted from the affidavit. The count above is from the affidavit summary page.'}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {allRows.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: '0.625rem', border: '1px solid var(--outline-variant)' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: '0.82rem', color: 'var(--on-surface)',
          }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--surface-container-high)',
                borderBottom: '2px solid var(--outline-variant)',
              }}>
                {['#', 'Category', 'FIR No.', 'Description', 'Sections'].map((h, i) => (
                  <th key={h} style={{
                    padding: '0.65rem 0.85rem',
                    textAlign: i === 0 ? 'center' : 'left',
                    fontWeight: 800, fontSize: '0.67rem',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: 'var(--on-surface-variant)', whiteSpace: 'nowrap',
                    width: i === 0 ? '2rem' : i === 1 ? '11rem' : i === 2 ? '8rem' : 'auto',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, idx) => {
                const meta = categoryOf(row.category);
                const isConviction = row._type === 'conviction';
                const isEven = idx % 2 === 1;
                return (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: isEven
                        ? 'var(--surface-container-lowest)'
                        : 'var(--surface)',
                      borderBottom: '1px solid var(--outline-variant)',
                      verticalAlign: 'top',
                    }}
                  >
                    {/* # */}
                    <td style={{ padding: '0.7rem 0.85rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: '1.5rem', height: '1.5rem', borderRadius: '50%',
                        backgroundColor: `${meta.color}18`, color: meta.color,
                        fontSize: '0.62rem', fontWeight: 800,
                      }}>
                        {idx + 1}
                      </span>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '0.7rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700,
                          color: meta.color, whiteSpace: 'nowrap',
                        }}>
                          {meta.label}
                        </span>
                        {isConviction && (
                          <span style={{
                            fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.06em',
                            color: 'var(--on-error)', backgroundColor: 'var(--error)',
                            padding: '0.1rem 0.35rem', borderRadius: '9999px',
                          }}>
                            CONVICTED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* FIR No. */}
                    <td style={{ padding: '0.7rem 0.85rem' }}>
                      {!isInvalid(row.fir_no) ? (
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700,
                          color: meta.color, letterSpacing: '0.03em',
                        }}>
                          {row.fir_no}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td style={{ padding: '0.7rem 0.85rem', lineHeight: 1.5 }}>
                      {!isInvalid(row.description) ? row.description : (
                        <span style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>Not specified</span>
                      )}
                    </td>

                    {/* Sections */}
                    <td style={{ padding: '0.7rem 0.85rem' }}>
                      {!isInvalid(row.sections) ? (
                        <span style={{
                          fontSize: '0.7rem', fontFamily: 'monospace',
                          color: 'var(--on-surface-variant)', lineHeight: 1.6,
                        }}>
                          {row.sections}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footnote */}
      <p style={{
        marginTop: '1.25rem', fontSize: '0.68rem',
        color: 'var(--on-surface-variant)', lineHeight: 1.6,
        borderTop: '1px solid var(--outline-variant)', paddingTop: '0.85rem',
      }}>
        Self-disclosed in the candidate's sworn affidavit filed with the Election Commission of India for the 2024 Andhra Pradesh Assembly elections. FIR numbers, IPC/CrPC sections, and case descriptions are reproduced as declared.
      </p>
    </div>
  );
}
