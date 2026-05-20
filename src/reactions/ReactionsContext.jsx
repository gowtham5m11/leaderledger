import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { useAuth } from '../auth/AuthContext';

// The three reaction types. Order here is the display order in the UI.
export const REACTION_TYPES = ['useful', 'concerned', 'needs_investigation'];

const EMPTY_COUNTS = { useful: 0, concerned: 0, needs_investigation: 0 };

const ReactionsContext = createContext({
  loading: true,
  getCounts: () => EMPTY_COUNTS,
  getMyReaction: () => null,
  counts: {},
  react: async () => {},
});

// Single source of truth for reactions, shared app-wide:
//  - ONE onSnapshot on the whole /reactions collection (≤175 tiny docs) feeds
//    the candidate list, profile and insights pages. 175 per-card listeners
//    would be wasteful; this is one.
//  - A second listener on /user_reactions/{uid}/candidates tracks what the
//    signed-in user has reacted to (so buttons can show the active state).
export const ReactionsProvider = ({ children }) => {
  const { user, requireAuth } = useAuth();
  const [counts, setCounts] = useState({});       // candidateId -> { useful, concerned, needs_investigation }
  const [myReactions, setMyReactions] = useState({}); // candidateId -> reaction type
  const [loading, setLoading] = useState(isFirebaseConfigured);

  // Public aggregate counts — readable signed in or out.
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return undefined;
    }
    const unsub = onSnapshot(
      collection(db, 'reactions'),
      (snap) => {
        const next = {};
        snap.forEach((d) => {
          const data = d.data() || {};
          next[d.id] = {
            useful: Number(data.useful) || 0,
            concerned: Number(data.concerned) || 0,
            needs_investigation: Number(data.needs_investigation) || 0,
          };
        });
        setCounts(next);
        setLoading(false);
      },
      (err) => {
        console.warn('Reactions listener error:', err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // The signed-in user's own reaction choices.
  useEffect(() => {
    if (!user || !db) {
      setMyReactions({});
      return undefined;
    }
    const ref = collection(db, 'user_reactions', user.uid, 'candidates');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const mine = {};
        snap.forEach((d) => {
          const r = d.data()?.reaction;
          if (r) mine[d.id] = r;
        });
        setMyReactions(mine);
      },
      (err) => console.warn('User reactions listener error:', err.message),
    );
    return unsub;
  }, [user]);

  // Toggle a reaction. Clicking the active reaction clears it; clicking a
  // different one switches. The aggregate counter and the per-user record are
  // committed in one batch so they never drift apart. Counts move by ±1, which
  // is exactly what the hardened Firestore rules permit.
  const react = useCallback(
    async (candidateId, reaction) => {
      if (!db || !REACTION_TYPES.includes(reaction)) return;
      const u = await requireAuth(); // pops the sign-in modal if signed out
      if (!u) return;                // user dismissed sign-in — no-op

      const cid = String(candidateId);
      const current = myReactions[cid] || null;
      const next = current === reaction ? null : reaction;
      if (next === current) return;

      const delta = (type) => (next === type ? 1 : 0) - (current === type ? 1 : 0);

      const batch = writeBatch(db);
      batch.set(
        doc(db, 'reactions', cid),
        {
          useful: increment(delta('useful')),
          concerned: increment(delta('concerned')),
          needs_investigation: increment(delta('needs_investigation')),
        },
        { merge: true },
      );

      const userRef = doc(db, 'user_reactions', u.uid, 'candidates', cid);
      if (next) {
        batch.set(userRef, { reaction: next, timestamp: serverTimestamp() });
      } else {
        batch.delete(userRef);
      }
      await batch.commit();
    },
    [myReactions, requireAuth],
  );

  const getCounts = useCallback(
    (cid) => counts[String(cid)] || EMPTY_COUNTS,
    [counts],
  );
  const getMyReaction = useCallback(
    (cid) => myReactions[String(cid)] || null,
    [myReactions],
  );

  return (
    <ReactionsContext.Provider
      value={{ loading, counts, getCounts, getMyReaction, react }}
    >
      {children}
    </ReactionsContext.Provider>
  );
};

export const useReactions = () => useContext(ReactionsContext);
