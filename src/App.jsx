import React, { useState } from 'react';
import Header from './components/Header';
import DistrictView from './components/DistrictView';
import CandidateList from './components/CandidateList';
import CandidateProfile from './components/CandidateProfile';

function App() {
  const [viewMode, setViewMode] = useState('district'); // 'district' | 'list' | 'profile'
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const navigateTo = (view) => {
    setViewMode(view);
  };

  const handleSelectCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setViewMode('profile');
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  // For Header compatibility: it checks for 'district' or 'candidate'
  const headerViewMode = viewMode === 'district' ? 'district' : 'candidate';
  const toggleView = () => {
    if (viewMode === 'district') {
      navigateTo('list');
    } else {
      navigateTo('district');
    }
  };

  return (
    <div className="app-container">
      <Header viewMode={headerViewMode} toggleView={toggleView} />

      <main className={`main-content${viewMode === 'district' ? ' map-full-screen' : ''}`}>
        {viewMode === 'district' && <DistrictView />}
        {viewMode === 'list' && <CandidateList onSelectCandidate={handleSelectCandidate} />}
        {viewMode === 'profile' && (
          <CandidateProfile candidate={selectedCandidate} onBack={handleBackToList} />
        )}
      </main>

      {/* Floating Bottom Navigation - matches Stitch design */}
      <div style={{
        position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '9999px', padding: '0.75rem 2.5rem',
        display: 'flex', alignItems: 'center', gap: '2.5rem',
        zIndex: 200,
        boxShadow: '0 20px 40px rgba(25,28,27,0.12), 0 0 0 1px rgba(195,200,190,0.2)',
      }}>
        {[
          { label: 'Map', icon: 'explore', view: 'district' },
          { label: 'List', icon: 'format_list_bulleted', view: 'list' },
          { label: 'Compare', icon: 'compare_arrows', view: null },
          { label: 'Profile', icon: 'account_circle', view: selectedCandidate ? 'profile' : null },
        ].map(({ label, icon, view }) => {
          const isActive = viewMode === view;
          return (
            <div
              key={label}
              onClick={() => view && navigateTo(view)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                cursor: view ? 'pointer' : 'default',
                opacity: view ? (isActive ? 1 : 0.5) : 0.3,
                color: isActive ? 'var(--primary)' : 'var(--on-surface)',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => { if (view) e.currentTarget.style.opacity = '1'; }}
              onMouseOut={e => { if (view) e.currentTarget.style.opacity = isActive ? '1' : '0.5'; }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", fontSize: '24px' }}
              >
                {icon}
              </span>
              <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
