import React, { useEffect, useState } from 'react';
import { X, Flag, Check } from 'lucide-react';
import { useReportAchievement } from '../hooks/useReportAchievement';
import { REPORT_REASONS } from '../config/achievements';

const DETAILS_MAX = 1000;

// Reason-selector modal for flagging an achievement. Mirrors ReportModal.jsx's
// look (overlay + centred card + CSS-variable theming) so the two report flows
// feel identical.
const AchievementReportModal = ({ open, onClose, achievement }) => {
  const { report, submitting } = useReportAchievement();
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setReason(REPORT_REASONS[0].value);
    setDetails('');
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
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await report(achievement.id, { reason, details });
      setSubmitted(true);
    } catch (err) {
      if (err?.code === 'permission-denied') {
        setError("You're submitting too fast — please wait a moment.");
      } else {
        setError(err?.message || 'Could not submit the report.');
      }
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
      aria-labelledby="ach-report-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container-lowest)',
          color: 'var(--on-surface)',
          borderRadius: '1.25rem',
          padding: '2rem',
          maxWidth: 480,
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
          style={closeBtnStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={successIconStyle}>
              <Check size={28} />
            </div>
            <h2 className="font-headline" style={{ fontSize: '1.3rem', margin: 0 }}>
              Thanks — we'll review it.
            </h2>
            <p style={{ marginTop: '0.5rem', color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Reports that cross our threshold send an entry to moderation
              automatically.
            </p>
            <button onClick={onClose} style={primaryBtnStyle}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Flag size={20} style={{ color: 'var(--primary)' }} />
              <h2 id="ach-report-title" className="font-headline" style={{ fontSize: '1.3rem', margin: 0 }}>
                Report this entry
              </h2>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              Flagging <strong>{achievement?.title}</strong>. Tell us what's wrong
              so a moderator can check it.
            </p>

            {error && (
              <div role="alert" style={errorBoxStyle}>
                {error}
              </div>
            )}

            <Label>Reason</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {REPORT_REASONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.6rem',
                    border: `1px solid ${reason === opt.value ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    background: reason === opt.value
                      ? 'color-mix(in srgb, var(--primary) 10%, transparent)'
                      : 'var(--surface-container-low)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  <input
                    type="radio"
                    name="ach-report-reason"
                    value={opt.value}
                    checked={reason === opt.value}
                    onChange={() => setReason(opt.value)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <Label>
              Details{' '}
              <span style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}>
                (optional, {details.length}/{DETAILS_MAX})
              </span>
            </Label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, DETAILS_MAX))}
              rows={3}
              placeholder="Add a link or note that helps us verify."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={ghostBtnStyle}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...primaryBtnStyle, marginTop: 0, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}
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
      marginTop: '1.25rem',
      marginBottom: '0.5rem',
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

const closeBtnStyle = {
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
};

const primaryBtnStyle = {
  marginTop: '1.5rem',
  padding: '0.7rem 1.5rem',
  borderRadius: '9999px',
  background: 'var(--primary)',
  color: 'var(--on-primary, #fff)',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostBtnStyle = {
  padding: '0.65rem 1.2rem',
  borderRadius: '9999px',
  background: 'transparent',
  color: 'var(--on-surface)',
  border: '1px solid var(--outline-variant)',
  fontWeight: 500,
  cursor: 'pointer',
};

const errorBoxStyle = {
  marginTop: '1rem',
  padding: '0.7rem 0.85rem',
  borderRadius: '0.6rem',
  fontSize: '0.85rem',
  background: 'color-mix(in srgb, var(--error, #b3261e) 14%, transparent)',
  color: 'var(--error, #b3261e)',
  border: '1px solid color-mix(in srgb, var(--error, #b3261e) 38%, transparent)',
};

const successIconStyle = {
  width: 56,
  height: 56,
  borderRadius: '9999px',
  background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
  color: 'var(--primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 1rem',
};

export default AchievementReportModal;
