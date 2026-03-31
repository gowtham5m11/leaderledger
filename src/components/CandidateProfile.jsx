import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { partyColors } from '../data/mockData';
import candidates from '../data/candidates.json';
import Footer from './Footer';
import { trackEvent } from '../utils/analytics';

const CandidateProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const candidate = candidates.find(c => String(c.id) === String(id));

  useEffect(() => {
    if (candidate) {
      trackEvent('view_candidate', {
        candidate_id: candidate.id,
        candidate_name: candidate.name,
        party: candidate.party,
        constituency: candidate.constituency,
      });
    }
  }, [candidate]);

  if (!candidate) return <div style={{ padding: '3rem', textAlign: 'center', fontSize: '2rem' }}>Candidate Not Found</div>;

  const normalizePartyForColor = (p) => {
    const lower = p.toLowerCase();
    if (lower.includes('janasena') || lower === 'jsp') return 'JSP';
    if (lower.includes('tdp')) return 'TDP';
    if (lower.includes('ysrcp')) return 'YSRCP';
    if (lower.includes('bjp')) return 'BJP';
    if (lower.includes('inc')) return 'INC';
    return p;
  };

  const currentPartyKey = normalizePartyForColor(candidate.party);
  const partyColor = partyColors[currentPartyKey] || partyColors[candidate.party] || '#737970';
  const isTDP = currentPartyKey === 'TDP';
  const isJSP = currentPartyKey === 'JSP';

  // Fallback for missing fields in leaders.json
  const displayImage = candidate.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=${partyColor.replace('#', '')}&color=fff&size=200`;
  const displayRole = candidate.role || "Member of Legislative Assembly";
  const displayMinistry = candidate.ministry || "Legislative Leader";
  const displayCriminalCases = candidate.criminal_cases || "0";
  const displayEducation = candidate.education || "Information not available";


  return (
    <div style={{ 
      backgroundColor: 'var(--background)', 
      color: 'var(--on-background)', 
      height: '100%', 
      fontFamily: "'Outfit', sans-serif",
      overflowY: 'auto'
    }} className="custom-scrollbar">
      
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        
        {/* Back Action */}
        <div style={{ marginBottom: '2rem' }}>
          <button 
            onClick={() => navigate('/list')}
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
          boxShadow: '0 20px 40px rgba(25, 28, 27, 0.04)'
        }}>
          
          {/* Hero Header Section */}
          <div style={{ 
            padding: '4rem', 
            display: 'flex', 
            flexDirection: 'row', 
            gap: '3rem', 
            alignItems: 'flex-start', 
            position: 'relative',
            backgroundColor: 'rgba(173, 207, 168, 0.05)' // primary-container/10 roughly
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
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
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
                  backgroundColor: isTDP ? 'rgba(252, 233, 3, 0.3)' : `rgba(72, 102, 70, 0.1)`,
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
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Age</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
                    {candidate.dob && candidate.dob.includes('Age:') 
                      ? candidate.dob.replace('Age:', '').replace('(2024 Affidavits)', '').trim() 
                      : candidate.age || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Birthplace</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.birthplace || 'Andhra Pradesh'}</p>
                </div>
                <div>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Experience</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{candidate.experience || '25+ Years'}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <p className="label-sm text-outline" style={{ marginBottom: '0.25rem' }}>Education</p>
                  <p style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{displayEducation}</p>
                </div>

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
                <span style={{ height: '1px', flex: 1, backgroundColor: 'rgba(195, 200, 190, 0.3)' }}></span>
              </h2>
              
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '2px', backgroundColor: 'rgba(72, 102, 70, 0.2)' }}></div>
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
              <section style={{ 
                backgroundColor: 'rgba(255, 218, 214, 0.3)', 
                borderLeft: '4px solid var(--error)', 
                padding: '1.5rem', 
                borderRadius: '0 0.75rem 0.75rem 0' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', marginBottom: '1rem' }}>
                  <span className="material-symbols-outlined">gavel</span>
                  <h3 style={{ fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '-0.025em' }}>Criminal Disclosures</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <p style={{ color: 'var(--error)', fontWeight: 600, fontSize: '1.125rem' }}>{displayCriminalCases} Pending Cases</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>Based on official disclosures. Primarily related to public protest or administrative disputes where applicable.</p>
                  </div>

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
                    cursor: 'pointer'
                  }}>VIEW COURT AFFIDAVITS</button>
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
                      {i !== 2 && <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(195, 200, 190, 0.2)', marginTop: '1rem' }}></div>}
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
          color: 'var(--on-primary)'
        }}>
          <div>
            <h3 className="headline-md" style={{ fontSize: '1.5rem', marginBottom: '0.25rem', color: 'var(--on-primary)' }}>Analyze & Compare</h3>
            <p style={{ opacity: 0.8 }}>Evaluate this leader against other candidates in the same constituency.</p>
          </div>
          <button style={{ 
            padding: '1rem 2rem', 
            backgroundColor: '#ffffff', 
            color: 'var(--primary)', 
            fontWeight: 700, 
            borderRadius: '0.75rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <span className="material-symbols-outlined">compare_arrows</span>
            Enter Comparison Tool
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CandidateProfile;

