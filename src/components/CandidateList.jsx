import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import candidates from '../data/candidates.json';
import LeaderCard from './LeaderCard';
import Footer from './Footer';
import { partyColor } from '../data/mockData';

const PARTY_OPTIONS = ['TDP', 'Janasena Party', 'YSRCP', 'BJP'];
const CASE_BUCKETS = [
  { id: '0', label: 'No cases', test: (n) => n === 0 },
  { id: '1-2', label: '1–2 cases', test: (n) => n >= 1 && n <= 2 },
  { id: '3-5', label: '3–5 cases', test: (n) => n >= 3 && n <= 5 },
  { id: '6+', label: '6+ cases', test: (n) => n >= 6 },
];
const SORT_OPTIONS = [
  { id: 'priority', label: 'Featured first' },
  { id: 'name_asc', label: 'Name (A → Z)' },
  { id: 'name_desc', label: 'Name (Z → A)' },
  { id: 'cons_asc', label: 'Constituency (A → Z)' },
  { id: 'cases_desc', label: 'Cases (high → low)' },
  { id: 'cases_asc', label: 'Cases (low → high)' },
];

const toCaseCount = (raw) => {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
};

const CandidateList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQuery = searchParams.get('q') || '';          // shared with the header search bar (?q=)
  const query = rawQuery.trim().toLowerCase();

  const selectedParties = (searchParams.get('party') || '').split(',').filter(Boolean);
  const selectedCases = (searchParams.get('cases') || '').split(',').filter(Boolean);
  const sortBy = searchParams.get('sort') || 'priority';
  const ministersOnly = searchParams.get('boost') === 'ministers';

  const isMinister = (c) => Array.isArray(c.ministries) && c.ministries.length > 0;

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const toggleInList = (key, current, value) => {
    const set = new Set(current);
    if (set.has(value)) set.delete(value); else set.add(value);
    setParam(key, [...set].join(','));
  };

  const getPriorityIndex = (name) => {
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes("chandrababu naidu")) return 0;
    if (lowerName.includes("pawan kalyan")) return 1;
    if (lowerName.includes("nara lokesh")) return 2;
    if (lowerName.includes("jagan mohan reddy")) return 3;
    return 999;
  };

  const filteredLeaders = candidates
    .filter((l) => {
      if (query) {
        const matchesName = (l.name || '').toLowerCase().includes(query);
        const matchesConstituency = (l.constituency || '').toLowerCase().includes(query);
        const matchesMinistry = (l.ministries || []).some(m =>
          (m.name || '').toLowerCase().includes(query)
        );
        if (!(matchesName || matchesConstituency || matchesMinistry)) return false;
      }
      if (selectedParties.length && !selectedParties.includes(l.party)) return false;
      if (selectedCases.length) {
        const n = toCaseCount(l.criminal_cases);
        const inAnyBucket = selectedCases.some(b => {
          const bucket = CASE_BUCKETS.find(x => x.id === b);
          return bucket ? bucket.test(n) : false;
        });
        if (!inAnyBucket) return false;
      }
      if (ministersOnly && !isMinister(l)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const pDiff = getPriorityIndex(a.name) - getPriorityIndex(b.name);
      if (pDiff !== 0) return pDiff;

      switch (sortBy) {
        case 'name_asc': return (a.name || '').localeCompare(b.name || '');
        case 'name_desc': return (b.name || '').localeCompare(a.name || '');
        case 'cons_asc': return (a.constituency || '').localeCompare(b.constituency || '');
        case 'cases_desc': return toCaseCount(b.criminal_cases) - toCaseCount(a.criminal_cases);
        case 'cases_asc': return toCaseCount(a.criminal_cases) - toCaseCount(b.criminal_cases);
        default: return 0;
      }
    });

  const anyFilterActive = selectedParties.length > 0 || selectedCases.length > 0 || sortBy !== 'priority' || ministersOnly;
  const clearAll = () => {
    const next = new URLSearchParams();
    if (rawQuery) next.set('q', rawQuery);
    setSearchParams(next, { replace: true });
  };

  const chipStyle = (active, accent) => ({
    padding: '0.45rem 0.95rem',
    borderRadius: '999px',
    border: `1px solid ${active ? (accent || 'var(--primary)') : 'var(--outline-variant)'}`,
    background: active ? (accent || 'var(--primary)') : 'transparent',
    color: active ? 'var(--on-primary)' : 'var(--on-surface)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: "'Outfit', sans-serif",
    whiteSpace: 'nowrap',
  });

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
              <h3 className="title-md" style={{ marginTop: '0.25rem' }}>
                {candidates.length} MLAs Tracked
              </h3>
            </div>
            {anyFilterActive && (
              <div className="body-md text-on-surface-variant" style={{ textAlign: 'right' }}>
                Showing <strong style={{ color: 'var(--on-surface)' }}>{filteredLeaders.length}</strong> of {candidates.length}
              </div>
            )}
          </div>

          {/* Filters + Sort */}
          <div className="bg-surface-container-low" style={{
            padding: '1.25rem 1.5rem',
            borderRadius: '1.5rem',
            border: '1px solid var(--outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <span className="label-sm text-on-surface-variant" style={{ minWidth: '4.5rem' }}>Party</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {PARTY_OPTIONS.map((p) => {
                  const active = selectedParties.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleInList('party', selectedParties, p)}
                      style={chipStyle(active, partyColor(p))}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <span className="label-sm text-on-surface-variant" style={{ minWidth: '4.5rem' }}>Cases</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {CASE_BUCKETS.map((b) => {
                  const active = selectedCases.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleInList('cases', selectedCases, b.id)}
                      style={chipStyle(active)}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
              <span className="label-sm text-on-surface-variant" style={{ minWidth: '4.5rem' }}>Ministers</span>
              <button
                type="button"
                onClick={() => setParam('boost', ministersOnly ? '' : 'ministers')}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '999px',
                  border: `1px solid ${ministersOnly ? 'var(--primary)' : 'var(--outline)'}`,
                  background: ministersOnly ? 'var(--primary)' : 'var(--primary-container)',
                  color: ministersOnly ? 'var(--on-primary)' : 'var(--on-surface)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: ministersOnly ? 'var(--shadow-2)' : 'var(--shadow-1)',
                  whiteSpace: 'nowrap',
                }}
                aria-pressed={ministersOnly}
              >
                {ministersOnly && (
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>check</span>
                )}
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>account_balance</span>
                Ministers
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem',
              borderTop: '1px solid var(--outline-variant)',
              paddingTop: '1rem'
            }}>
              <span className="label-sm text-on-surface-variant" style={{ minWidth: '4.5rem' }}>Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setParam('sort', e.target.value === 'priority' ? '' : e.target.value)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '999px',
                  border: '1px solid var(--outline-variant)',
                  background: 'var(--surface-container)',
                  color: 'var(--on-surface)',
                  fontSize: '0.85rem',
                  fontFamily: "'Outfit', sans-serif",
                  cursor: 'pointer',
                }}
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              {anyFilterActive && (
                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '999px',
                    border: '1px solid var(--outline-variant)',
                    background: 'transparent',
                    color: 'var(--on-surface-variant)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Clear filters
                </button>
              )}
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
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', opacity: 0.6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '4rem', marginBottom: '1rem', display: 'block' }}>search_off</span>
              <p className="headline-md">
                {rawQuery ? `No leaders found matching “${rawQuery}”` : 'No leaders match the current filters'}
              </p>
              <p className="body-md text-on-surface-variant" style={{ marginTop: '0.5rem' }}>
                {rawQuery ? 'Try a different name, constituency or ministry.' : 'Try removing a party or case filter.'}
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CandidateList;
