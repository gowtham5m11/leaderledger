import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  documentId,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_COUNTS = { useful: 0, concerned: 0, needs_investigation: 0 };

// Realtime aggregate reaction counts for a specific set of news articles —
// only the ones currently on screen. Firestore caps `in` queries at 30
// values, so the id list is chunked and each chunk is one onSnapshot
// listener. That keeps the listener count bounded (≈ ids / 30) instead of
// one-per-card, which matters because the news catalogue is large and churns.
//
// Returns a getCounts(articleId) lookup; unknown ids resolve to all-zero.
export function useNewsReactionCounts(articleIds) {
  const [counts, setCounts] = useState({});

  // Stable effect dependency: sorted, de-duped, joined id list.
  const key = useMemo(
    () => [...new Set((articleIds || []).filter(Boolean))].sort().join('|'),
    [articleIds],
  );

  useEffect(() => {
    if (!db || !key) {
      setCounts({});
      return undefined;
    }
    const ids = key.split('|');
    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

    const acc = {}; // articleId -> counts, accumulated across chunk snapshots
    const unsubs = chunks.map((chunk) =>
      onSnapshot(
        query(collection(db, 'news_reactions'), where(documentId(), 'in', chunk)),
        (snap) => {
          snap.forEach((d) => {
            const data = d.data() || {};
            acc[d.id] = {
              useful: Number(data.useful) || 0,
              concerned: Number(data.concerned) || 0,
              needs_investigation: Number(data.needs_investigation) || 0,
            };
          });
          setCounts({ ...acc });
        },
        (err) => console.warn('News reaction counts error:', err.message),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return useCallback((aid) => counts[String(aid)] || EMPTY_COUNTS, [counts]);
}
