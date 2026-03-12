import React, { useState } from 'react';
import { mockCandidates, mockNews } from '../data/mockData';
import { User, ArrowLeft } from 'lucide-react';

const CandidateView = () => {
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  if (selectedCandidate) {
    return (
      <div className="candidate-full-page">
        <button className="back-btn" onClick={() => setSelectedCandidate(null)}>
          <ArrowLeft size={18} />
          Back to Candidates List
        </button>
        
        <div className="profile-card full-page-card">
          <div className="profile-header">
            <img src={selectedCandidate.image} alt={selectedCandidate.name} className="profile-img" />
            <div className="profile-title">
              <h2>{selectedCandidate.name}</h2>
              <div className="role">{selectedCandidate.role} &bull; {selectedCandidate.party}</div>
            </div>
          </div>

          <div className="profile-grid">
            <div className="info-block">
              <h4>Date of Birth</h4>
              <p>{selectedCandidate.dob}</p>
            </div>
            <div className="info-block">
              <h4>Age</h4>
              <p>{selectedCandidate.age} Years</p>
            </div>
            <div className="info-block">
              <h4>Birthplace</h4>
              <p>{selectedCandidate.birthplace}</p>
            </div>
            <div className="info-block">
              <h4>Political Experience</h4>
              <p>{selectedCandidate.experience}</p>
            </div>
            <div className="info-block">
              <h4>Educational Qualification</h4>
              <p>{selectedCandidate.education}</p>
            </div>
          </div>

          <div className="timeline">
            <h4>Timeline of Participation</h4>
            {selectedCandidate.locations.map((loc, idx) => (
              <div key={idx} className="timeline-item">
                <div className="timeline-year">{loc.year}</div>
                <div className="timeline-place">{loc.place}</div>
              </div>
            ))}
          </div>

          <div className="criminal-record">
            <h4>Criminal Record</h4>
            <p>{selectedCandidate.criminalRecord}</p>
          </div>

          <div className="news-section">
            <h3 style={{ fontFamily: 'Prata', fontSize: '1.5rem', marginBottom: '1rem' }}>Latest News About {selectedCandidate.name}</h3>
            <div className="news-list">
              {mockNews.slice(2, 4).map((news, i) => (
                <div key={i} className="news-card">
                  <span className="news-time">{i + 1} day ago</span>
                  <p>{news}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="candidate-layout">
      <div className="candidate-list">
        <h2>Assembly Candidates</h2>
        {mockCandidates.map((cand) => (
          <div 
            key={cand.id} 
            className="candidate-card-sm list-only-card"
            onClick={() => setSelectedCandidate(cand)}
          >
            <div className="cand-img-placeholder">
              {cand.image ? <img src={cand.image} alt={cand.name} /> : <User size={40} color="#666" />}
            </div>
            
            <div className="cand-info-sm">
              <h3>{cand.name}</h3>
              <div className="cand-roles">
                <span>{cand.role}</span>
                <span>{cand.ministry}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CandidateView;
