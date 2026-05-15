import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

const FIELD_OPTIONS = [
  { value: 'education', label: 'Education' },
  { value: 'profession', label: 'Profession' },
  { value: 'criminal_cases', label: 'Criminal cases' },
  { value: 'social_media', label: 'Social media / Contact' },
  { value: 'ministries', label: 'Portfolios / Ministry' },
  { value: 'age', label: 'Age / DOB' },
  { value: 'other', label: 'Something else' },
];

const REASON_MAX = 1000;

const ReportModal = ({ open, onClose, candidate, defaultField = 'education' }) => {
  const { user, requireAuth } = useAuth();
  const [field, setField] = useState(defaultField);
  const [currentValue, setCurrentValue] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setField(defaultField);
    setCurrentValue(extractCurrentValue(candidate, defaultField));
    setSuggestion('');
    setReason('');
    setError(null);
    setSubmitted(false);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, defaultField, candidate, onClose]);

  useEffect(() => {
    setCurrentValue(extractCurrentValue(candidate, field));
  }, [field, candidate]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError('Please describe the issue.');
      return;
    }
    if (reason.length > REASON_MAX) {
      setError(`Reason is too long (max ${REASON_MAX} characters).`);
      return;
    }
    setSubmitting(true);
    try {
      const u = user || (await requireAuth());
      if (!u) {
        setSubmitting(false);
        return;
      }
      await addDoc(collection(db, 'reports'), {
        uid: u.uid,
        candidateId: String(candidate.id),
        candidateName: candidate.name || '',
        field,
        currentValue: String(currentValue || '').slice(0, 500),
        suggestion: suggestion.slice(0, 500),
        reason: reason.trim().slice(0, REASON_MAX),
        status: 'open',
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Report submit failed:', err);
      setError(err?.message || 'Could not submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container-lowest)',
          color: 'var(--on-surface)',
          borderRadius: '1.25rem',
          padding: '2rem',
          maxWidth: 520,
          width: '100%',
          position: 'relative',
          border: '1px solid var(--outline-variant)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35), var(--shadow-strong)',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '0.85rem',
            right: '0.85rem',
            background: 'transparent',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.4rem',
            cursor: 'pointer',
            color: 'var(--on-surface-variant)',
            display: 'flex',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '9999px',
                background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Check size={28} />
            </div>
            <h2 className="font-headline" style={{ fontSize: '1.35rem', margin: 0 }}>
              Thanks — we'll review it.
            </h2>
            <p style={{ marginTop: '0.5rem', color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Your report for <strong>{candidate.name}</strong> has been recorded.
              Verified corrections get pushed to the live data.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: '1.5rem',
                padding: '0.7rem 1.5rem',
                borderRadius: '9999px',
                background: 'var(--primary)',
                color: 'var(--on-primary, #fff)',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <AlertTriangle size={20} style={{ color: 'var(--primary)' }} />
              <h2 id="report-title" className="font-headline" style={{ fontSize: '1.35rem', margin: 0 }}>
                Report inaccuracy
              </h2>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              Flagging data for <strong>{candidate.name}</strong>. Be specific — citations
              (URLs, document refs) help us verify and fix faster.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: '1rem',
                  padding: '0.7rem 0.85rem',
                  borderRadius: '0.6rem',
                  fontSize: '0.85rem',
                  background: 'color-mix(in srgb, var(--error, #b3261e) 14%, transparent)',
                  color: 'var(--error, #b3261e)',
                  border: '1px solid color-mix(in srgb, var(--error, #b3261e) 38%, transparent)',
                }}
              >
                {error}
              </div>
            )}

            <Label>What's wrong?</Label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value)}
              style={inputStyle}
            >
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <Label>Current value on site</Label>
            <input
              type="text"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="What we show today"
              style={inputStyle}
            />

            <Label>Suggested correction (optional)</Label>
            <input
              type="text"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="What it should say"
              style={inputStyle}
            />

            <Label>Reason / source <span style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}>({reason.length}/{REASON_MAX})</span></Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              rows={4}
              placeholder="Why is the current value wrong? Link to an affidavit, news article, or official page if you can."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
              required
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.65rem 1.2rem',
                  borderRadius: '9999px',
                  background: 'transparent',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--outline-variant)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '0.65rem 1.4rem',
                  borderRadius: '9999px',
                  background: 'var(--primary)',
                  color: 'var(--on-primary, #fff)',
                  border: 'none',
                  fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Label = ({ children }) => (
  <label
    style={{
      display: 'block',
      marginTop: '1rem',
      marginBottom: '0.4rem',
      fontSize: '0.78rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--on-surface-variant)',
    }}
  >
    {children}
  </label>
);

const inputStyle = {
  width: '100%',
  padding: '0.7rem 0.85rem',
  fontSize: '0.95rem',
  borderRadius: '0.55rem',
  border: '1px solid var(--outline-variant)',
  background: 'var(--surface-container-low)',
  color: 'var(--on-surface)',
  fontFamily: 'inherit',
  outline: 'none',
};

function extractCurrentValue(candidate, field) {
  if (!candidate) return '';
  switch (field) {
    case 'education': return candidate.education || '';
    case 'profession': return candidate.profession || '';
    case 'criminal_cases': return String(candidate.criminal_cases ?? '');
    case 'age': return candidate.age || candidate.dob || '';
    case 'ministries':
      return Array.isArray(candidate.ministries)
        ? candidate.ministries.map((m) => m.name).join(', ')
        : '';
    case 'social_media':
      return Object.values(candidate.social_media || {}).filter(Boolean).join(' / ');
    default: return '';
  }
}

export default ReportModal;
