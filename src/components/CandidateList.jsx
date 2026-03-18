import React from 'react';
import { mockCandidates, partyColors } from '../data/mockData';

const CandidateList = ({ onSelectCandidate }) => {
  return (
    <div className="bg-background text-on-surface custom-scrollbar" style={{ height: '100%', overflowY: 'auto', fontFamily: "'Outfit', sans-serif" }}>
      <main className="mx-auto" style={{ maxWidth: '1200px', padding: '4rem 1.5rem' }}>
        
        {/* Title Section */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 className="display-lg text-on-surface" style={{ marginBottom: '1rem' }}>Assembly Candidates</h1>
          <p className="body-md text-on-surface-variant" style={{ maxWidth: '42rem' }}>
            Explore the profiles of legislative leaders. Our Sovereign Ledger ensures every record is transparent, verified, and accessible for the informed citizen.
          </p>
        </div>

        {/* Filters/Bento Sub-header */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '4rem' 
        }}>
          <div className="bg-surface-container-low" style={{ 
            gridColumn: 'span 2',
            padding: '1.5rem', 
            borderRadius: '1rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            border: '1px solid var(--outline-variant)'
          }}>
            <div>
              <span className="label-sm text-primary">Live Status</span>
              <h3 className="title-md" style={{ marginTop: '0.25rem' }}>{mockCandidates.length} Constituencies Tracked</h3>
            </div>
            <div style={{ display: 'flex' }}>
              {['TDP', 'YSRCP', 'JSP'].map((party, idx) => (
                <div 
                  key={party}
                  style={{ 
                    width: '2.5rem', 
                    height: '2.5rem', 
                    borderRadius: '50%', 
                    border: '2px solid white',
                    backgroundColor: partyColors[party],
                    marginLeft: idx > 0 ? '-0.75rem' : '0'
                  }}
                ></div>
              ))}
            </div>
          </div>
          <div className="bg-primary hover:bg-surface-tint" style={{ 
            padding: '1.5rem', 
            borderRadius: '1rem', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            cursor: 'pointer',
            border: '1px solid var(--primary)',
            color: 'white'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>compare_arrows</span>
            <span className="body-md" style={{ fontWeight: 600 }}>Compare Candidates</span>
          </div>
        </div>

        {/* Candidate List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {mockCandidates.map((candidate, idx) => {
            const partyColor = partyColors[candidate.party] || '#737970';
            return (
              <div 
                key={candidate.id}
                onClick={() => onSelectCandidate && onSelectCandidate(candidate)}
                className="bg-surface-container-lowest"
                style={{ 
                  borderRadius: '1.5rem', 
                  display: 'flex',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid var(--outline-variant)',
                  borderLeft: `6px solid ${partyColor}`,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  alignItems: 'stretch'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{ padding: '1.5rem', flexShrink: 0 }}>
                  <div style={{ 
                    width: '120px', 
                    height: '120px', 
                    borderRadius: '1rem', 
                    overflow: 'hidden',
                    border: '2px solid var(--surface-container)'
                  }}>
                    <img 
                      src={candidate.image} 
                      alt={candidate.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                </div>
                <div style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h2 className="title-md" style={{ fontSize: '1.5rem', textTransform: 'uppercase' }}>
                      {candidate.name}
                    </h2>
                    <span 
                      className="label-sm"
                      style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '9999px',
                        backgroundColor: partyColor === '#fce903' ? 'rgba(252,233,3,0.2)' : partyColor,
                        color: partyColor === '#fce903' ? '#434841' : '#ffffff'
                      }}
                    >
                      {candidate.party}
                    </span>
                  </div>
                  <p className="body-md text-on-surface-variant" style={{ fontWeight: 500, marginBottom: '1rem' }}>{candidate.role}</p>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--outline)' }}>
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.2rem' }}>location_on</span>
                      {candidate.locations[0]?.place || 'Constituency'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--outline)' }}>
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.2rem' }}>history_edu</span>
                      {candidate.experience || 'Experienced Leader'}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', paddingRight: '2rem' }}>
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: '2rem' }}>chevron_right</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <div style={{ height: '8rem' }}></div>
    </div>
  );
};

export default CandidateList;
