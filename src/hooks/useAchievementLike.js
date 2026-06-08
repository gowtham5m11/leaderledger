import { useCallback, useEffect, useState } from 'react';
import {
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

// Per-user like state for one achievement. `liked` tracks whether the current
// user's like doc exists; `toggleLike` flips it and adjusts the denormalised
// `like_count` on the parent in one atomic batch. Signed-out users get bounced
// through the sign-in modal by requireAuth().
export function useAchievementLike(achievementId) {
  const { user, requireAuth } = useAuth();
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!db || !user || !achievementId) {
      setLiked(false);
      return undefined;
    }
    const ref = doc(db, 'achievements', achievementId, 'likes', user.uid);
    return onSnapshot(
      ref,
      (snap) => setLiked(snap.exists()),
      (err) => console.warn('Like listener error:', err.message),
    );
  }, [user, achievementId]);

  const toggleLike = useCallback(async () => {
    if (busy) return;
    const u = await requireAuth();
    if (!u || !db) return;
    setBusy(true);
    // Optimistic flip — the snapshot listener will reconcile on commit.
    const wasLiked = liked;
    setLiked(!wasLiked);
    try {
      const likeRef = doc(db, 'achievements', achievementId, 'likes', u.uid);
      const achRef = doc(db, 'achievements', achievementId);
      const batch = writeBatch(db);
      if (wasLiked) {
        batch.delete(likeRef);
        batch.update(achRef, {
          like_count: increment(-1),
          updated_at: serverTimestamp(),
        });
      } else {
        batch.set(likeRef, { uid: u.uid, created_at: serverTimestamp() });
        batch.update(achRef, {
          like_count: increment(1),
          updated_at: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      console.warn('Toggle like failed:', err.message);
      setLiked(wasLiked); // roll back the optimistic flip
    } finally {
      setBusy(false);
    }
  }, [busy, liked, achievementId, requireAuth]);

  return { liked, toggleLike, busy };
}
