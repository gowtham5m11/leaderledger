import React from 'react';

const LeaderCard = ({ leader, onClick }) => {
  const { name, constituency, party, education, profession, criminal_cases } = leader;
  
  // Format party for styling
  const partyLower = party.toLowerCase();
  let partyClass = '';
  if (partyLower.includes('tdp')) partyClass = 'card-tdp';
  else if (partyLower.includes('ysrcp')) partyClass = 'card-ysrcp';
  else if (partyLower.includes('janasena') || partyLower === 'jsp') partyClass = 'card-jsp';
  else if (partyLower.includes('bjp')) partyClass = 'card-bjp';
  else if (partyLower.includes('inc')) partyClass = 'card-inc';

  const hasCriminalCases = parseInt(criminal_cases) > 0;

  return (
    <div className={`leader-card ${partyClass}`} onClick={onClick}>
      <div className="card-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <img 
          src={leader.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`} 
          alt={name} 
          style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', objectFit: 'cover', border: '2px solid var(--outline-variant)' }}
        />
        <div style={{ flex: 1 }}>
          <span className="label-sm text-primary" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>
            {constituency}
          </span>
          <h3 className="title-md" style={{ fontSize: '1.15rem', marginTop: '0.15rem', color: 'var(--on-surface)', lineHeight: '1.2' }}>
            {name}
          </h3>
        </div>
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

        {profession && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--outline)' }}>
              work
            </span>
            <span className="body-md" style={{ opacity: 0.8 }}>{profession}</span>
          </div>
        )}
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
