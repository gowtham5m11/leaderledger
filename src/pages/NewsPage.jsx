import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBookmarks } from '../hooks/useBookmarks';
import candidates from '../data/candidates.json';
import { partyColor, partyOnColor } from '../data/mockData';
import { safeHref } from '../utils/safeHref';
import { loadNews } from '../data/newsClient';

const PAGE_SIZE = 30;
const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function relativeTime(iso) {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const deltaSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 60) return rtf.format(deltaSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(deltaSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(deltaSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(deltaSec / 86400), 'day');
  if (abs < 86400 * 30) return rtf.format(Math.round(deltaSec / (86400 * 7)), 'week');
  if (abs < 86400 * 365) return rtf.format(Math.round(deltaSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(deltaSec / (86400 * 365)), 'year');
}

function relativeMinutes(iso) {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / 60000));
}

const candidatesById = new Map(candidates.map((c) => [String(c.id), c]));

const PARTY_ALIASES = {
  TDP: ['tdp', 'telugu desam'],
  YSRCP: ['ysrcp', 'ysr congress', 'ysr cong'],
  JSP: ['jsp', 'jana sena', 'janasena'],
  'Janasena Party': ['jsp', 'jana sena', 'janasena'],
  BJP: ['bjp', 'bharatiya janata'],
  INC: ['inc', ' congress'], // leading space → avoid colliding with 'ysr congress'
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Why this article is in the candidate's feed. Inferred from the stuff we
// already have on the news item (title + snippet) — no extra fetch. Returns
// `{ label, kind }` so the UI can colour the pill by kind.
function relationFor(item, cand) {
  if (!cand) return null;
  const text = `${item.title || ''} ${item.snippet || ''}`;
  const lc = text.toLowerCase();

  // 1. Direct name mention — any name-word ≥4 chars, word-boundary match.
  const nameWords = String(cand.name || '')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  if (nameWords.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`, 'i').test(text))) {
    return { label: 'Named in article', kind: 'name' };
  }

  // 2. Constituency mention — strip the disambiguating winner-name suffix
  // (PRATHIPADU (VARUPULA …) → PRATHIPADU) before matching.
  const constStem = String(cand.constituency || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  if (constStem) {
    const constWords = constStem.split(/\s+/).filter((w) => w.length >= 4);
    if (constWords.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`, 'i').test(text))) {
      const pretty = constStem
        .toLowerCase()
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
        .join(' ');
      return { label: `Mentions ${pretty}`, kind: 'constituency' };
    }
  }

  // 3. Party mention — short code or common verbose alias.
  const aliases = PARTY_ALIASES[cand.party] || [];
  if (aliases.some((a) => lc.includes(a))) {
    return { label: `${cand.party} coverage`, kind: 'party' };
  }

  // 4. Google News surfaced this for the candidate but title+snippet don't
  // tell us why — usually a body-text mention we can't see.
  return { label: 'Related coverage', kind: 'loose' };
}

const NewsCard = ({ item, dimmed = false }) => {
  const cand = candidatesById.get(String(item.candidate_id));
  const colorVar = cand ? partyColor(cand.party) : 'var(--outline)';
  const onColor = cand ? partyOnColor(cand.party) : 'var(--on-surface)';
  const href = safeHref(item.url);
  return (
    <article
      className={`news-card${dimmed ? ' news-card--dim' : ''}`}
      style={{ borderLeftColor: colorVar }}
    >
      <div className="news-card-meta">
        <span className="label-sm text-outline">
          {item.source || 'Source unknown'}
        </span>
        <span className="news-card-dot" aria-hidden="true">•</span>
        <span className="body-sm text-on-surface-variant">
          {relativeTime(item.published_at)}
        </span>
        {item.lang === 'te' && (
          <span className="news-lang-pill" title="Telugu">తె</span>
        )}
      </div>

      {cand && (
        <Link
          to={`/profile/${cand.id}`}
          className="news-candidate-chip"
          style={{
            background: colorVar,
            color: onColor,
            borderColor: colorVar,
          }}
        >
          {cand.name}
          <span className="news-candidate-chip-sep" aria-hidden="true">·</span>
          <span className="news-candidate-chip-const">{cand.constituency}</span>
        </Link>
      )}

      {cand && (() => {
        const rel = relationFor(item, cand);
        return rel ? (
          <span
            className={`news-card-why news-card-why--${rel.kind}`}
            title={
              rel.kind === 'loose'
                ? "Google News surfaced this for the candidate, but their name doesn't appear in the title or snippet — likely a body-text mention."
                : undefined
            }
          >
            {rel.label}
          </span>
        ) : null;
      })()}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="news-card-title"
      >
        {item.title}
      </a>

      {item.snippet && (
        <p className="news-card-snippet body-sm">{item.snippet}</p>
      )}
    </article>
  );
};

const EmptyCard = ({ title, body, cta }) => (
  <div className="news-empty-card">
    <h2 className="headline-sm" style={{ marginBottom: '0.5rem' }}>{title}</h2>
    <p className="body-md text-on-surface-variant" style={{ marginBottom: cta ? '1.25rem' : 0 }}>
      {body}
    </p>
    {cta}
  </div>
);

const NewsPage = () => {
  const { user, loading: authLoading, configured, openSignIn } = useAuth();
  const { ids: bookmarkIds, loading: bookmarksLoading } = useBookmarks();

  const [newsDoc, setNewsDoc] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    setNewsLoading(true);
    loadNews().then((doc) => {
      if (!alive) return;
      setNewsDoc(doc);
      setNewsLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => {
    if (!newsDoc || !bookmarkIds || bookmarkIds.size === 0) return [];
    const flat = [];
    bookmarkIds.forEach((cid) => {
      const arr = newsDoc.by_candidate[String(cid)] || [];
      arr.forEach((it) => flat.push({ ...it, candidate_id: cid }));
    });
    flat.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
    return flat;
  }, [newsDoc, bookmarkIds]);

  // Bookmarked candidates in Firestore order (most-recently bookmarked first),
  // driving the filter strip.
  const bookmarkedCandidates = useMemo(() => {
    const arr = [];
    bookmarkIds.forEach((cid) => {
      const c = candidatesById.get(String(cid));
      if (c) arr.push(c);
    });
    return arr;
  }, [bookmarkIds]);

  // Drop stale selections if a candidate gets un-bookmarked while selected.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set();
      prev.forEach((id) => { if (bookmarkIds.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [bookmarkIds]);

  const hasFilter = selectedIds.size > 0;

  // Selected first (still date-sorted), unselected pushed below (still date-sorted).
  const orderedItems = useMemo(() => {
    if (!hasFilter) return items;
    const sel = [];
    const unsel = [];
    items.forEach((it) => {
      if (selectedIds.has(String(it.candidate_id))) sel.push(it);
      else unsel.push(it);
    });
    return [...sel, ...unsel];
  }, [items, selectedIds, hasFilter]);

  const toggleSelect = (cid) => {
    const id = String(cid);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reset pagination whenever the displayed list or filter changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [items.length, selectedIds]);

  const generatedAt = newsDoc && newsDoc.generated_at;
  const staleMinutes = relativeMinutes(generatedAt);
  const isStale = staleMinutes !== null && staleMinutes * 60 * 1000 > STALE_AFTER_MS;

  // ---- States ----
  if (!configured) {
    return (
      <main className="page-main">
        <h1 className="display-md" style={{ marginBottom: '1.5rem' }}>News</h1>
        <EmptyCard
          title="News needs sign-in"
          body="The news feed follows the candidates you bookmark. Authentication isn't configured in this build, so the feed is unavailable here."
        />
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="page-main">
        <h1 className="display-md" style={{ marginBottom: '1.5rem' }}>News</h1>
        <p className="body-md text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-main">
        <h1 className="display-md" style={{ marginBottom: '1.5rem' }}>News</h1>
        <EmptyCard
          title="Sign in to follow your candidates' news"
          body="Bookmark MLAs you care about and we'll surface recent coverage from across the web."
          cta={
            <button
              type="button"
              className="news-cta-btn"
              onClick={openSignIn}
            >
              Sign in with Google
            </button>
          }
        />
      </main>
    );
  }

  if (bookmarksLoading || newsLoading) {
    return (
      <main className="page-main">
        <h1 className="display-md" style={{ marginBottom: '1.5rem' }}>News</h1>
        <p className="body-md text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  if (bookmarkIds.size === 0) {
    return (
      <main className="page-main">
        <h1 className="display-md" style={{ marginBottom: '1.5rem' }}>News</h1>
        <EmptyCard
          title="Bookmark a candidate to see their news here"
          body="Tap the bookmark icon on any candidate's profile to start your feed."
          cta={
            <Link to="/list" className="news-cta-btn">
              Browse candidates
            </Link>
          }
        />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="page-main">
        <h1 className="display-md" style={{ marginBottom: '1.5rem' }}>News</h1>
        {generatedAt && (
          <p className="body-sm text-on-surface-variant" style={{ marginBottom: '1rem' }}>
            Last refreshed {relativeTime(generatedAt)}
          </p>
        )}
        <EmptyCard
          title="No recent coverage yet"
          body="We didn't find any news from the last 90 days for your bookmarked candidates. Check back after the next refresh."
        />
      </main>
    );
  }

  const visible = orderedItems.slice(0, visibleCount);

  return (
    <main className="page-main">
      <h1 className="display-md" style={{ marginBottom: '1rem' }}>News</h1>

      {generatedAt && (
        <p className="body-sm text-on-surface-variant" style={{ marginBottom: '1rem' }}>
          Last refreshed {relativeTime(generatedAt)}
          {' · '}
          {items.length} item{items.length === 1 ? '' : 's'} across{' '}
          {bookmarkIds.size} bookmark{bookmarkIds.size === 1 ? '' : 's'}
        </p>
      )}

      {isStale && (
        <div className="news-stale-banner" role="status">
          News hasn't refreshed in {staleMinutes >= 120 ? `${Math.round(staleMinutes / 60)}h` : `${staleMinutes}m`}.
          The automated refresh may be delayed.
        </div>
      )}

      {bookmarkedCandidates.length > 1 && (
        <div className="news-filter-strip" role="group" aria-label="Filter by bookmarked candidate">
          {bookmarkedCandidates.map((c) => {
            const sel = selectedIds.has(String(c.id));
            const color = partyColor(c.party);
            const onColor = partyOnColor(c.party);
            return (
              <button
                key={c.id}
                type="button"
                className={`news-filter-pill${sel ? ' is-selected' : ''}`}
                onClick={() => toggleSelect(c.id)}
                aria-pressed={sel}
                style={
                  sel
                    ? { background: color, color: onColor, borderColor: color }
                    : { borderColor: color, color: 'var(--on-surface)' }
                }
              >
                {c.name}
              </button>
            );
          })}
          {hasFilter && (
            <button
              type="button"
              className="news-filter-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="news-feed">
        {visible.map((item) => {
          const dimmed = hasFilter && !selectedIds.has(String(item.candidate_id));
          return (
            <NewsCard
              key={`${item.candidate_id}:${item.url}`}
              item={item}
              dimmed={dimmed}
            />
          );
        })}
      </div>

      {visibleCount < orderedItems.length && (
        <button
          type="button"
          className="news-load-more"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
        >
          Load more ({orderedItems.length - visibleCount} remaining)
        </button>
      )}
    </main>
  );
};

export default NewsPage;
