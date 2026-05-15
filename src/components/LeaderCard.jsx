import React from 'react';
import { sectorColor } from '../data/mockData';
import { getAssetPath } from '../utils/assetHelper';

const roleIcon = (role) => {
  if (!role) return null;
  if (role === 'Chief Minister') return 'star';
  if (role === 'Deputy Chief Minister') return 'workspace_premium';
  return 'account_balance';
};

const LeaderCard = ({ leader, onClick }) => {
  const { name, constituency, party, education, profession, criminal_cases, ministries, role } = leader;

  // Format party for styling
  const partyLower = party.toLowerCase();
  let partyClass = '';
  if (partyLower.includes('tdp')) partyClass = 'card-tdp';
  else if (partyLower.includes('ysrcp')) partyClass = 'card-ysrcp';
  else if (partyLower.includes('janasena') || partyLower === 'jsp') partyClass = 'card-jsp';
  else if (partyLower.includes('bjp')) partyClass = 'card-bjp';
  else if (partyLower.includes('inc')) partyClass = 'card-inc';

  const hasCriminalCases = parseInt(criminal_cases) > 0;
  const primaryMinistry = ministries && ministries.length > 0 ? ministries[0] : null;
  const extraMinistriesCount = ministries ? Math.max(0, ministries.length - 1) : 0;
  const chipHex = primaryMinistry ? sectorColor(primaryMinistry.sector) : null;
  const isTopRole = role === 'Chief Minister' || role === 'Deputy Chief Minister';

  return (
    <div className={`leader-card ${partyClass}`} onClick={onClick}>
      <div className="card-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <img
          src={getAssetPath(leader.image)}
          alt={name}
          style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', objectFit: 'cover', border: '2px solid var(--outline-variant)' }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="label-sm text-primary" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>
            {constituency}
          </span>
          <h3 className="title-md" style={{ fontSize: '1.15rem', marginTop: '0.15rem', color: 'var(--on-surface)', lineHeight: '1.2' }}>
            {name}
          </h3>
        </div>
      </div>

      {/* Ministry / role pill row — only renders for cabinet members */}
      {(role || primaryMinistry) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {isTopRole && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
              color: 'var(--primary)',
              border: '1px solid color-mix(in srgb, var(--primary) 38%, transparent)',
              whiteSpace: 'nowrap',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{roleIcon(role)}</span>
              {role === 'Chief Minister' ? 'CM' : 'Deputy CM'}
            </span>
          )}
          {primaryMinistry && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              background: `color-mix(in srgb, ${chipHex} 14%, transparent)`,
              color: chipHex,
              border: `1px solid color-mix(in srgb, ${chipHex} 32%, transparent)`,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={primaryMinistry.name}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>account_balance</span>
              {primaryMinistry.name}
              {extraMinistriesCount > 0 && (
                <span style={{
                  marginLeft: '0.35rem',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  opacity: 0.85,
                }}>+{extraMinistriesCount}</span>
              )}
            </span>
          )}
        </div>
      )}

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
