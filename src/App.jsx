import React, { useState } from 'react';
import Header from './components/Header';
import DistrictView from './components/DistrictView';
import CandidateView from './components/CandidateView';

function App() {
  const [viewMode, setViewMode] = useState('district'); // 'district' or 'candidate'

  const toggleView = () => {
    setViewMode(prev => prev === 'district' ? 'candidate' : 'district');
  };

  return (
    <div className="app-container">
      <Header viewMode={viewMode} toggleView={toggleView} />
      <main className={`main-content ${viewMode === 'district' ? 'map-full-screen' : ''}`}>
        {viewMode === 'district' ? <DistrictView /> : <CandidateView />}
      </main>
    </div>
  );
}

export default App;
