import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import ysrcpData from '../data/ysrcp_promises.json';
import tdpData from '../data/tdp_promises.json';
import Footer from '../components/Footer';
import { ManifestoPill, CategoryBadge, PartyBadge } from '../components/AchievementBadges';
import { MANIFESTO_STATUSES, CATEGORIES, manifestoPillStyle, manifestoMeta } from '../config/achievements';

const PARTY_TABS = [
  {
    key: 'YSRCP',
    label: 'YSRCP 2019',
    data: ysrcpData,
    government: 'Y.S. Jagan Mohan Reddy Government (2019–2024)',
    election: '2019 Assembly Election',
    hex: '#1a237e',
  },
  {
    key: 'TDP',
    label: 'TDP 2024',
    data: tdpData,
    government: 'N. Chandrababu Naidu Government (2024–)',
    election: '2024 Assembly Election',
    hex: '#f9a825',
  },
];

const STATUS_ORDER = ['delivered', 'in_progress', 'promised', 'broken'];

const STATUS_ICONS = {
  delivered: 'check_circle',
  in_progress: 'pending',
  promised: 'schedule',
  broken: 'cancel',
};

const Chip = ({ label, count, active, hex, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.38rem 0.85rem',
      borderRadius: '9999px',
      fontSize: '0.82rem',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      color: active ? (hex || 'var(--primary)') : 'var(--on-surface-variant)',
      background: active
        ? `color-mix(in srgb, ${hex || 'var(--primary)'} 14%, transparent)`
        : 'var(--surface-container-low)',
      border: `1px solid ${active ? (hex || 'var(--primary)') : 'var(--outline-variant)'}`,
      transition: 'all 0.15s',
    }}
  >
    {label}
    {count !== undefined && (
      <span
        style={{
          background: active
            ? `color-mix(in srgb, ${hex || 'var(--primary)'} 22%, transparent)`
            : 'var(--surface-container)',
          borderRadius: '9999px',
          padding: '0 0.45rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          minWidth: '1.4rem',
          textAlign: 'center',
        }}
      >
        {count}
      </span>
    )}
  </button>
);

const DESC_CLAMP = 200;

const PromiseCard = ({ promise }) => {
  const [expanded, setExpanded] = useState(false);
  const desc = promise.assessment || promise.manifesto_text || '';
  const isLong = desc.length > DESC_CLAMP;
  const shown = expanded || !isLong ? desc : `${desc.slice(0, DESC_CLAMP).trimEnd()}…`;

  return (
    <article
      style={{
        background: 'var(--surface-container-lowest)',
        border: '1px solid var(--outline-variant)',
        borderLeft: `4px solid ${manifestoMeta(promise.manifesto_status).hex}`,
        borderRadius: '1rem',
        padding: '1.1rem 1.2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <ManifestoPill status={promise.manifesto_status} />
        <CategoryBadge category={promise.category} />
      </div>

      <h3
        style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 700,
          lineHeight: 1.3,
          color: 'var(--on-surface)',
        }}
      >
        {promise.title}
      </h3>

      {promise.manifesto_text && (
        <p
          style={{
            margin: 0,
            fontSize: '0.82rem',
            fontStyle: 'italic',
            color: 'var(--on-surface-variant)',
            lineHeight: 1.5,
            padding: '0.5rem 0.75rem',
            background: 'var(--surface-container-low)',
            borderRadius: '0.5rem',
            borderLeft: '3px solid var(--outline-variant)',
          }}
        >
          {promise.manifesto_text}
        </p>
      )}

      {promise.assessment && (
        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--on-surface-variant)',
            lineHeight: 1.55,
          }}
        >
          {shown}
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              style={{
                marginLeft: '0.4rem',
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit',
                fontFamily: 'inherit',
              }}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </p>
      )}

      {promise.source_page && (
        <a
          href={promise.source_page}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            color: 'var(--primary)',
            textDecoration: 'none',
            fontWeight: 600,
            marginTop: '0.1rem',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>open_in_new</span>
          Source
        </a>
      )}
    </article>
  );
};

const ManifestoPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeParty, setActiveParty] = useState('YSRCP');
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);

  const partyConf = PARTY_TABS.find(p => p.key === activeParty);
  const promises = partyConf.data;

  const filtered = useMemo(() => {
    return promises.filter(p => {
      if (filterStatus && p.manifesto_status !== filterStatus) return false;
      if (filterCategory && p.category !== filterCategory) return false;
      return true;
    });
  }, [promises, filterStatus, filterCategory]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const p of promises) {
      counts[p.manifesto_status] = (counts[p.manifesto_status] || 0) + 1;
    }
    return counts;
  }, [promises]);

  const catCounts = useMemo(() => {
    const counts = {};
    for (const p of promises) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [promises]);

  const deliveredCount = statusCounts['delivered'] || 0;
  const totalCount = promises.length;
  const deliveredPct = Math.round((deliveredCount / totalCount) * 100);

  const toggleStatus = (val) => setFilterStatus(s => s === val ? null : val);
  const toggleCat = (val) => setFilterCategory(c => c === val ? null : val);

  const switchParty = (key) => {
    setActiveParty(key);
    setFilterStatus(null);
    setFilterCategory(null);
  };

  return (
    <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <main className="page-main">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="display-lg text-on-surface" style={{ marginBottom: '0.5rem' }}>
            Manifesto Tracker
          </h1>
          <p className="body-md text-on-surface-variant" style={{ maxWidth: '42rem' }}>
            Andhra Pradesh election manifesto promises — delivered, in progress, or broken.
          </p>
        </div>

        {/* Party tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {PARTY_TABS.map(p => {
            const isActive = activeParty === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => switchParty(p.key)}
                style={{
                  padding: '0.55rem 1.3rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: `2px solid ${isActive ? p.hex : 'var(--outline-variant)'}`,
                  background: isActive
                    ? `color-mix(in srgb, ${p.hex} 18%, transparent)`
                    : 'transparent',
                  color: isActive ? p.hex : 'var(--on-surface-variant)',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Government context + summary */}
        <div
          style={{
            background: 'var(--surface-container-low)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '1rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0.75rem' : '1rem',
            alignItems: isMobile ? 'flex-start' : 'center',
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              className="label-sm text-on-surface-variant"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>account_balance</span>
              {partyConf.government}
            </div>
            <div className="label-sm text-on-surface-variant">
              {partyConf.election} · {totalCount} promises tracked
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: `color-mix(in srgb, #2e7d32 12%, transparent)`,
              border: '1px solid color-mix(in srgb, #2e7d32 30%, transparent)',
              borderRadius: '0.75rem',
              padding: '0.5rem 0.9rem',
              alignSelf: isMobile ? 'stretch' : 'auto',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#2e7d32' }}>
              check_circle
            </span>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2e7d32', lineHeight: 1 }}>
                {deliveredPct}%
              </div>
              <div style={{ fontSize: '0.72rem', color: '#2e7d32', fontWeight: 600 }}>
                {deliveredCount} of {totalCount} delivered
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem 1.1rem',
            borderRadius: '1rem',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-container-low)',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="label-sm text-on-surface-variant">Status</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {STATUS_ORDER.filter(s => statusCounts[s]).map(s => {
                const meta = manifestoMeta(s);
                return (
                  <Chip
                    key={s}
                    label={meta.label}
                    count={statusCounts[s]}
                    active={filterStatus === s}
                    hex={meta.hex}
                    onClick={() => toggleStatus(s)}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span className="label-sm text-on-surface-variant">Category</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {CATEGORIES.filter(c => catCounts[c.value]).map(c => (
                <Chip
                  key={c.value}
                  label={c.label}
                  count={catCounts[c.value]}
                  active={filterCategory === c.value}
                  onClick={() => toggleCat(c.value)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        {(filterStatus || filterCategory) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <span className="body-md text-on-surface-variant">
              Showing {filtered.length} of {totalCount}
            </span>
            <button
              type="button"
              onClick={() => { setFilterStatus(null); setFilterCategory(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
              Clear filters
            </button>
          </div>
        )}

        {/* Promise cards */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', opacity: 0.7 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>
              search_off
            </span>
            <p className="headline-md">No promises match these filters</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filtered.map(p => (
              <PromiseCard key={p.slug} promise={p} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ManifestoPage;
