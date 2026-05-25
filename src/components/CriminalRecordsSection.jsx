import React, { useState } from 'react';

/* ─── IPC Section plain-English lookup ───────────────────────────────────── */
const IPC_LABEL = {
  '34':   'Common intention (joint liability)',
  '107':  'Abetment',
  '109':  'Punishment for abetment',
  '114':  'Abettor present at the scene',
  '120B': 'Criminal conspiracy',
  '124A': 'Sedition',
  '143':  'Unlawful assembly',
  '144':  'Armed unlawful assembly',
  '145':  'Joining unlawful assembly knowing it is ordered to disperse',
  '147':  'Rioting',
  '148':  'Rioting with deadly weapon',
  '149':  'Act done in prosecution of common object',
  '152':  'Assaulting officer dispersing unlawful assembly',
  '153':  'Provoking breach of peace',
  '153A': 'Promoting enmity between groups',
  '186':  'Obstructing public servant in discharge of duty',
  '188':  'Disobedience to order of public servant',
  '269':  'Negligent act likely to spread infection',
  '279':  'Rash / dangerous driving',
  '302':  'Murder',
  '304':  'Culpable homicide (not murder)',
  '307':  'Attempt to murder',
  '323':  'Voluntarily causing hurt',
  '324':  'Causing hurt by dangerous weapon',
  '325':  'Voluntarily causing grievous hurt',
  '326':  'Causing grievous hurt by dangerous weapon',
  '341':  'Wrongful restraint',
  '342':  'Wrongful confinement',
  '353':  'Assault or criminal force on public servant',
  '354':  'Assault or criminal force on woman',
  '375':  'Rape',
  '376':  'Punishment for rape',
  '378':  'Theft',
  '379':  'Theft',
  '380':  'Theft in a dwelling house',
  '384':  'Extortion',
  '385':  'Putting a person in fear to commit extortion',
  '392':  'Robbery',
  '395':  'Dacoity',
  '397':  'Robbery or dacoity with deadly weapon',
  '406':  'Criminal breach of trust',
  '408':  'Criminal breach of trust by an employee',
  '420':  'Cheating and dishonestly inducing delivery of property',
  '425':  'Mischief',
  '427':  'Mischief causing damage',
  '436':  'Mischief by fire or explosive substance',
  '447':  'Criminal trespass',
  '452':  'House-trespass after preparation for assault',
  '465':  'Forgery',
  '467':  'Forgery of valuable security, will, or authority',
  '468':  'Forgery for the purpose of cheating',
  '471':  'Using as genuine a forged document',
  '504':  'Intentional insult to provoke breach of peace',
  '506':  'Criminal intimidation',
  '509':  'Word or gesture intended to insult the modesty of a woman',
};

/* CrPC section lookup */
const CRPC_LABEL = {
  '107': 'Security for keeping the peace',
  '108': 'Security for good behaviour',
  '110': 'Security for good behaviour from habitual offenders',
  '151': 'Arrest to prevent cognisable offence (preventive)',
  '160': 'Police power to require witness attendance',
};

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

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const INVALID_VALS = new Set(['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', '-', '']);
const isInvalid = (val) => {
  if (val == null) return true;
  const s = val.toString().trim().toUpperCase();
  return INVALID_VALS.has(s) || s.startsWith('NOT APPLICABLE');
};

/**
 * Parse a raw sections string like "188, 341, 143, 147 R/W 149 IPC"
 * or "R/W 151 Cr.P.C." into [{num, law, label}].
 */
function parseSections(raw) {
  if (!raw) return [];
  const upper = raw.toString().trim().toUpperCase();
  if (INVALID_VALS.has(upper) || upper.startsWith('NOT APPLICABLE')) return [];

  const isCrPC = /CR\.?\s*P\.?\s*C/i.test(raw);
  const nums = [...new Set(
    (raw.match(/\b\d{2,3}[A-Z]?\b/gi) || []).map(n => n.toUpperCase()),
  )];

  return nums.map(num => ({
    num,
    law: isCrPC ? 'CrPC' : 'IPC',
    label: (isCrPC ? CRPC_LABEL[num] : null) || IPC_LABEL[num] || null,
  }));
}

/* ─── SectionChip ─────────────────────────────────────────────────────────── */
function SectionChip({ section }) {
  return (
    <span style={{
      fontSize: '0.64rem',
      fontWeight: 700,
      padding: '0.18rem 0.48rem',
      borderRadius: '0.25rem',
      backgroundColor: 'var(--surface-container-high)',
      color: 'var(--on-surface-variant)',
      border: '1px solid var(--outline-variant)',
      lineHeight: 1.5,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.2rem',
      flexWrap: 'wrap',
    }}>
      §{section.num}&thinsp;{section.law}
      {section.label && (
        <span style={{ opacity: 0.68, fontWeight: 400 }}>
          {' '}— {section.label}
        </span>
      )}
    </span>
  );
}

/* ─── CaseCard ────────────────────────────────────────────────────────────── */
function CaseCard({ caseItem, accentColor, isConviction = false }) {
  const hasFIR  = !isInvalid(caseItem.fir_no);
  const hasDesc = !isInvalid(caseItem.description);
  const chips   = parseSections(caseItem.sections);
  const hasRaw  = !isInvalid(caseItem.sections) && chips.length === 0;

  return (
    <div style={{
      backgroundColor: 'var(--surface-container-lowest)',
      borderRadius: '0.5rem',
      padding: '0.75rem 0.9rem',
      border: `1px solid ${accentColor}1A`,
      borderLeft: `3px solid ${accentColor}`,
    }}>
      {/* FIR row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '0.3rem',
        gap: '0.5rem', flexWrap: 'wrap',
      }}>
        {hasFIR ? (
          <span style={{
            fontSize: '0.68rem', fontWeight: 800,
            color: accentColor, letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            FIR No. {caseItem.fir_no}
          </span>
        ) : (
          <span style={{
            fontSize: '0.68rem', fontWeight: 600,
            color: 'var(--on-surface-variant)', fontStyle: 'italic',
          }}>
            FIR number not specified in affidavit
          </span>
        )}
        {isConviction && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
            color: 'var(--on-error)', backgroundColor: 'var(--error)',
            padding: '0.15rem 0.45rem', borderRadius: '9999px', flexShrink: 0,
          }}>
            CONVICTED
          </span>
        )}
      </div>

      {/* Description */}
      {hasDesc && (
        <p style={{
          fontSize: '0.875rem', fontWeight: 600,
          color: 'var(--on-surface)', lineHeight: 1.45,
          marginBottom: (chips.length > 0 || hasRaw) ? '0.55rem' : 0,
        }}>
          {caseItem.description}
        </p>
      )}

      {/* Section chips */}
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {chips.map((s, i) => <SectionChip key={i} section={s} />)}
        </div>
      )}

      {/* Fallback: raw sections string when parser found nothing */}
      {hasRaw && (
        <p style={{
          fontSize: '0.68rem', color: 'var(--on-surface-variant)',
          fontFamily: 'monospace', lineHeight: 1.4,
        }}>
          Sections: {caseItem.sections}
        </p>
      )}
    </div>
  );
}

/* ─── CategoryGroup ───────────────────────────────────────────────────────── */
function CategoryGroup({ cat, cases }) {
  const [expanded, setExpanded] = useState(false);
  const meta     = CATEGORY_META[cat];
  const PREVIEW  = 3;
  const shown    = expanded ? cases : cases.slice(0, PREVIEW);
  const extra    = cases.length - PREVIEW;

  return (
    <div>
      {/* Category header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        marginBottom: '0.6rem', paddingBottom: '0.4rem',
        borderBottom: `2px solid ${meta.color}28`,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: meta.color }}>
          {meta.icon}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 800,
          color: meta.color, textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {meta.label}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.68rem',
          fontWeight: 700, color: meta.color, opacity: 0.72,
        }}>
          {cases.length} case{cases.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Case cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {shown.map((c, i) => (
          <CaseCard key={i} caseItem={c} accentColor={meta.color} />
        ))}
      </div>

      {/* Expand / collapse */}
      {extra > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            fontSize: '0.72rem', fontWeight: 700, color: meta.color,
            background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
          {expanded ? 'Show fewer' : `Show ${extra} more`}
        </button>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
const CriminalRecordsSection = ({ candidate }) => {
  const displayCriminalCases = candidate.criminal_cases || '0';
  const summary        = candidate.criminal_summary || {};
  const numConvictions = summary.num_convictions || 0;
  const hasNoCases     = (displayCriminalCases === '0' || displayCriminalCases === 0) && numConvictions === 0;

  const validPending = (candidate.criminal_details_pending || []).filter(
    c => !(isInvalid(c.fir_no) && isInvalid(c.description)),
  );
  const validConvictions = (candidate.criminal_details_convictions || []).filter(
    c => !(isInvalid(c.fir_no) && isInvalid(c.description)),
  );

  /* Group pending cases by category */
  const grouped = {};
  for (const cat of CATEGORY_ORDER) {
    const arr = validPending.filter(c => c.category === cat);
    if (arr.length) grouped[cat] = arr;
  }
  /* Uncategorised → Minor/Other */
  const uncategorised = validPending.filter(c => !CATEGORY_ORDER.includes(c.category));
  if (uncategorised.length) {
    grouped['Minor/Other'] = [...(grouped['Minor/Other'] || []), ...uncategorised];
  }

  const catBreakdown = summary.pending_by_category || {};
  const hasDetails   = validPending.length > 0;
  const detailsGap   = !hasDetails && !hasNoCases;

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

      {/* ── Cases ─────────────────────────────────────────────────────── */}
      {!hasNoCases && (
        <>
          {/* Summary count + category pills */}
          <div style={{ marginBottom: '1.5rem' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
          </div>

          {/* Per-case detail grouped by category */}
          {hasDetails && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => (
                <CategoryGroup key={cat} cat={cat} cases={grouped[cat]} />
              ))}
            </div>
          )}

          {/* Declared but not yet extracted */}
          {detailsGap && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '0.5rem',
              backgroundColor: 'var(--surface-container-high)',
              border: '1px solid var(--outline-variant)',
              fontSize: '0.8rem', color: 'var(--on-surface-variant)', lineHeight: 1.6,
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.1rem' }}>
                hourglass_empty
              </span>
              Detailed case breakdown is being extracted from the affidavit. The count above is from the affidavit summary page.
            </div>
          )}

          {/* Convictions */}
          {validConvictions.length > 0 && (
            <div style={{
              marginTop: '1.25rem', paddingTop: '1rem',
              borderTop: '1px solid var(--outline-variant)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                marginBottom: '0.6rem', paddingBottom: '0.4rem',
                borderBottom: '2px solid color-mix(in srgb, var(--error) 28%, transparent)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: 'var(--error)' }}>
                  gavel
                </span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800, color: 'var(--error)',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Convictions
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, color: 'var(--error)', opacity: 0.72 }}>
                  {validConvictions.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {validConvictions.map((c, i) => (
                  <CaseCard key={i} caseItem={c} accentColor="var(--error)" isConviction />
                ))}
              </div>
            </div>
          )}

          {/* Source footnote */}
          <p style={{
            fontSize: '0.68rem', color: 'var(--on-surface-variant)',
            marginTop: '1.25rem', lineHeight: 1.55,
            paddingTop: '0.75rem', borderTop: '1px solid var(--outline-variant)',
          }}>
            Self-disclosed in the candidate's sworn affidavit filed with the Election Commission of India for the 2024 Andhra Pradesh Assembly elections. FIR numbers, IPC/CrPC sections, and case descriptions are reproduced as declared.
          </p>
        </>
      )}
    </section>
  );
};

export default CriminalRecordsSection;
