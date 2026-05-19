// Shared news.json loader. Session-cached so NewsPage and CandidateProfile
// don't double-fetch. Source URL is configurable:
//   - dev / local:  fetch('/data/news.json')  (scraper writes to public/data/)
//   - production:   VITE_NEWS_JSON_URL  (Firebase Storage public URL,
//                   set during build — see CLAUDE.md "News refresh automation")
//
// Strict no-estimates: callers MUST handle the empty-data case explicitly
// (hide the section, show empty state, etc.). We never substitute placeholder
// content for missing real items.

const FALLBACK_URL = '/data/news.json';

const sourceUrl = () =>
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_NEWS_JSON_URL) ||
  FALLBACK_URL;

let inflight = null;     // Promise<NewsDoc> while a fetch is in progress
let cached = null;       // NewsDoc once resolved (session-lifetime cache)

/**
 * Fetches the news.json document and caches it for the session.
 * Returns { generated_at, by_candidate } or null on failure.
 * Callers should treat null and an empty by_candidate the same way.
 */
export async function loadNews() {
  if (cached) return cached;
  if (inflight) return inflight;

  const url = sourceUrl();
  inflight = (async () => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        // 404 is the normal "scraper hasn't run yet" case; warn quietly.
        console.warn(`news.json fetch returned ${res.status} from ${url}`);
        return null;
      }
      const doc = await res.json();
      if (!doc || typeof doc !== 'object' || !doc.by_candidate) return null;
      cached = doc;
      return doc;
    } catch (err) {
      console.warn('news.json fetch failed:', err && err.message);
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Returns items for one candidate id, or [] if none/unavailable. */
export async function loadNewsForCandidate(candidateId) {
  const doc = await loadNews();
  if (!doc) return [];
  const arr = doc.by_candidate[String(candidateId)];
  return Array.isArray(arr) ? arr : [];
}

/** Reset the in-memory cache. Used by tests / manual refresh. */
export function _resetNewsCache() {
  cached = null;
  inflight = null;
}
