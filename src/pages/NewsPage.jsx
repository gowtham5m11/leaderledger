import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useBookmarks } from '../hooks/useBookmarks';
import candidates from '../data/candidates.json';
import { partyColor } from '../data/mockData';
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

const NewsCard = ({ item }) => {
  const cand = candidatesById.get(String(item.candidate_id));
  const colorVar = cand ? partyColor(cand.party) : 'var(--outline)';
  const href = safeHref(item.url);
  return (
    <article
      className="news-card"
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
            borderColor: colorVar,
            color: colorVar,
          }}
        >
          {cand.name}
          <span className="news-candidate-chip-sep" aria-hidden="true">·</span>
          <span className="news-candidate-chip-const">{cand.constituency}</span>
        </Link>
      )}

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

  // Reset pagination whenever the underlying flat list changes.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [items.length]);

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

  const visible = items.slice(0, visibleCount);

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

      <div className="news-feed">
        {visible.map((item) => (
          <NewsCard key={`${item.candidate_id}:${item.url}`} item={item} />
        ))}
      </div>

      {visibleCount < items.length && (
        <button
          type="button"
          className="news-load-more"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
        >
          Load more ({items.length - visibleCount} remaining)
        </button>
      )}
    </main>
  );
};

export default NewsPage;
