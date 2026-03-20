import React from 'react';

const LeaderCard = ({ leader, onClick }) => {
  const { name, constituency, party, education, criminal_cases } = leader;
  
  // Format party for styling
  const partyLower = party.toLowerCase();
  let partyClass = '';
  if (partyLower.includes('tdp')) partyClass = 'card-tdp';
  else if (partyLower.includes('ysrcp')) partyClass = 'card-ysrcp';
  else if (partyLower.includes('janasena') || partyLower === 'jsp') partyClass = 'card-jsp';

  const hasCriminalCases = parseInt(criminal_cases) > 0;

  return (
    <div className={`leader-card ${partyClass}`} onClick={onClick}>
      <div className="card-header">

        <span className="label-sm text-primary" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>
          {constituency}
        </span>
        <h3 className="title-md" style={{ fontSize: '1.25rem', marginTop: '0.25rem', color: 'var(--on-surface)' }}>
          {name}
        </h3>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--outline)' }}>
            groups
          </span>
          <span className="body-md" style={{ fontWeight: 600 }}>{party}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--outline)' }}>
            school
          </span>
          <span className="body-md" style={{ opacity: 0.8 }}>{education}</span>
        </div>
      </div>

      <div className="card-footer" style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--primary)', opacity: 0.5 }}>
          arrow_forward
        </span>
      </div>
    </div>
  );
};

export default LeaderCard;
