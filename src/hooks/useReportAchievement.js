import { useCallback, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { AUTO_ESCALATE_AT } from '../config/achievements';

// Files a report against an achievement and bumps its denormalised
// report_count. When the count crosses AUTO_ESCALATE_AT the same batch flips
// the entry to `under_review` with review_reason `auto_escalated_by_reports`
// — the project has no Cloud Functions, so escalation is done client-side and
// backed by the Firestore counter-update rule (any signed-in user may move
// report_count by +1 and set status -> under_review, never -> removed).
export function useReportAchievement() {
  const { requireAuth } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const report = useCallback(
    async (achievementId, { reason, details }) => {
      setError(null);
      const u = await requireAuth();
      if (!u || !db) {
        const e = new Error('You need to be signed in to report.');
        setError(e.message);
        throw e;
      }
      setSubmitting(true);
      try {
        // Read the current count so we know whether this report tips it over
        // the escalation threshold. increment() still does the actual ±1, so
        // concurrent reports stay correct even if this read is slightly stale.
        const achRef = doc(db, 'achievements', achievementId);
        const snap = await getDoc(achRef);
        const current = snap.exists() ? snap.data().report_count || 0 : 0;
        const willEscalate = current + 1 >= AUTO_ESCALATE_AT;

        const batch = writeBatch(db);
        const reportRef = doc(collection(db, 'achievement_reports'));
        batch.set(reportRef, {
          achievement_id: achievementId,
          reported_by: u.uid,
          reason,
          details: (details || '').trim().slice(0, 1000) || null,
          created_at: serverTimestamp(),
          resolved: false,
        });

        const update = {
          report_count: increment(1),
          updated_at: serverTimestamp(),
        };
        if (willEscalate && snap.data()?.status === 'live') {
          update.status = 'under_review';
          update.review_reason = 'auto_escalated_by_reports';
        }
        batch.update(achRef, update);

        await batch.commit();
      } catch (err) {
        console.error('Report achievement failed:', err?.code || err?.message);
        setError('Could not submit the report. Please try again.');
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [requireAuth],
  );

  return { report, submitting, error };
}
