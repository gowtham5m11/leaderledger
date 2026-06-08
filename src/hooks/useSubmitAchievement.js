import { useCallback, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { extractDomain, isAllowedSource } from '../config/sourceDomains';

// Validates a community submission against the source whitelist and writes it
// to /achievements. source_tier and submitted_by are derived here — never
// taken from the form — so a client can't self-promote an entry to "official".
// The Firestore create rule independently enforces status == 'live' &&
// source_tier == 'community' && signed-in, so this is convenience validation,
// not the security boundary.
export function useSubmitAchievement() {
  const { requireAuth } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(
    async (form) => {
      setError(null);

      const title = (form.title || '').trim();
      const description = (form.description || '').trim();
      const sourceUrl = (form.source_url || '').trim();

      if (!title) {
        const e = new Error('Please add a title.');
        setError(e.message);
        throw e;
      }
      if (!description) {
        const e = new Error('Please add a description.');
        setError(e.message);
        throw e;
      }
      if (!isAllowedSource(sourceUrl)) {
        const e = new Error(
          'Please use a news article or official government website.',
        );
        setError(e.message);
        throw e;
      }

      const u = await requireAuth();
      if (!u || !db) {
        const e = new Error('You need to be signed in to submit.');
        setError(e.message);
        throw e;
      }

      setSubmitting(true);
      try {
        const payload = {
          title: title.slice(0, 200),
          description: description.slice(0, 4000),
          category: form.category,
          party: form.party,
          government: (form.government || '').slice(0, 200),
          // Tenure is curated for official entries via the seed script;
          // community submissions default to "now / open" and can be refined
          // by a moderator. Stored as Firestore timestamps.
          tenure_start: serverTimestamp(),
          tenure_end: null,
          manifesto_status: form.manifesto_status,
          action_type: form.action_type,
          source_tier: 'community',
          source_url: sourceUrl.slice(0, 1000),
          source_domain: extractDomain(sourceUrl),
          submitted_by: u.uid,
          status: 'live',
          review_reason: null,
          report_count: 0,
          like_count: 0,
          comment_count: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'achievements'), payload);
        return ref.id;
      } catch (err) {
        console.error('Achievement submit failed:', err?.code || err?.message);
        setError('Could not submit. Please try again.');
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [requireAuth],
  );

  return { submit, submitting, error };
}
