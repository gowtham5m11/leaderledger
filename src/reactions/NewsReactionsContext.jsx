import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { REACTION_TYPES } from './ReactionsContext';

const NewsReactionsContext = createContext({
  getMyReaction: () => null,
  react: async () => {},
});

// Per-article reactions for news items. Unlike candidate reactions (a fixed
// set of 175), the news catalogue churns hourly, so there is deliberately NO
// app-wide "load every doc" listener here. This provider only tracks the
// signed-in user's own news reactions (a small per-user subcollection).
// Aggregate counts are loaded per screen by useNewsReactionCounts().
export const NewsReactionsProvider = ({ children }) => {
  const { user, requireAuth } = useAuth();
  const [myNews, setMyNews] = useState({}); // articleId -> reaction type

  useEffect(() => {
    if (!user || !db) {
      setMyNews({});
      return undefined;
    }
    const ref = collection(db, 'user_reactions', user.uid, 'news');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const mine = {};
        snap.forEach((d) => {
          const r = d.data()?.reaction;
          if (r) mine[d.id] = r;
        });
        setMyNews(mine);
      },
      (err) => console.warn('News reactions (user) listener error:', err.message),
    );
    return unsub;
  }, [user]);

  // Toggle a reaction on one article. Mirrors ReactionsContext.react() — the
  // /news_reactions counter and the per-user record commit in one batch, and
  // counters move by ±1, exactly what the hardened rules permit.
  const react = useCallback(
    async (articleId, reaction) => {
      if (!db || !articleId || !REACTION_TYPES.includes(reaction)) return;
      const u = await requireAuth(); // pops sign-in modal if signed out
      if (!u) return;

      const aid = String(articleId);
      const current = myNews[aid] || null;
      const next = current === reaction ? null : reaction;
      if (next === current) return;

      const delta = (type) => (next === type ? 1 : 0) - (current === type ? 1 : 0);

      const batch = writeBatch(db);
      batch.set(
        doc(db, 'news_reactions', aid),
        {
          useful: increment(delta('useful')),
          concerned: increment(delta('concerned')),
          needs_investigation: increment(delta('needs_investigation')),
        },
        { merge: true },
      );

      const userRef = doc(db, 'user_reactions', u.uid, 'news', aid);
      if (next) {
        batch.set(userRef, { reaction: next, timestamp: serverTimestamp() });
      } else {
        batch.delete(userRef);
      }
      await batch.commit();
    },
    [myNews, requireAuth],
  );

  const getMyReaction = useCallback(
    (aid) => myNews[String(aid)] || null,
    [myNews],
  );

  return (
    <NewsReactionsContext.Provider value={{ getMyReaction, react }}>
      {children}
    </NewsReactionsContext.Provider>
  );
};

export const useNewsReactions = () => useContext(NewsReactionsContext);
