import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAchievements } from '../hooks/useAchievements';
import { useAuth } from '../auth/AuthContext';
import AchievementCard from '../components/AchievementCard';
import SubmitAchievementModal from '../components/SubmitAchievementModal';
import Footer from '../components/Footer';
import {
  CATEGORIES,
  MANIFESTO_STATUSES,
  PARTIES,
} from '../config/achievements';

// A single toggleable filter chip. Clicking the active chip clears the filter.
const Chip = ({ label, active, onClick, accent }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '0.4rem 0.85rem',
      borderRadius: '9999px',
      fontSize: '0.82rem',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      color: active ? (accent || 'var(--primary)') : 'var(--on-surface-variant)',
      background: active
        ? `color-mix(in srgb, ${accent || 'var(--primary)'} 14%, transparent)`
        : 'var(--surface-container-low)',
      border: `1px solid ${active ? (accent || 'var(--primary)') : 'var(--outline-variant)'}`,
      transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
);

const FilterRow = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
    <span className="label-sm text-on-surface-variant" style={{ minWidth: '4.5rem' }}>
      {label}
    </span>
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{children}</div>
  </div>
);

const AchievementsPage = () => {
  const [filters, setFilters] = useState({});
  const [submitOpen, setSubmitOpen] = useState(false);
  const { configured, requireAuth } = useAuth();
  const { achievements, loading, loadingMore, hasMore, loadMore, error } =
    useAchievements(filters);

  // Toggle a filter dimension: setting the same value again clears it.
  const toggle = (key, value) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }));

  const openSubmit = async () => {
    const u = await requireAuth();
    if (u) setSubmitOpen(true);
  };

  return (
    <div className="bg-surface text-on-surface" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <main className="page-main">
        <div className="list-title-block" style={{ marginBottom: '2rem' }}>
          <h1 className="display-lg text-on-surface" style={{ marginBottom: '1rem' }}>
            Achievements &amp; Promises
          </h1>
          <p className="body-md text-on-surface-variant" style={{ maxWidth: '42rem' }}>
            A running record of government actions and manifesto commitments —
            delivered, in progress, or unmet. Official entries are sourced from
            government and statutory bodies; community submissions are clearly
            labelled and cite a verifiable source.
          </p>
        </div>

        {/* Filter bar */}
        <div
          className="bg-surface-container-low"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            padding: '1.1rem 1.25rem',
            borderRadius: '1rem',
            border: '1px solid var(--outline-variant)',
            marginBottom: '1.5rem',
          }}
        >
          <FilterRow label="Category">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                active={filters.category === c.value}
                onClick={() => toggle('category', c.value)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Party">
            {PARTIES.map((p) => (
              <Chip
                key={p}
                label={p}
                active={filters.party === p}
                onClick={() => toggle('party', p)}
              />
            ))}
          </FilterRow>
          <FilterRow label="Status">
            {MANIFESTO_STATUSES.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={filters.manifesto_status === s.value}
                accent={s.hex}
                onClick={() => toggle('manifesto_status', s.value)}
              />
            ))}
          </FilterRow>
        </div>

        {/* Submit CTA */}
        {configured && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={openSubmit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.3rem',
                borderRadius: '9999px',
                background: 'var(--primary)',
                color: 'var(--on-primary, #fff)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={18} /> Submit an achievement
            </button>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <p className="body-md text-on-surface-variant">Loading achievements…</p>
        ) : error ? (
          <p className="body-md text-on-surface-variant">
            Couldn't load achievements right now. Please try again later.
          </p>
        ) : achievements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', opacity: 0.7 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.75rem' }}>
              emoji_events
            </span>
            <p className="headline-md">Nothing here yet</p>
            <p className="body-md text-on-surface-variant" style={{ marginTop: '0.5rem' }}>
              No entries match these filters.
            </p>
          </div>
        ) : (
          <>
            <div className="leader-grid">
              {achievements.map((a) => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '0.65rem 1.6rem',
                    borderRadius: '9999px',
                    background: 'transparent',
                    color: 'var(--on-surface)',
                    border: '1px solid var(--outline-variant)',
                    fontWeight: 600,
                    cursor: loadingMore ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <SubmitAchievementModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={() => setSubmitOpen(false)}
      />

      <Footer />
    </div>
  );
};

export default AchievementsPage;
