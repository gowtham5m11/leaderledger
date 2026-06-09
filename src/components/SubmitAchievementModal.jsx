import React, { useEffect, useMemo, useState } from 'react';
import { X, Trophy, Check, AlertCircle } from 'lucide-react';
import { useSubmitAchievement } from '../hooks/useSubmitAchievement';
import { extractDomain, isAllowedSource } from '../config/sourceDomains';
import {
  CATEGORIES,
  MANIFESTO_STATUSES,
  ACTION_TYPES,
  PARTIES,
} from '../config/achievements';

const EMPTY = {
  title: '',
  description: '',
  category: CATEGORIES[0].value,
  party: PARTIES[0],
  government: '',
  manifesto_status: MANIFESTO_STATUSES[0].value,
  action_type: ACTION_TYPES[0].value,
  source_url: '',
};

const DESC_MAX = 4000;

const SubmitAchievementModal = ({ open, onClose, onSubmitted }) => {
  const { submit, submitting } = useSubmitAchievement();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setForm(EMPTY);
    setError(null);
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

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Live source validation feedback.
  const sourceState = useMemo(() => {
    const url = form.source_url.trim();
    if (!url) return { kind: 'idle' };
    return isAllowedSource(url)
      ? { kind: 'ok', domain: extractDomain(url) }
      : { kind: 'bad' };
  }, [form.source_url]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const id = await submit(form);
      if (onSubmitted) onSubmitted(id);
    } catch (err) {
      setError(err?.message || 'Could not submit. Please try again.');
    }
  };

  return (
    <div
      onClick={onClose}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ach-submit-title"
    >
      <div onClick={(e) => e.stopPropagation()} style={cardStyle}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={closeBtnStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-container-high)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
        </button>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Trophy size={20} style={{ color: 'var(--primary)' }} />
            <h2 id="ach-submit-title" className="font-headline" style={{ fontSize: '1.35rem', margin: 0 }}>
              Submit an achievement
            </h2>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
            Add a verifiable government action or unmet promise. Community
            submissions are clearly labelled and must cite a news article or
            official source.
          </p>

          {error && (
            <div role="alert" style={errorBoxStyle}>
              {error}
            </div>
          )}

          <Label htmlFor="ach-title">Title</Label>
          <input
            id="ach-title"
            type="text"
            value={form.title}
            onChange={set('title')}
            maxLength={200}
            placeholder="e.g. Amaravati capital works restarted"
            style={inputStyle}
            required
          />

          <Label htmlFor="ach-desc">
            Description{' '}
            <span style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}>
              ({form.description.length}/{DESC_MAX})
            </span>
          </Label>
          <textarea
            id="ach-desc"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value.slice(0, DESC_MAX) }))
            }
            rows={4}
            placeholder="What happened, when, and what it means for residents."
            style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }}
            required
          />

          <div className="ach-form-two-col">
            <div>
              <Label htmlFor="ach-category">Category</Label>
              <select id="ach-category" value={form.category} onChange={set('category')} style={inputStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ach-party">Party</Label>
              <select id="ach-party" value={form.party} onChange={set('party')} style={inputStyle}>
                {PARTIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <Label htmlFor="ach-gov">Government</Label>
          <input
            id="ach-gov"
            type="text"
            value={form.government}
            onChange={set('government')}
            maxLength={200}
            placeholder="e.g. N. Chandrababu Naidu Government (2024–)"
            style={inputStyle}
          />

          <div className="ach-form-two-col">
            <div>
              <Label htmlFor="ach-status">Manifesto status</Label>
              <select id="ach-status" value={form.manifesto_status} onChange={set('manifesto_status')} style={inputStyle}>
                {MANIFESTO_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Action type</Label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {ACTION_TYPES.map((t) => {
                  const active = form.action_type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, action_type: t.value }))}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.5rem',
                        borderRadius: '0.55rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        color: active ? t.hex : 'var(--on-surface-variant)',
                        background: active
                          ? `color-mix(in srgb, ${t.hex} 14%, transparent)`
                          : 'var(--surface-container-low)',
                        border: `1px solid ${active ? t.hex : 'var(--outline-variant)'}`,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Label htmlFor="ach-source">Source URL</Label>
          <input
            id="ach-source"
            type="url"
            value={form.source_url}
            onChange={set('source_url')}
            placeholder="https://www.thehindu.com/…"
            style={{
              ...inputStyle,
              borderColor:
                sourceState.kind === 'ok'
                  ? '#2e7d32'
                  : sourceState.kind === 'bad'
                  ? 'var(--error, #b3261e)'
                  : 'var(--outline-variant)',
            }}
            required
          />
          <div style={{ minHeight: '1.25rem', marginTop: '0.4rem' }}>
            {sourceState.kind === 'ok' && (
              <span style={{ ...hintStyle, color: '#2e7d32' }}>
                <Check size={15} /> Verified source · {sourceState.domain}
              </span>
            )}
            {sourceState.kind === 'bad' && (
              <span style={{ ...hintStyle, color: 'var(--error, #b3261e)' }}>
                <AlertCircle size={15} /> Please use a news article or official government website.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={ghostBtnStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || sourceState.kind !== 'ok'}
              style={{
                ...primaryBtnStyle,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting || sourceState.kind !== 'ok' ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Label = ({ children, htmlFor }) => (
  <label
    htmlFor={htmlFor}
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

const overlayStyle = {
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
};

const cardStyle = {
  background: 'var(--surface-container-lowest)',
  color: 'var(--on-surface)',
  borderRadius: '1.25rem',
  padding: '2rem',
  maxWidth: 560,
  width: '100%',
  position: 'relative',
  border: '1px solid var(--outline-variant)',
  boxShadow: '0 25px 50px rgba(0,0,0,0.35), var(--shadow-strong)',
  maxHeight: 'calc(100vh - 2rem)',
  overflowY: 'auto',
};

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
  boxSizing: 'border-box',
};

const hintStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.82rem',
  fontWeight: 600,
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
  padding: '0.65rem 1.4rem',
  borderRadius: '9999px',
  background: 'var(--primary)',
  color: 'var(--on-primary, #fff)',
  border: 'none',
  fontWeight: 600,
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

export default SubmitAchievementModal;
