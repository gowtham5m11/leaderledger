import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

const PAGE_SIZE = 24;

// Filters are applied client-side over the live feed. A civic-scale catalogue
// is small enough that paging the `status == live` stream (one composite index:
// status ASC + created_at DESC) and filtering in memory is simpler and more
// flexible than the index-per-combination a fully server-side filter bar would
// need. The category/party/manifesto composite indexes in firestore.indexes.json
// are ready if the data ever grows enough to push these server-side.
function matchesFilters(a, filters = {}) {
  if (filters.category && a.category !== filters.category) return false;
  if (filters.party && a.party !== filters.party) return false;
  if (filters.manifesto_status && a.manifesto_status !== filters.manifesto_status) {
    return false;
  }
  if (filters.action_type && a.action_type !== filters.action_type) return false;
  return true;
}

// Paginated read of live achievements, newest first. Returns the in-memory
// filtered slice plus a `loadMore` to pull the next server page.
export function useAchievements(filters = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);

  const baseConstraints = useMemo(
    () => [where('status', '==', 'live'), orderBy('created_at', 'desc')],
    [],
  );

  const fetchPage = useCallback(
    async (reset) => {
      if (!db) {
        setLoading(false);
        return;
      }
      const ref = collection(db, 'achievements');
      const cursor = reset ? null : cursorRef.current;
      const q = cursor
        ? query(ref, ...baseConstraints, startAfter(cursor), limit(PAGE_SIZE))
        : query(ref, ...baseConstraints, limit(PAGE_SIZE));
      const snap = await getDocs(q);
      if (snap.docs.length) {
        cursorRef.current = snap.docs[snap.docs.length - 1];
      }
      setHasMore(snap.size === PAGE_SIZE);
      const page = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems((prev) => (reset ? page : [...prev, ...page]));
    },
    [baseConstraints],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cursorRef.current = null;
    fetchPage(true)
      .catch((e) => {
        if (!cancelled) {
          console.warn('Achievements load failed:', e.message);
          setError(e);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(false);
    } catch (e) {
      console.warn('Achievements load-more failed:', e.message);
      setError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore]);

  const filtered = useMemo(
    () => items.filter((a) => matchesFilters(a, filters)),
    [items, filters],
  );

  return {
    achievements: filtered,
    loadedCount: items.length,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
  };
}

// Real-time subscription to a single achievement (the detail page). A non-live
// entry is unreadable under the security rules, so the listener surfaces that
// as `error` and the page renders an "unavailable" state.
export function useAchievement(id) {
  const [achievement, setAchievement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db || !id) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      doc(db, 'achievements', id),
      (snap) => {
        setAchievement(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.warn('Achievement listener error:', err.message);
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [id]);

  return { achievement, loading, error };
}
