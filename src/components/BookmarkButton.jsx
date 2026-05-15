import React, { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useBookmarks } from '../hooks/useBookmarks';
import { useAuth } from '../auth/AuthContext';

const BookmarkButton = ({ candidateId, size = 'md', variant = 'icon', stopPropagation = true }) => {
  const { configured } = useAuth();
  const { isBookmarked, toggle } = useBookmarks();
  const [busy, setBusy] = useState(false);

  if (!configured) return null;

  const saved = isBookmarked(candidateId);
  const isLg = size === 'lg';
  const iconSize = isLg ? 20 : 16;

  const handleClick = async (e) => {
    if (stopPropagation) e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(candidateId);
    } catch (err) {
      console.error('Bookmark toggle failed:', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'pill') {
    return (
      <button
        onClick={handleClick}
        disabled={busy}
        title={saved ? 'Remove bookmark' : 'Bookmark candidate'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.55rem 1rem',
          borderRadius: '9999px',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
          background: saved
            ? 'color-mix(in srgb, var(--primary) 18%, transparent)'
            : 'var(--surface-container-high)',
          color: saved ? 'var(--primary)' : 'var(--on-surface)',
          border: saved
            ? '1px solid color-mix(in srgb, var(--primary) 38%, transparent)'
            : '1px solid var(--outline-variant)',
          transition: 'all 0.2s',
        }}
      >
        {saved ? <BookmarkCheck size={iconSize} /> : <Bookmark size={iconSize} />}
        {saved ? 'Bookmarked' : 'Bookmark'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-label={saved ? 'Remove bookmark' : 'Bookmark candidate'}
      title={saved ? 'Remove bookmark' : 'Bookmark candidate'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isLg ? 40 : 32,
        height: isLg ? 40 : 32,
        borderRadius: '9999px',
        cursor: busy ? 'wait' : 'pointer',
        background: saved
          ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
          : 'var(--surface-container-high)',
        color: saved ? 'var(--primary)' : 'var(--on-surface-variant)',
        border: saved
          ? '1px solid color-mix(in srgb, var(--primary) 38%, transparent)'
          : '1px solid var(--outline-variant)',
        transition: 'all 0.2s',
        padding: 0,
      }}
    >
      {saved ? <BookmarkCheck size={iconSize} /> : <Bookmark size={iconSize} />}
    </button>
  );
};

export default BookmarkButton;
