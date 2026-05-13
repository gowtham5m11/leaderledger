import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import candidates from '../data/candidates.json';
import { partyColors, partyColor as partyColorVar, sectorColor, sectorLabel } from '../data/mockData';

const CandidateProfile = ({ candidate: propCandidate, onBack }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const candidate = propCandidate || candidates.find(l => String(l.id) === String(id));

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };
  if (!candidate) return <div style={{ padding: '3rem', textAlign: 'center', fontSize: '2rem' }}>Loading Candidate...</div>;

  const partyHex = partyColors[candidate.party] || '#737970';   // literal hex — for the avatar URL
  const partyColor = partyColorVar(candidate.party);            // CSS var — auto-brightens YSRCP on dark
  const isTDP = candidate.party === 'TDP';

  // Fallback for missing fields in leaders.json
  const displayImage = candidate.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=${partyHex.replace('#', '')}&color=fff&size=200`;
  const ministries = Array.isArray(candidate.ministries) ? candidate.ministries : [];
  const primaryMinistry = ministries[0] || null;
  const displayRole = candidate.role || "Member of Legislative Assembly";
  const displayMinistry = primaryMinistry?.name || candidate.ministry || "Legislative Leader";
  const displayCriminalCases = candidate.criminal_cases || "0";
  const displayEducation = candidate.education || "Information not available";
  const displayProfession = candidate.profession || "Information not available";

  const invalidValues = ['NA', 'N/A', 'NIL', 'NONE', 'NOT APPLICABLE', '-', ''];
  const isInvalid = (val) => {
    if (!val) return true;
    const strVal = val.toString().trim().toUpperCase();
    return invalidValues.includes(strVal) || strVal.includes('NOT APPLICABLE');
  };

  const validPendingCases = (candidate.criminal_details_pending || []).filter(caseItem => {
    return !(isInvalid(caseItem.fir_no) && isInvalid(caseItem.description));
  });

  const hasNoCases = displayCriminalCases === "0" || displayCriminalCases === 0;

  return (
    <div style={{ 
      backgroundColor: 'var(--surface)', 
      color: 'var(--on-surface)', 
      height: '100%', 
      fontFamily: "'Outfit', sans-serif",
      overflowY: 'auto'
    }} className="custom-scrollbar">
      
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        
        {/* Back Action */}
        <div style={{ marginBottom: '2rem' }}>
          <button 
            onClick={handleBack}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: 'var(--primary)', 
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-container-low)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>arrow_back</span>
            <span style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Back to Candidates List</span>
          </button>
        </div>

        {/* Master Profile Card */}
        <div style={{ 
          backgroundColor: 'var(--surface-container-lowest)', 
          borderRadius: '1.5rem', 
          overflow: 'hidden', 
          border: '1px solid var(--outline-variant)',
          boxShadow: 'var(--shadow-strong)'
        }}>

          {/* Hero Header Section */}
          <div style={{ 
            padding: '4rem', 
            display: 'flex', 
            flexDirection: 'row', 
            gap: '3rem', 
            alignItems: 'flex-start', 
            position: 'relative',
            backgroundColor: 'var(--surface-container-low)'
          }}>
            {/* Asymmetric Decorative Element */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              right: 0, 
              width: '33%', 
              height: '100%', 
              backgroundColor: partyColor,
              opacity: 0.1,
              transform: 'skewX(-12deg) translateX(5rem)',
              zIndex: 0
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
              <div style={{ 
                width: '180px', 
                height: '180px', 
                borderRadius: '1rem', 
                overflow: 'hidden', 
                border: '4px solid var(--surface-container-low)',
                boxShadow: 'var(--shadow-2)'
              }}>
                <img 
                  src={displayImage} 
                  alt={candidate.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>
            
            <div style={{ position: 'relative', zIndex: 10, flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  letterSpacing: '0.1em', 
                  textTransform: 'uppercase',
                  alignSelf: 'flex-start',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: isTDP
                    ? 'color-mix(in srgb, var(--tdp) 28%, transparent)'
                    : 'color-mix(in srgb, var(--primary) 14%, transparent)',
                  color: 'var(--primary)',
                  border: '1px solid var(--outline-variant)'
                }}>
                  {displayRole}
                </span>
                <h1 className="display-lg" style={{ color: 'var(--on-surface)', marginTop: '0.5rem', fontSize: '3rem' }}>
                  {candidate.name}
                </h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.75rem' }}>
                  <div style={{ width: '4px', height: '1.5rem', backgroundColor: partyColor }}></div>
                  <p style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--on-surface-variant)' }}>
                    {displayMinistry} • <span style={{ fontWeight: 700, color: partyColor }}>{candidate.party}</span>
                  </p>
                </div>
              </div>


              {/* Info Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                rowGap: '2rem', 
                columnGap: '3rem', 
                marginTop: '3rem', 
                borderTop: '1px solid var(--outline-variant)', 
                paddingTop: '2.5rem' 
              }}>
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Age / DOB</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.age || candidate.dob || 'Unknown'}</p>
                </div>
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Birthplace</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.birthplace || 'Andhra Pradesh'}</p>
                </div>
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Experience</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.experience || 'N/A'}</p>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Education</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{displayEducation}</p>
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Profession</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{displayProfession}</p>
                </div>

                {/* Portfolios held — sector-coloured chips, primary first */}
                {ministries.length > 0 && (
                  <div style={{ gridColumn: 'span 3' }}>
                    <p className="label-sm text-outline" style={{ marginBottom: '0.75rem' }}>
                      Portfolios held{ministries.length > 1 ? ` (${ministries.length})` : ''}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                      {ministries.map((m, idx) => {
                        const hex = sectorColor(m.sector);
                        return (
                          <span
                            key={`${m.name}-${idx}`}
                            title={sectorLabel(m.sector)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              fontSize: '0.975rem',
                              fontWeight: idx === 0 ? 700 : 600,
                              padding: '0.6rem 1.1rem',
                              borderRadius: '9999px',
                              background: `color-mix(in srgb, ${hex} ${idx === 0 ? 22 : 14}%, transparent)`,
                              color: hex,
                              border: `1px solid color-mix(in srgb, ${hex} ${idx === 0 ? 45 : 28}%, transparent)`,
                            }}
                          >
                            <span
                              style={{
                                width: '0.65rem',
                                height: '0.65rem',
                                borderRadius: '9999px',
                                backgroundColor: hex,
                                display: 'inline-block',
                              }}
                            />
                            {m.name}
                            {idx === 0 && ministries.length > 1 && (
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                opacity: 0.78,
                              }}>Primary</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Social Media Links */}
                {(candidate.social_media?.facebook || candidate.social_media?.instagram || candidate.social_media?.x || candidate.social_media?.email || candidate.social_media?.youtube) && (
                  <div style={{ gridColumn: 'span 3', borderTop: '1px solid var(--outline-variant)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                    <p className="label-sm text-outline" style={{ marginBottom: '0.75rem' }}>Official Social Media / Contact</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {candidate.social_media.facebook && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Facebook:</span>
                          <a href={candidate.social_media.facebook} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {candidate.social_media.facebook}
                          </a>
                        </div>
                      )}
                      {candidate.social_media.instagram && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Instagram:</span>
                          <a href={candidate.social_media.instagram} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {candidate.social_media.instagram}
                          </a>
                        </div>
                      )}
                      {candidate.social_media.x && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Twitter/X:</span>
                          <a href={candidate.social_media.x} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {candidate.social_media.x}
                          </a>
                        </div>
                      )}
                      {candidate.social_media.email && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Email:</span>
                          <span style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {candidate.social_media.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Sections Split */}
          <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr' }}>
            {/* Left Column: Timeline */}
            <div style={{ 
              backgroundColor: 'var(--surface-container-low)', 
              padding: '4rem', 
              borderTop: '1px solid var(--outline-variant)',
              borderRight: '1px solid var(--outline-variant)'
            }}>
              <h2 className="headline-md" style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                Political Journey
                <span style={{ height: '1px', flex: 1, backgroundColor: 'var(--outline-variant)' }}></span>
              </h2>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '2px', backgroundColor: 'color-mix(in srgb, var(--primary) 22%, transparent)' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                  {(candidate.locations || []).map((loc, idx) => (
                    <div key={idx} style={{ position: 'relative', paddingLeft: '2.5rem' }}>
                      <div style={{ 
                        position: 'absolute', 
                        left: 0, 
                        top: '6px', 
                        width: '1.5rem', 
                        height: '1.5rem', 
                        borderRadius: '50%', 
                        backgroundColor: idx === 0 ? partyColor : 'var(--outline-variant)',
                        border: '4px solid var(--surface-container-lowest)'
                      }}></div>
                      <span className="headline-md" style={{ color: idx === 0 ? partyColor : 'var(--on-surface)', display: 'block', marginBottom: '0.5rem' }}>
                        {loc.year || (2024 - idx * 5)}
                      </span>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--on-surface)' }}>{loc.place}</h3>
                      <p style={{ color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                        Committed public service record in the {loc.place} constituency, prioritizing governance and local community development initiatives with a focus on transparency and accountability.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Critical Info & News */}
            <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '3rem', borderTop: '1px solid var(--outline-variant)' }}>
              {/* Criminal Record Section */}
              {/* Criminal Record Section */}
              <section style={{ 
                backgroundColor: hasNoCases ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--error-container)', 
                borderLeft: `4px solid ${hasNoCases ? 'var(--primary)' : 'var(--error)'}`, 
                padding: '1.5rem', 
                borderRadius: '0 0.75rem 0.75rem 0' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: hasNoCases ? 'var(--primary)' : 'var(--error)', marginBottom: '1rem' }}>
                  <span className="material-symbols-outlined">
                    {hasNoCases ? 'verified_user' : 'gavel'}
                  </span>
                  <h3 style={{ fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>
                    {hasNoCases ? 'Clean Record' : 'Criminal Disclosures'}
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <p style={{ color: hasNoCases ? 'var(--primary)' : 'var(--error)', fontWeight: 600, fontSize: '1.125rem' }}>{displayCriminalCases} Pending Cases</p>
                  </div>

                  {/* Detailed Case List */}
                  {!hasNoCases && validPendingCases.length > 0 && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      paddingRight: '0.5rem'
                    }} className="custom-scrollbar">
                      {validPendingCases.map((caseItem, idx) => (
                        <div key={idx} style={{
                          backgroundColor: 'var(--surface-container-lowest)',
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid color-mix(in srgb, var(--error) 18%, transparent)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--error)' }}>
                              FIR: {isInvalid(caseItem.fir_no) ? 'Not Specified' : caseItem.fir_no}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', lineHeight: 1.4 }}>
                            {isInvalid(caseItem.description) ? "Description not available in summary." : caseItem.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {(hasNoCases || validPendingCases.length === 0) && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>
                      Based on official disclosures. {hasNoCases ? 'No pending criminal cases declared.' : 'Primarily related to public protest or administrative disputes where applicable.'}
                    </p>
                  )}

                  {!hasNoCases && (
                    <button style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      color: 'var(--error)', 
                      textDecoration: 'underline', 
                      textDecorationThickness: '2px', 
                      textUnderlineOffset: '4px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer'
                    }}>VIEW COURT AFFIDAVITS</button>
                  )}
                </div>
              </section>

              {/* Latest News Section */}
              <section>
                <h3 className="headline-md" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>In the Headlines</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ cursor: 'pointer' }}>
                      <span className="label-sm text-outline" style={{ display: 'block', marginBottom: '0.5rem' }}>
                        {i === 0 ? 'LIVE • 2 HOURS AGO' : i === 1 ? 'YESTERDAY' : '3 DAYS AGO'}
                      </span>
                      <h4 style={{ fontWeight: 600, color: 'var(--on-surface)', lineHeight: 1.3 }}>
                        {i === 0 ? `${candidate.name} chairs high-level meet on capital progress.` : 
                         i === 1 ? `Key agricultural reform masterplan received with widespread support.` : 
                         `Constituency record: Remarkable improvements in educational infrastructure.`}
                      </h4>
                      {i !== 2 && <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--outline-variant)', marginTop: '1rem' }}></div>}
                    </div>
                  ))}
                </div>
                
                <button style={{ 
                  width: '100%', 
                  marginTop: '2rem', 
                  padding: '0.75rem', 
                  backgroundColor: 'var(--surface-container-high)', 
                  color: 'var(--on-surface)', 
                  fontSize: '0.875rem', 
                  fontWeight: 600, 
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer'
                }}>
                  See All Media Coverage
                </button>
              </section>
            </div>
          </div>
        </div>

        {/* Floating Comparison Action */}
        <div style={{ 
          marginTop: '4rem',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '2rem', 
          backgroundColor: 'var(--primary)', 
          borderRadius: '1rem',
          color: 'var(--on-primary)',
          boxShadow: 'var(--shadow-2)'
        }}>
          <div>
            <h3 className="headline-md" style={{ fontSize: '1.5rem', marginBottom: '0.25rem', color: 'var(--on-primary)' }}>Analyze & Compare</h3>
            <p style={{ opacity: 0.8 }}>Evaluate this leader against other candidates in the same constituency.</p>
          </div>
          <button style={{ 
            padding: '1rem 2rem', 
            backgroundColor: 'var(--surface-container-lowest)', 
            color: 'var(--primary)', 
            fontWeight: 700, 
            borderRadius: '0.75rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-1)'
          }}>
            <span className="material-symbols-outlined">compare_arrows</span>
            Enter Comparison Tool
          </button>
        </div>
      </main>
      <div style={{ height: '8rem' }}></div>
    </div>
  );
};

export default CandidateProfile;
