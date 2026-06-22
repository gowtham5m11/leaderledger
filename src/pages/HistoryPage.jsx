import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import { useIsMobile } from '../hooks/useIsMobile';
import candidatesRaw from '../data/candidates.json';

const candidates = Array.isArray(candidatesRaw) ? candidatesRaw : (candidatesRaw.leaders || []);

// ── Party brand colours ────────────────────────────────────────────────────
const PARTY_HEX = {
  TDP:   '#f9a825',
  YSRCP: '#1a237e',
  JSP:            '#d32f2f',
  'Janasena Party': '#d32f2f',
  BJP:            '#e65100',
  INC:            '#0277bd',
  NDA:            '#f9a825',
  IND:            '#607d8b',
  CPI:            '#b71c1c',
  CPM:            '#c62828',
  TRS:            '#e91e63',
  'Yuvajana Sramika Rythu Congress Party': '#1a237e',
  'Telugu Desam':  '#f9a825',
  'Indian National Congress': '#0277bd',
  'Bharatiya Janata Party':   '#e65100',
  OTH: '#78909c',
  NOTA: '#9e9e9e',
};

const PARTY_LABEL = {
  TDP:   'TDP',
  YSRCP: 'YSRCP',
  JSP:              'JSP',
  'Janasena Party': 'JSP',
  BJP:              'BJP',
  INC:   'INC',
  NDA:   'NDA Alliance',
  IND:   'Independent',
  CPI:   'CPI',
  CPM:   'CPM',
  TRS:   'TRS',
  'Yuvajana Sramika Rythu Congress Party': 'YSRCP',
  'Telugu Desam':            'TDP',
  'Indian National Congress':'INC',
  'Bharatiya Janata Party':  'BJP',
  OTH: 'Others',
  NOTA: 'NOTA',
};

// ── Election summary data ──────────────────────────────────────────────────
// High-level figures (seats won, CM, runner-up) are sourced from:
//   • 2024 — ECI June 2024 results portal (scraped into scraper_lab/eci_results.json)
//   • 2019 — ECI 2019 results portal (scraped into scraper_lab/eci_results_2019.json)
//   • 2014–1983 — TCPD AP Assembly Elections dataset (scraper_lab/tcpd_ap_ae.csv.gz)
//     TCPD = Trivedi Centre for Political Data, Ashoka University
//     Dataset: https://lokdhaba.ashoka.edu.in/  (State Assembly Elections → Andhra Pradesh)
//   • Seat tallies and CM names cross-checked against Wikipedia AP election articles.
//   • Alliance totals (NDA 2024, TDP+BJP 2014, TDP+BJP 1999) derived by summing
//     individual party seats from the above sources.
const ELECTIONS = [
  {
    year: 2024, tenure: '2024 – present', totalSeats: 175, era: 'post',
    winnerParty: 'NDA',
    allianceBreakdown: [{ party: 'TDP', seats: 135 }, { party: 'JSP', seats: 21 }, { party: 'BJP', seats: 8 }],
    seats: 164, runnerParty: 'YSRCP', runnerSeats: 11,
    cm: 'N. Chandrababu Naidu', cmParty: 'TDP',
    note: 'Landslide for NDA; YSRCP lost 140 seats from its 2019 majority.',
  },
  {
    year: 2019, tenure: '2019 – 2024', totalSeats: 175, era: 'post',
    winnerParty: 'YSRCP', allianceBreakdown: null,
    seats: 151, runnerParty: 'TDP', runnerSeats: 23,
    cm: 'Y.S. Jagan Mohan Reddy', cmParty: 'YSRCP',
    note: 'Historic majority; TDP reduced to 23 seats after 5 years in power.',
  },
  {
    year: 2014, tenure: '2014 – 2019', totalSeats: 175, era: 'post',
    winnerParty: 'TDP',
    allianceBreakdown: [{ party: 'TDP', seats: 102 }, { party: 'BJP', seats: 4 }],
    seats: 106, runnerParty: 'YSRCP', runnerSeats: 67,
    cm: 'N. Chandrababu Naidu', cmParty: 'TDP',
    note: 'First election after bifurcation of AP; YSRCP put up strong opposition.',
  },
  {
    year: 2009, tenure: '2009 – 2014', totalSeats: 294, era: 'pre',
    winnerParty: 'INC', allianceBreakdown: [{ party: 'INC', seats: 156 }],
    seats: 156, runnerParty: 'TDP', runnerSeats: 92,
    cm: 'Y.S. Rajasekhara Reddy', cmParty: 'INC',
    note: 'YSR won back-to-back majority. Died in office August 2009; succeeded by Konijeti Rosaiah, then Kiran Kumar Reddy.',
  },
  {
    year: 2004, tenure: '2004 – 2009', totalSeats: 294, era: 'pre',
    winnerParty: 'INC', allianceBreakdown: [{ party: 'INC', seats: 185 }],
    seats: 185, runnerParty: 'TDP', runnerSeats: 47,
    cm: 'Y.S. Rajasekhara Reddy', cmParty: 'INC',
    note: 'TDP ended after 9 years; INC+ swept with a decisive mandate.',
  },
  {
    year: 1999, tenure: '1999 – 2004', totalSeats: 294, era: 'pre',
    winnerParty: 'TDP',
    allianceBreakdown: [{ party: 'TDP', seats: 180 }, { party: 'BJP', seats: 12 }],
    seats: 180, runnerParty: 'INC', runnerSeats: 91,
    cm: 'N. Chandrababu Naidu', cmParty: 'TDP',
    note: "Naidu's second consecutive term; coalition with NDA at the Centre.",
  },
  {
    year: 1994, tenure: '1994 – 1999', totalSeats: 294, era: 'pre',
    winnerParty: 'TDP', allianceBreakdown: null,
    seats: 216, runnerParty: 'INC', runnerSeats: 26,
    cm: 'N.T. Rama Rao', cmParty: 'TDP',
    note: 'NTR won massive majority. Chandrababu Naidu replaced him as CM in Sep 1995 through an internal coup.',
  },
  {
    year: 1989, tenure: '1989 – 1994', totalSeats: 294, era: 'pre',
    winnerParty: 'INC', allianceBreakdown: null,
    seats: 181, runnerParty: 'TDP', runnerSeats: 74,
    cm: 'Marri Chenna Reddy', cmParty: 'INC',
    note: 'Congress bounced back after six years in opposition.',
  },
  {
    year: 1985, tenure: '1985 – 1989', totalSeats: 294, era: 'pre',
    winnerParty: 'TDP', allianceBreakdown: null,
    seats: 202, runnerParty: 'INC', runnerSeats: 50,
    cm: 'N.T. Rama Rao', cmParty: 'TDP',
    note: 'NTR retained power with a two-thirds majority in his second term.',
  },
  {
    year: 1983, tenure: '1983 – 1985', totalSeats: 294, era: 'pre',
    winnerParty: 'TDP', allianceBreakdown: null,
    seats: 199, runnerParty: 'INC', runnerSeats: 60,
    cm: 'N.T. Rama Rao', cmParty: 'TDP',
    note: 'TDP founded January 1982; swept to power in its very first election.',
  },
];

// ── MLA-level data sources ─────────────────────────────────────────────────
// 2024  → derived at runtime from src/data/candidates.json (election_result field).
//         candidates.json was built by scraper_lab/merge_eci_results.py reading
//         scraper_lab/eci_results.json (ECI June 2024 portal, Wayback snapshot 2025-11-06).
//         Each row's source_url points to the archived ECI constituency page.
//
// 2019  → derived at runtime from src/data/candidates.json (previous_mla field).
//         previous_mla was merged by scraper_lab/merge_2019_results.py reading
//         scraper_lab/eci_results_2019.json (ECI 2019 portal, Wayback snapshot 2019-05-26..29).
//
// 2014–1983 → fetched on demand from public/data/eci_results_{year}.json.
//         Those files are generated by scraper_lab/extract_tcpd_results.py from
//         scraper_lab/tcpd_ap_ae.csv.gz (TCPD AP Assembly Elections dataset).
//         Run `python3 scraper_lab/extract_tcpd_results.py` to regenerate.

// ── Derive 2024 MLA list from candidates.json ─────────────────────────────
function derive2024() {
  return candidates.map(c => ({
    constituency_no:   c.election_result.eci_constituency_no,
    constituency_name: c.election_result.eci_constituency_name,
    electors:          c.election_result.total_electors,
    valid_votes:       c.election_result.total_votes_polled,
    turnout_percent:   c.election_result.turnout_percent,
    nota_votes:        c.election_result.nota_votes,
    winner: {
      name:       c.name,
      party:      c.party,
      votes:      c.election_result.winner_votes,
      vote_share: c.election_result.winner_percent,
      id:         c.id,
    },
    runner_up: c.election_result.runner_up ? {
      name:  c.election_result.runner_up.name,
      party: c.election_result.runner_up.party,
      votes: c.election_result.runner_up.votes,
      vote_share: c.election_result.runner_up.percent,
    } : null,
    margin:         c.election_result.margin,
    margin_percent: c.election_result.margin_percent,
  })).sort((a, b) => a.constituency_no - b.constituency_no);
}

// ── Shared sub-components ─────────────────────────────────────────────────

const PartyChip = ({ party, seats, small }) => {
  const hex = PARTY_HEX[party] || '#888';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      gap: small ? '0.25rem' : '0.3rem',
      padding: small ? '0.18rem 0.55rem' : '0.25rem 0.65rem',
      borderRadius: '9999px',
      fontSize: small ? '0.72rem' : '0.78rem',
      fontWeight: 700,
      background: `color-mix(in srgb, ${hex} 16%, transparent)`,
      border: `1.5px solid color-mix(in srgb, ${hex} 40%, transparent)`,
      color: hex,
    }}>
      {PARTY_LABEL[party] || party}
      {seats !== undefined && (
        <span style={{
          background: `color-mix(in srgb, ${hex} 22%, transparent)`,
          borderRadius: '9999px', padding: '0 0.4rem',
          fontSize: small ? '0.68rem' : '0.73rem', fontWeight: 800,
        }}>
          {seats}
        </span>
      )}
    </span>
  );
};

const MiniPartyDot = ({ party }) => {
  const hex = PARTY_HEX[party] || '#888';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.28rem',
      fontSize: '0.72rem', fontWeight: 700, color: hex,
    }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: hex, flexShrink: 0,
      }} />
      {PARTY_LABEL[party] || party}
    </span>
  );
};

const SeatBar = ({ seats, total, hex }) => {
  const pct = Math.round((seats / total) * 100);
  const majority = Math.ceil(total / 2);
  const majorityPct = (majority / total) * 100;
  return (
    <div>
      <div style={{
        height: '6px', borderRadius: '9999px',
        background: 'var(--surface-container)', position: 'relative', overflow: 'visible',
      }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '9999px', background: hex, transition: 'width 0.4s ease' }} />
        <div style={{
          position: 'absolute', top: '-3px', left: `${majorityPct}%`,
          width: '2px', height: '12px', background: 'var(--on-surface-variant)',
          opacity: 0.4, borderRadius: '1px',
        }} />
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: '4px',
        fontSize: '0.67rem', color: 'var(--on-surface-variant)', fontWeight: 600,
      }}>
        <span>{seats} / {total} seats</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
};

// ── MLA list panel ────────────────────────────────────────────────────────

const ConstituencyRow = ({ m, year, i, navigate }) => {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();
  const hex = PARTY_HEX[m.winner.party] || '#888';
  const isClickable = year === 2024 && m.winner.id;

  // Construct candidatesList for vote shares
  const candidatesList = useMemo(() => {
    if (m.all_candidates && m.all_candidates.length > 0) {
      return [...m.all_candidates].sort((a, b) => b.votes - a.votes);
    }
    
    // Fallback for 2024 or other years missing all_candidates
    const total = m.valid_votes || 0;
    const wVotes = m.winner.votes || 0;
    const wShare = m.winner.vote_share || (total ? (wVotes / total) * 100 : 0);
    
    const list = [
      {
        position: 1,
        name: m.winner.name,
        party: m.winner.party,
        votes: wVotes,
        vote_share: parseFloat(Number(wShare).toFixed(2)),
      }
    ];
    
    if (m.runner_up) {
      const rVotes = m.runner_up.votes || 0;
      const rShare = m.runner_up.vote_share || (total ? (rVotes / total) * 100 : 0);
      list.push({
        position: 2,
        name: m.runner_up.name,
        party: m.runner_up.party,
        votes: rVotes,
        vote_share: parseFloat(Number(rShare).toFixed(2)),
      });
    }
    
    const notaVotes = m.nota_votes || 0;
    const notaShare = total ? (notaVotes / total) * 100 : 0;
    const othersVotes = Math.max(0, total - wVotes - (m.runner_up ? m.runner_up.votes : 0) - notaVotes);
    const othersShare = total ? (othersVotes / total) * 100 : 0;
    
    if (othersVotes > 0) {
      list.push({
        position: 3,
        name: 'Other Candidates',
        party: 'OTH',
        votes: othersVotes,
        vote_share: parseFloat(Number(othersShare).toFixed(2)),
      });
    }
    
    if (notaVotes > 0) {
      list.push({
        position: othersVotes > 0 ? 4 : 3,
        name: 'NOTA',
        party: 'NOTA',
        votes: notaVotes,
        vote_share: parseFloat(Number(notaShare).toFixed(2)),
      });
    }
    
    return list.sort((a, b) => b.votes - a.votes);
  }, [m, year]);

  const handleRowClick = (e) => {
    if (e.target.closest('.winner-link') || e.target.closest('.no-toggle')) {
      return;
    }
    setExpanded(prev => !prev);
  };

  return (
    <div style={{
      borderTop: i === 0 ? 'none' : '1px solid var(--outline-variant)',
      background: expanded ? 'var(--surface-container-lowest)' : 'transparent',
      transition: 'background 0.2s ease',
    }}>
      {/* Main row grid */}
      <div
        onClick={handleRowClick}
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1.8rem 1fr 1fr 4.5rem 2rem' : '2.2rem 1fr 1fr 5.5rem 2.5rem',
          gap: '0 0.5rem',
          padding: '0.65rem 0.75rem',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container-low)'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.7rem', fontWeight: 600 }}>
          {m.constituency_no}
        </span>
        
        <div>
          <div style={{ fontWeight: 600, color: 'var(--on-surface)', lineHeight: 1.2, fontSize: isMobile ? '0.78rem' : '0.82rem' }}>
            {m.constituency_name.replace(/_/g, ' ')}
          </div>
          {m.runner_up && (
            <div style={{ marginTop: '0.15rem' }}>
              <MiniPartyDot party={m.runner_up.party} />
              {!isMobile && (
                <span style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)', marginLeft: '0.25rem' }}>
                  runner-up
                </span>
              )}
            </div>
          )}
        </div>
        
        <div>
          <div 
            className={isClickable ? "winner-link" : ""}
            onClick={isClickable ? (e) => { e.stopPropagation(); navigate(`/profile/${m.winner.id}`); } : undefined}
            style={{
              fontWeight: 700, color: hex, lineHeight: 1.2,
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              cursor: isClickable ? 'pointer' : 'default',
              textDecoration: isClickable ? 'underline decoration-dotted' : 'none',
              fontSize: isMobile ? '0.78rem' : '0.82rem',
            }}
          >
            {m.winner.name}
            {isClickable && (
              <span className="material-symbols-outlined" style={{ fontSize: '0.75rem', opacity: 0.7 }}>open_in_new</span>
            )}
          </div>
          <MiniPartyDot party={m.winner.party} />
          {m.criminal_cases > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
              marginTop: '0.18rem',
              fontSize: '0.67rem', fontWeight: 700,
              color: '#c62828',
              background: 'color-mix(in srgb, #c62828 10%, transparent)',
              border: '1px solid color-mix(in srgb, #c62828 28%, transparent)',
              borderRadius: '9999px',
              padding: '0.1rem 0.45rem',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>gavel</span>
              {m.criminal_cases} case{m.criminal_cases !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--on-surface)', fontSize: '0.78rem' }}>
            {m.margin != null ? m.margin.toLocaleString('en-IN') : '—'}
          </div>
          {m.margin_percent != null && (
            <div style={{ fontSize: '0.67rem', color: 'var(--on-surface-variant)' }}>
              {m.margin_percent}%
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center' }} className="no-toggle">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
            style={{
              background: 'none', border: 'none', padding: 4, cursor: 'pointer',
              color: 'var(--on-surface-variant)', display: 'inline-flex', alignItems: 'center',
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span className="material-symbols-outlined" style={{
              fontSize: '1.2rem',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}>
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Expanded panel details */}
      {expanded && (
        <div style={{
          padding: '0.75rem 1.25rem 1.25rem 1.25rem',
          background: 'var(--surface-container-lowest)',
          borderTop: '1px solid var(--outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
            gap: '0.75rem',
          }}>
            <div style={{
              background: 'var(--surface-container-low)',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.6rem',
              border: '1px solid var(--outline-variant)',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>ELECTORS</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--on-surface)', marginTop: '0.15rem' }}>
                {m.electors ? m.electors.toLocaleString('en-IN') : '—'}
              </div>
            </div>
            
            <div style={{
              background: 'var(--surface-container-low)',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.6rem',
              border: '1px solid var(--outline-variant)',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>VOTES POLLED</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--on-surface)', marginTop: '0.15rem' }}>
                {m.valid_votes ? m.valid_votes.toLocaleString('en-IN') : '—'}
              </div>
            </div>
            
            <div style={{
              background: 'var(--surface-container-low)',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.6rem',
              border: '1px solid var(--outline-variant)',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>TURNOUT</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--on-surface)', marginTop: '0.15rem' }}>
                {m.turnout_percent ? `${m.turnout_percent}%` : '—'}
              </div>
            </div>

            <div style={{
              background: 'var(--surface-container-low)',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.6rem',
              border: '1px solid var(--outline-variant)',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>NOTA VOTES</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--on-surface)', marginTop: '0.15rem' }}>
                {m.nota_votes ? m.nota_votes.toLocaleString('en-IN') : '—'}
              </div>
            </div>
          </div>

          {/* Candidate list with share bars */}
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--on-surface-variant)',
              marginBottom: '0.6rem',
            }}>
              Candidates & Vote Share
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {candidatesList.map((cand) => {
                const candPartyHex = PARTY_HEX[cand.party] || '#78909c';
                return (
                  <div key={cand.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontWeight: 700,
                          color: cand.position === 1 ? hex : 'var(--on-surface)',
                          fontSize: '0.78rem',
                        }}>
                          {cand.name}
                        </span>
                        <PartyChip party={cand.party} small />
                        {cand.incumbent && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                          }}>
                            INCUMBENT
                          </span>
                        )}
                        {cand.age && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                            Age: {cand.age}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                          {cand.votes ? cand.votes.toLocaleString('en-IN') : '0'} votes
                        </span>
                        <span style={{ fontWeight: 800, color: 'var(--on-surface)' }}>
                          {cand.vote_share ? `${cand.vote_share}%` : '0%'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Share Bar */}
                    <div style={{
                      height: '6px',
                      borderRadius: '9999px',
                      background: 'var(--surface-container-high)',
                      overflow: 'hidden',
                      width: '100%',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${cand.vote_share || 0}%`,
                        borderRadius: '9999px',
                        background: candPartyHex,
                        transition: 'width 0.4s ease-out',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Criminal cases */}
          {m.criminal_cases > 0 && (
            <div>
              <div style={{
                fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.07em', color: '#c62828', marginBottom: '0.6rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>gavel</span>
                Criminal Cases ({m.criminal_cases})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {(m.criminal_details_convictions || []).map((c, i) => (
                  <CaseChip key={`conv-${i}`} c={c} convicted />
                ))}
                {(m.criminal_details_pending || []).map((c, i) => (
                  <CaseChip key={`pend-${i}`} c={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CaseChip = ({ c, convicted }) => {
  const fir = c.fir_number || c.fir_no || null;
  const sections = [
    ...(c.sections
      ? (Array.isArray(c.sections) ? c.sections : [c.sections])
      : []
    ).map(s => `IPC §${s}`),
    ...(c.other_acts || []),
  ].filter(Boolean);
  const desc = c.description && c.description !== fir ? c.description : null;
  const court = c.court || null;
  const accentColor = convicted ? '#7b1fa2' : '#c62828';

  return (
    <div style={{
      background: `color-mix(in srgb, ${accentColor} 6%, transparent)`,
      border: `1px solid color-mix(in srgb, ${accentColor} 22%, transparent)`,
      borderRadius: '0.5rem',
      padding: '0.45rem 0.65rem',
      fontSize: '0.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {fir && (
          <span style={{ fontWeight: 700, color: accentColor }}>FIR: {fir}</span>
        )}
        {convicted && (
          <span style={{
            fontSize: '0.62rem', fontWeight: 800, color: '#fff',
            background: accentColor, borderRadius: '3px', padding: '0.05rem 0.3rem',
          }}>CONVICTED</span>
        )}
      </div>
      {sections.length > 0 && (
        <div style={{ color: 'var(--on-surface-variant)', marginTop: '0.18rem', lineHeight: 1.4 }}>
          {sections.join(' · ')}
        </div>
      )}
      {desc && (
        <div style={{ color: 'var(--on-surface)', marginTop: '0.18rem', fontStyle: 'italic', lineHeight: 1.4 }}>
          {desc}
        </div>
      )}
      {court && (
        <div style={{ color: 'var(--on-surface-variant)', marginTop: '0.18rem', lineHeight: 1.4 }}>
          {court}
        </div>
      )}
    </div>
  );
};

const MlaList = ({ year, mlas, loading, error }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState(null);
  const isMobile = useIsMobile();

  const partyOptions = useMemo(() => {
    if (!mlas) return [];
    const counts = {};
    for (const m of mlas) {
      const p = m.winner.party;
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([p, c]) => ({ party: p, count: c }));
  }, [mlas]);

  const filtered = useMemo(() => {
    if (!mlas) return [];
    const q = search.toLowerCase().trim();
    return mlas.filter(m => {
      if (partyFilter && m.winner.party !== partyFilter) return false;
      if (q && !m.constituency_name.toLowerCase().includes(q) && !m.winner.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mlas, search, partyFilter]);

  if (loading) return (
    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
      <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.4rem', opacity: 0.5 }}>hourglass_empty</span>
      Loading MLAs…
    </div>
  );

  if (error) return (
    <div style={{ padding: '1rem', color: '#c62828', fontSize: '0.85rem' }}>
      Failed to load: {error}
    </div>
  );

  if (!mlas) return null;

  return (
    <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '1rem' }}>
      {/* Search + party filter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <div style={{ position: 'relative' }}>
          <span className="material-symbols-outlined" style={{
            position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)',
            fontSize: '1rem', color: 'var(--on-surface-variant)', pointerEvents: 'none',
          }}>search</span>
          <input
            type="text"
            placeholder="Search constituency or MLA name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.5rem 0.75rem 0.5rem 2.1rem',
              border: '1px solid var(--outline-variant)',
              borderRadius: '0.6rem',
              background: 'var(--surface-container-low)',
              color: 'var(--on-surface)',
              fontSize: '0.85rem', fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {partyOptions.map(({ party, count }) => {
            const hex = PARTY_HEX[party] || '#888';
            const active = partyFilter === party;
            return (
              <button
                key={party}
                type="button"
                onClick={() => setPartyFilter(p => p === party ? null : party)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.22rem 0.65rem', borderRadius: '9999px',
                  fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: active ? `color-mix(in srgb, ${hex} 18%, transparent)` : 'var(--surface-container)',
                  border: `1.5px solid ${active ? hex : 'var(--outline-variant)'}`,
                  color: active ? hex : 'var(--on-surface-variant)',
                  transition: 'all 0.12s',
                }}
              >
                {PARTY_LABEL[party] || party}
                <span style={{
                  background: active ? `color-mix(in srgb, ${hex} 25%, transparent)` : 'var(--surface-container-low)',
                  borderRadius: '9999px', padding: '0 0.35rem',
                  fontSize: '0.68rem', fontWeight: 800,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Count line */}
      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 600 }}>
        {filtered.length} of {mlas.length} constituencies
        {(search || partyFilter) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setPartyFilter(null); }}
            style={{
              marginLeft: '0.6rem', background: 'none', border: 'none',
              color: 'var(--primary)', fontWeight: 600, cursor: 'pointer',
              fontSize: 'inherit', fontFamily: 'inherit', padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        border: '1px solid var(--outline-variant)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        fontSize: '0.8rem',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1.8rem 1fr 1fr 4.5rem 2rem' : '2.2rem 1fr 1fr 5.5rem 2.5rem',
          gap: '0 0.5rem',
          padding: '0.45rem 0.75rem',
          background: 'var(--surface-container)',
          borderBottom: '1px solid var(--outline-variant)',
          fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--on-surface-variant)',
        }}>
          <span>#</span>
          <span>Constituency</span>
          <span>Winner</span>
          <span style={{ textAlign: 'right' }}>Margin</span>
          <span></span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.83rem' }}>
            No results match your filters.
          </div>
        ) : (
          filtered.map((m, i) => (
            <ConstituencyRow
              key={m.constituency_no}
              m={m}
              year={year}
              i={i}
              navigate={navigate}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── Election card ─────────────────────────────────────────────────────────

const ElectionCard = ({ election }) => {
  const hex = PARTY_HEX[election.winnerParty] || '#888';
  const majority = Math.ceil(election.totalSeats / 2);
  const hasMajority = election.seats >= majority;

  const [expanded, setExpanded] = useState(false);
  const [mlas, setMlas]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [fetchErr, setFetchErr] = useState(null);

  const loadMlas = useCallback(async () => {
    if (mlas || loading) return;
    setLoading(true);
    try {
      let rows;
      if (election.year === 2024) {
        rows = derive2024();
      } else {
        const res = await fetch(`/data/eci_results_${election.year}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rows = await res.json();
      }

      // Merge criminal data for years that have MyNeta data
      if ([2019, 2014, 2009].includes(election.year)) {
        try {
          const cr = await fetch(`/data/myneta_criminal_${election.year}.json`);
          if (cr.ok) {
            const crimMap = await cr.json();
            rows = rows.map(m => {
              const entry = crimMap[String(m.constituency_no)];
              return {
                ...m,
                criminal_cases: entry?.criminal_cases ?? null,
                criminal_details_pending: entry?.criminal_details_pending ?? [],
                criminal_details_convictions: entry?.criminal_details_convictions ?? [],
              };
            });
          }
        } catch (_) { /* criminal data is optional */ }
      }

      setMlas(rows);
    } catch (e) {
      setFetchErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [election.year, mlas, loading]);

  const toggle = () => {
    if (!expanded) loadMlas();
    setExpanded(v => !v);
  };

  return (
    <article style={{
      background: 'var(--surface-container-lowest)',
      border: '1px solid var(--outline-variant)',
      borderLeft: `4px solid ${hex}`,
      borderRadius: '1rem',
      padding: '1.2rem 1.3rem',
      display: 'flex', flexDirection: 'column', gap: '0.85rem',
    }}>
      {/* Year + tenure + era badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.55rem', fontWeight: 800, color: hex, lineHeight: 1 }}>
              {election.year}
            </span>
            {election.tenure && (
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                {election.tenure}
              </span>
            )}
            <span style={{
              fontSize: '0.68rem', fontWeight: 600, color: 'var(--on-surface-variant)',
              background: 'var(--surface-container)', border: '1px solid var(--outline-variant)',
              borderRadius: '0.4rem', padding: '0.15rem 0.45rem',
            }}>
              {election.era === 'post' ? 'Present AP' : 'Combined AP'} · {election.totalSeats} seats
            </span>
          </div>
          <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
            Majority: {majority}+ seats
          </div>
        </div>

        {hasMajority && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            fontSize: '0.7rem', fontWeight: 700, color: '#2e7d32',
            background: 'color-mix(in srgb, #2e7d32 12%, transparent)',
            border: '1px solid color-mix(in srgb, #2e7d32 30%, transparent)',
            borderRadius: '9999px', padding: '0.2rem 0.55rem',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>verified</span>
            Outright majority
          </span>
        )}
      </div>

      {/* Winner */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--on-surface-variant)', marginBottom: '0.4rem' }}>
          Winner
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(!election.allianceBreakdown ||
            election.allianceBreakdown.length <= 1 ||
            !election.allianceBreakdown.some(b => b.party === election.winnerParty)) && (
            <PartyChip party={election.winnerParty} seats={election.seats} />
          )}
          {election.allianceBreakdown && election.allianceBreakdown.length > 1 && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {election.allianceBreakdown.map(({ party, seats }) => (
                <PartyChip key={party} party={party} seats={seats} small />
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: '0.65rem' }}>
          <SeatBar seats={election.seats} total={election.totalSeats} hex={hex} />
        </div>
      </div>

      {/* Runner-up */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--on-surface-variant)', marginBottom: '0.4rem' }}>
          Runner-up
        </div>
        <PartyChip party={election.runnerParty} seats={election.runnerSeats} />
      </div>

      {/* CM */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.55rem 0.85rem',
        background: 'var(--surface-container-low)',
        borderRadius: '0.65rem', border: '1px solid var(--outline-variant)',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: hex }}>person</span>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--on-surface-variant)' }}>Chief Minister</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--on-surface)' }}>
            {election.cm}
            <span style={{ marginLeft: '0.45rem', fontSize: '0.75rem', fontWeight: 600, color: PARTY_HEX[election.cmParty] || hex }}>
              ({election.cmParty})
            </span>
          </div>
        </div>
      </div>

      {/* Note */}
      {election.note && (
        <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--on-surface-variant)', lineHeight: 1.55, fontStyle: 'italic' }}>
          {election.note}
        </p>
      )}

      {/* View MLAs toggle */}
      <button
        type="button"
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          padding: '0.55rem 1rem',
          borderRadius: '0.65rem',
          border: `1.5px solid color-mix(in srgb, ${hex} 35%, var(--outline-variant))`,
          background: expanded ? `color-mix(in srgb, ${hex} 10%, transparent)` : 'transparent',
          color: expanded ? hex : 'var(--on-surface-variant)',
          fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
          {expanded ? 'expand_less' : 'how_to_vote'}
        </span>
        {expanded ? 'Hide MLAs' : `View all ${election.totalSeats} MLAs`}
      </button>

      {/* MLA list */}
      {expanded && (
        <MlaList
          year={election.year}
          mlas={mlas}
          loading={loading}
          error={fetchErr}
        />
      )}
    </article>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────

const HistoryPage = () => {
  const [era, setEra] = useState('all');

  const filtered = era === 'all' ? ELECTIONS
    : era === 'post' ? ELECTIONS.filter(e => e.era === 'post')
    : ELECTIONS.filter(e => e.era === 'pre');

  return (
    <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <main className="page-main">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="display-lg text-on-surface" style={{ marginBottom: '0.5rem' }}>
            Election History
          </h1>
          <p className="body-md text-on-surface-variant" style={{ maxWidth: '42rem' }}>
            Andhra Pradesh Assembly elections — winner, runner-up, CM, and seat tallies since 1983.
          </p>
        </div>

        {/* Era filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',  label: 'All elections' },
            { key: 'post', label: 'Present AP (175 seats)' },
            { key: 'pre',  label: 'Combined AP (294 seats)' },
          ].map(({ key, label }) => {
            const active = era === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setEra(key)}
                style={{
                  padding: '0.5rem 1.1rem', borderRadius: '9999px',
                  fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit', cursor: 'pointer',
                  border: `2px solid ${active ? 'var(--primary)' : 'var(--outline-variant)'}`,
                  background: active ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {era !== 'post' && (
          <div style={{
            display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
            padding: '0.75rem 1rem', borderRadius: '0.75rem',
            background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
            marginBottom: '1.25rem',
            fontSize: '0.82rem', color: 'var(--on-surface-variant)', lineHeight: 1.5,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--primary)', flexShrink: 0, marginTop: '0.05rem' }}>info</span>
            <span>
              AP was bifurcated in <strong>June 2014</strong>, creating Telangana. Elections from 2014 onwards cover the present 175-seat assembly. Earlier elections covered the combined 294-seat undivided AP (including present-day Telangana).
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(election => (
            <ElectionCard key={election.year} election={election} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HistoryPage;
