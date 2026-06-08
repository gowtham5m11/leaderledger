import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

const COMMENT_MAX = 500;

// Real-time listener on an achievement's comments, plus add/delete helpers.
// Writes keep the denormalised `comment_count` on the parent in sync via an
// atomic batch (same pattern as ReportModal's report + throttle commit).
export function useAchievementComments(achievementId) {
  const { user, requireAuth } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !achievementId) {
      setComments([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const ref = collection(db, 'achievements', achievementId, 'comments');
    const q = query(ref, orderBy('created_at', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => !c.is_removed),
        );
        setLoading(false);
      },
      (err) => {
        console.warn('Comments listener error:', err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [achievementId]);

  const addComment = useCallback(
    async (rawText) => {
      const text = (rawText || '').trim().slice(0, COMMENT_MAX);
      if (!text) return;
      const u = await requireAuth();
      if (!u || !db) return;
      const batch = writeBatch(db);
      const commentRef = doc(
        collection(db, 'achievements', achievementId, 'comments'),
      );
      batch.set(commentRef, {
        uid: u.uid,
        text,
        created_at: serverTimestamp(),
        report_count: 0,
        is_removed: false,
      });
      batch.update(doc(db, 'achievements', achievementId), {
        comment_count: increment(1),
        updated_at: serverTimestamp(),
      });
      await batch.commit();
    },
    [achievementId, requireAuth],
  );

  const deleteComment = useCallback(
    async (commentId) => {
      if (!db || !user) return;
      const batch = writeBatch(db);
      batch.delete(
        doc(db, 'achievements', achievementId, 'comments', commentId),
      );
      batch.update(doc(db, 'achievements', achievementId), {
        comment_count: increment(-1),
        updated_at: serverTimestamp(),
      });
      await batch.commit();
    },
    [achievementId, user],
  );

  return { comments, loading, addComment, deleteComment, COMMENT_MAX };
}
