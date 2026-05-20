import React from 'react';
import { useNavigate } from 'react-router-dom';
import candidates from '../data/candidates.json';
import { useReactions } from '../reactions/ReactionsContext';
import { useAuth } from '../auth/AuthContext';
import { partyColor } from '../data/mockData';
import { getAssetPath } from '../utils/assetHelper';
import Footer from '../components/Footer';

const TOP_N = 5;
const byId = new Map(candidates.map((c) => [String(c.id), c]));

// Rank candidates by one reaction counter, highest first, dropping zeros.
const rankBy = (counts, key) =>
  Object.entries(counts)
    .map(([cid, c]) => ({ cid, count: c[key] || 0, candidate: byId.get(String(cid)) }))
    .filter((x) => x.count > 0 && x.candidate)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);

const InsightRow = ({ rank, candidate, count, accent, onOpen }) => {
  const hex = partyColor(candidate.party);
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        width: '100%',
        textAlign: 'left',
        padding: '0.75rem',
        minHeight: 44,
        borderRadius: '0.85rem',
        border: '1px solid var(--outline-variant)',
        background: 'var(--surface-container-lowest)',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: '1.6rem',
          fontSize: '1rem',
          fontWeight: 800,
          color: 'var(--outline)',
          textAlign: 'center',
        }}
      >
        {rank}
      </span>
      <img
        src={getAssetPath(candidate.image)}
        alt={candidate.name}
        style={{
          width: '2.75rem',
          height: '2.75rem',
          borderRadius: '0.75rem',
          objectFit: 'cover',
          flexShrink: 0,
          border: '2px solid var(--outline-variant)',
        }}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
            candidate.name,
          )}&background=random&color=fff`;
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 700,
            color: 'var(--on-surface)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {candidate.name}
        </p>
        <p
          className="label-sm"
          style={{ color: 'var(--on-surface-variant)', marginTop: '0.1rem' }}
        >
          {candidate.constituency} ·{' '}
          <span style={{ color: hex, fontWeight: 700 }}>{candidate.party}</span>
        </p>
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: '1.15rem',
          fontWeight: 800,
          color: accent,
        }}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
};

const InsightSection = ({ emoji, title, blurb, accent, rows, navigate }) => (
  <section
    style={{
      background: 'var(--surface-container-low)',
      border: '1px solid var(--outline-variant)',
      borderRadius: '1.5rem',
      padding: '1.5rem',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
      <span style={{ fontSize: '1.5rem' }} aria-hidden="true">
        {emoji}
      </span>
      <h2 className="headline-md" style={{ color: 'var(--on-surface)' }}>
        {title}
      </h2>
    </div>
    <p
      className="body-md text-on-surface-variant"
      style={{ marginBottom: '1.25rem' }}
    >
      {blurb}
    </p>
    {rows.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {rows.map((row, i) => (
          <InsightRow
            key={row.cid}
            rank={i + 1}
            candidate={row.candidate}
            count={row.count}
            accent={accent}
            onOpen={() => navigate(`/profile/${row.cid}`)}
          />
        ))}
      </div>
    ) : (
      <p
        className="body-md text-on-surface-variant"
        style={{ opacity: 0.7, padding: '1rem 0' }}
      >
        No reactions in this category yet. Be the first to weigh in from a
        candidate&rsquo;s profile.
      </p>
    )}
  </section>
);

const InsightsPage = () => {
  const navigate = useNavigate();
  const { configured } = useAuth();
  const { counts, loading } = useReactions();

  const mostConcerning = rankBy(counts, 'concerned');
  const mostInvestigated = rankBy(counts, 'needs_investigation');

  return (
    <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <main className="page-main">
        <div className="list-title-block" style={{ marginBottom: '2.5rem' }}>
          <h1 className="display-lg text-on-surface" style={{ marginBottom: '1rem' }}>
            Community Insights
          </h1>
          <p className="body-md text-on-surface-variant" style={{ maxWidth: '42rem' }}>
            How readers are reacting to the public records on this site. These
            are crowd signals, not verified facts — read each candidate&rsquo;s
            profile for the underlying disclosures.
          </p>
        </div>

        {!configured ? (
          <p className="body-md text-on-surface-variant">
            Community reactions are unavailable in this environment.
          </p>
        ) : loading ? (
          <p className="body-md text-on-surface-variant">Loading reactions…</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: '1.5rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            <InsightSection
              emoji="😠"
              title="Most Concerning"
              blurb="Candidates readers flagged as most concerning."
              accent="var(--error)"
              rows={mostConcerning}
              navigate={navigate}
            />
            <InsightSection
              emoji="🔍"
              title="Most Investigated"
              blurb="Candidates readers most want investigated further."
              accent="var(--primary)"
              rows={mostInvestigated}
              navigate={navigate}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default InsightsPage;
