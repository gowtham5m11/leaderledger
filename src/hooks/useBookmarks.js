import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

export function useBookmarks() {
  const { user, requireAuth } = useAuth();
  const [ids, setIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !db) {
      setIds(new Set());
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'bookmarks');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = new Set();
        snap.forEach((d) => next.add(d.id));
        setIds(next);
        setLoading(false);
      },
      (err) => {
        console.warn('Bookmarks listener error:', err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  const isBookmarked = useCallback((cid) => ids.has(String(cid)), [ids]);

  const toggle = useCallback(
    async (cid) => {
      const u = await requireAuth();
      if (!u || !db) return;
      const id = String(cid);
      const ref = doc(db, 'users', u.uid, 'bookmarks', id);
      if (ids.has(id)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { createdAt: serverTimestamp() });
      }
    },
    [ids, requireAuth],
  );

  return { ids, isBookmarked, toggle, loading };
}
