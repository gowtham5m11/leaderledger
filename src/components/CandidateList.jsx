import React from 'react';
import { useNavigate } from 'react-router-dom';
import candidates from '../data/candidates.json';
import LeaderCard from './LeaderCard';
import Footer from './Footer';

const CandidateList = () => {
  const navigate = useNavigate();

  const getPriorityIndex = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("chandrababu naidu")) return 0;
    if (lowerName.includes("pawan kalyan")) return 1;
    if (lowerName.includes("nara lokesh")) return 2;
    if (lowerName.includes("jagan mohan reddy")) return 3;
    return 999;
  };
  const filteredLeaders = [...candidates]
    .sort((a, b) => getPriorityIndex(a.name) - getPriorityIndex(b.name));


  return (
    <div className="bg-surface text-on-surface custom-scrollbar" style={{ height: '100%', overflowY: 'auto', fontFamily: "'Outfit', sans-serif" }}>
      <main className="mx-auto" style={{ maxWidth: '1200px', padding: '4rem 1.5rem' }}>
        
        {/* Title Section */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 className="display-lg text-on-surface" style={{ marginBottom: '1rem' }}>Assembly Leaders</h1>
          <p className="body-md text-on-surface-variant" style={{ maxWidth: '42rem' }}>
            Explore the profiles of legislative leaders. Our Sovereign Ledger ensures every record is transparent, verified, and accessible for the informed citizen.
          </p>
        </div>

        {/* Status Bar */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '1.5rem', 
          marginBottom: '3rem' 
        }}>
          {/* Status Chip */}
          <div className="bg-surface-container-low" style={{ 
            padding: '1rem 1.5rem', 
            borderRadius: '1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            border: '1px solid var(--outline-variant)'
          }}>
            <div>
              <span className="label-sm text-primary">Live Status</span>
              <h3 className="title-md" style={{ marginTop: '0.25rem' }}>{candidates.length} MLAs Tracked</h3>
            </div>
          </div>
        </div>

        {/* Leader Grid */}
        <div className="leader-grid">
          {filteredLeaders.length > 0 ? (
            filteredLeaders.map((leader) => (
              <LeaderCard 
                key={leader.id} 
                leader={leader} 
                onClick={() => navigate(`/profile/${leader.id}`)}
              />
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', opacity: 0.5 }}>
               <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem' }}>search_off</span>
               <p className="headline-md">No leaders found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CandidateList;


