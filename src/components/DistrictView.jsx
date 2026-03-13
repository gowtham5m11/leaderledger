import React, { useState } from 'react';
import MapChart from './MapChart';
import { mockNews, getDistrictData } from '../data/mockData';

const MapTooltip = ({ data }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!data) return null;

  return (
    <div 
      className="district-tooltip"
      style={{ 
        top: mousePos.y + 15, 
        left: mousePos.x + 15,
        position: 'fixed',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <img src={data.image} alt={data.currentMla} className="tooltip-img" />
      <div className="tooltip-info">
        <h4>{data.name}</h4>
        <p>{data.currentMla}</p>
        <span 
          className="party-badge" 
          style={{ backgroundColor: data.party === 'TDP' ? '#fce903' : data.party === 'YSRCP' ? '#00249c' : '#e63946', color: data.party === 'TDP' ? '#000' : '#fff' }}
        >
          {data.party}
        </span>
      </div>
    </div>
  );
};

const DistrictView = () => {
  const [tooltipData, setTooltipData] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  return (
    <div className="district-layout">
      <div className="map-wrapper" style={{ flex: 1, position: 'relative', height: '100%' }}>
        <MapChart 
          setTooltipContent={setTooltipData} 
          onDistrictClick={setSelectedDistrict}
        />
        <MapTooltip data={tooltipData} />
      </div>

      <div className="details-panel-container">
        {selectedDistrict ? (
          <div className="details-panel micro-anim">
            <h2>{selectedDistrict.name} District</h2>
            
            <div className="stat-grid">
              <div className="stat-item">
                <div className="stat-label">Population</div>
                <div className="stat-value">{selectedDistrict.population}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Voters</div>
                <div className="stat-value">{selectedDistrict.votersCount}</div>
              </div>
              <div className="stat-item" style={{ borderLeftColor: '#fce903' }}>
                <div className="stat-label">Current Representative</div>
                <div className="stat-value">{selectedDistrict.currentMla}</div>
              </div>
              <div className="stat-item" style={{ borderLeftColor: '#00249c' }}>
                <div className="stat-label">Past Representative</div>
                <div className="stat-value">{selectedDistrict.pastMla}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Party Changes Since Inception</div>
                <div className="stat-value">{selectedDistrict.partyChanges}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Majority Votes Secured</div>
                <div className="stat-value">{selectedDistrict.majorityVotes}</div>
              </div>
            </div>

            <div className="news-section">
              <h3>Fresh Political News</h3>
              <div className="news-list">
                {mockNews.slice(0, 3).map((news, i) => (
                  <div key={i} className="news-card">
                    <span className="news-time">{Math.max(1, i * 12)} hours ago</span>
                    <p>{news.replace('13 districts', 'this district')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="details-panel empty-state">
            <p style={{ color: '#888', fontSize: '1.2rem', textAlign: 'center', margin: 0 }}>
              Hover & click a district<br/>to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DistrictView;
