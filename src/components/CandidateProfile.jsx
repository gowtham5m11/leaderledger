import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flag } from 'lucide-react';
import candidates from '../data/candidates.json';
import { partyColors, partyColor as partyColorVar, sectorColor, sectorLabel } from '../data/mockData';
import { getAssetPath } from '../utils/assetHelper';
import { safeHref } from '../utils/safeHref';
import BookmarkButton from './BookmarkButton';
import ReportModal from './ReportModal';
import { useAuth } from '../auth/AuthContext';
import { loadNewsForCandidate } from '../data/newsClient';

const PROFILE_NEWS_LIMIT = 3;

const profileRtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const profileRelativeTime = (iso) => {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const deltaSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) return profileRtf.format(deltaSec, 'second');
  if (abs < 3600) return profileRtf.format(Math.round(deltaSec / 60), 'minute');
  if (abs < 86400) return profileRtf.format(Math.round(deltaSec / 3600), 'hour');
  if (abs < 86400 * 7) return profileRtf.format(Math.round(deltaSec / 86400), 'day');
  if (abs < 86400 * 30) return profileRtf.format(Math.round(deltaSec / (86400 * 7)), 'week');
  if (abs < 86400 * 365) return profileRtf.format(Math.round(deltaSec / (86400 * 30)), 'month');
  return profileRtf.format(Math.round(deltaSec / (86400 * 365)), 'year');
};

const CandidateProfile = ({ candidate: propCandidate, onBack }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { configured, requireAuth } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [newsItems, setNewsItems] = useState(null); // null=loading, []=empty

  const effectiveId = propCandidate ? propCandidate.id : id;
  React.useEffect(() => {
    let alive = true;
    setNewsItems(null);
    if (!effectiveId) return undefined;
    loadNewsForCandidate(effectiveId).then((items) => {
      if (alive) setNewsItems(items || []);
    });
    return () => { alive = false; };
  }, [effectiveId]);

  const candidate = propCandidate || candidates.find(l => String(l.id) === String(id));

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleOpenReport = async () => {
    const user = await requireAuth();
    if (user) setReportOpen(true);
  };

  if (!candidate) return <div style={{ padding: '3rem', textAlign: 'center', fontSize: '2rem' }}>Loading Candidate...</div>;

  const partyHex = partyColors[candidate.party] || '#737970';   // literal hex — for the avatar URL
  const partyColor = partyColorVar(candidate.party);            // CSS var — auto-brightens YSRCP on dark
  const isTDP = candidate.party === 'TDP';

  // Fallback for missing fields in leaders.json
  const displayImage = candidate.image ? getAssetPath(candidate.image) : `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=${partyHex.replace('#', '')}&color=fff&size=200`;
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
      fontFamily: "'Outfit', sans-serif"
    }}>
      <main className="page-main">
        
        {/* Back + actions row */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
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

          {configured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span data-tour="bookmark" style={{ display: 'inline-flex' }}>
                <BookmarkButton candidateId={candidate.id} variant="pill" size="lg" stopPropagation={false} />
              </span>
              <button
                data-tour="report"
                onClick={handleOpenReport}
                title="Report inaccurate data"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: 'var(--surface-container-high)',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--outline-variant)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Flag size={16} />
                Report inaccuracy
              </button>
            </div>
          )}
        </div>

        {configured && (
          <ReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            candidate={candidate}
          />
        )}

        {/* Master Profile Card */}
        <div style={{ 
          backgroundColor: 'var(--surface-container-lowest)', 
          borderRadius: '1.5rem', 
          overflow: 'hidden', 
          border: '1px solid var(--outline-variant)',
          boxShadow: 'var(--shadow-strong)'
        }}>

          {/* Hero Header Section */}
          <div className="profile-hero">
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
              <div className="profile-photo">
                <img
                  src={displayImage}
                  alt={candidate.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=${partyHex.replace('#', '')}&color=fff&size=200`;
                  }}
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
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  display: 'inline-block',
                  backgroundColor: isTDP
                    ? 'color-mix(in srgb, var(--tdp) 28%, transparent)'
                    : 'color-mix(in srgb, var(--primary) 14%, transparent)',
                  color: 'var(--primary)',
                  border: '1px solid var(--outline-variant)'
                }}>
                  {displayRole}
                </span>
                <h1 className="profile-hero-name">
                  {candidate.name}
                </h1>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}>
                  <div style={{ width: '4px', height: '1.5rem', backgroundColor: partyColor, flexShrink: 0 }}></div>
                  <p className="profile-hero-subtitle">
                    {displayMinistry} • <span style={{ fontWeight: 700, color: partyColor }}>{candidate.party}</span>
                  </p>
                </div>
              </div>


              {/* Info Grid */}
              <div className="profile-info-grid">
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Age / DOB</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.age || candidate.dob || 'Unknown'}</p>
                </div>
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Experience</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.experience || 'N/A'}</p>
                </div>
                <div data-tour="education" style={{ gridColumn: 'span 3' }}>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Education</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{displayEducation}</p>
                </div>
                <div data-tour="profession" style={{ gridColumn: 'span 3' }}>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Profession</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{displayProfession}</p>
                </div>

                {/* Portfolios held — sector-coloured chips, primary first */}
                {ministries.length > 0 && (
                  <div data-tour="ministries" style={{ gridColumn: 'span 3' }}>
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
                            className="ministry-chip"
                            style={{
                              fontWeight: idx === 0 ? 700 : 600,
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
                  <div data-tour="social" style={{ gridColumn: 'span 3', borderTop: '1px solid var(--outline-variant)', paddingTop: '1.5rem', marginTop: '1rem' }}>
                    <p className="label-sm text-outline" style={{ marginBottom: '0.75rem' }}>Official Social Media / Contact</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {candidate.social_media.facebook && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Facebook:</span>
                          <a href={safeHref(candidate.social_media.facebook)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {candidate.social_media.facebook}
                          </a>
                        </div>
                      )}
                      {candidate.social_media.instagram && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Instagram:</span>
                          <a href={safeHref(candidate.social_media.instagram)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
                            {candidate.social_media.instagram}
                          </a>
                        </div>
                      )}
                      {candidate.social_media.x && (
                        <div style={{ fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Twitter/X:</span>
                          <a href={safeHref(candidate.social_media.x)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--on-surface-variant)', wordBreak: 'break-all' }}>
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
          <div className="profile-content-split">
            {/* Left Column: Timeline */}
            <div className="profile-timeline">
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
                      <h3 className="profile-timeline-place">{loc.place}</h3>
                      <p style={{ color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                        Committed public service record in the {loc.place} constituency, prioritizing governance and local community development initiatives with a focus on transparency and accountability.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Critical Info & News */}
            <div className="profile-side">
              {/* Criminal Record Section */}
              <section data-tour="criminal" className="profile-criminal" style={{
                backgroundColor: hasNoCases ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--error-container)',
                borderLeft: `4px solid ${hasNoCases ? 'var(--primary)' : 'var(--error)'}`
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
                    <p className="profile-case-count" style={{ color: hasNoCases ? 'var(--primary)' : 'var(--error)' }}>{displayCriminalCases} Pending Cases</p>
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

              {/* Latest News Section — hidden entirely when no items (strict no-estimates) */}
              {Array.isArray(newsItems) && newsItems.length > 0 && (
                <section>
                  <h3 className="profile-section-title" style={{ marginBottom: '1.5rem' }}>In the Headlines</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {newsItems.slice(0, PROFILE_NEWS_LIMIT).map((item, i, arr) => {
                      const href = safeHref(item.url);
                      return (
                        <div key={`${item.url}:${i}`}>
                          <span className="label-sm text-outline" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            {(item.source || 'Source unknown')} · {profileRelativeTime(item.published_at).toUpperCase()}
                          </span>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontWeight: 600,
                              color: 'var(--on-surface)',
                              lineHeight: 1.3,
                              textDecoration: 'none',
                              display: 'block',
                            }}
                          >
                            {item.title}
                          </a>
                          {i !== arr.length - 1 && (
                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--outline-variant)', marginTop: '1rem' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/news')}
                    style={{
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
                    }}
                  >
                    See All Media Coverage
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>

        {/* Floating Comparison Action */}
        <div className="profile-compare-box">
          <div>
            <h3 className="profile-section-title" style={{ marginBottom: '0.25rem', color: 'var(--on-primary)' }}>Analyze & Compare</h3>
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
