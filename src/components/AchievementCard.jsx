import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, MessageSquare, MoreVertical, Flag } from 'lucide-react';
import { useAchievementLike } from '../hooks/useAchievementLike';
import { actionAccent } from '../config/achievements';
import {
  PartyBadge,
  CategoryBadge,
  ManifestoPill,
  SourceTierBadge,
} from './AchievementBadges';
import AchievementReportModal from './AchievementReportModal';

const DESC_CLAMP = 160;

const AchievementCard = ({ achievement }) => {
  const navigate = useNavigate();
  const { liked, toggleLike } = useAchievementLike(achievement.id);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef(null);

  const accent = actionAccent(achievement.action_type);
  const isNegative = achievement.action_type === 'negative';
  const description = achievement.description || '';
  const isLong = description.length > DESC_CLAMP;
  const shownDesc = expanded || !isLong
    ? description
    : `${description.slice(0, DESC_CLAMP).trimEnd()}…`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const open = () => navigate(`/achievements/${achievement.id}`);
  const stop = (e) => e.stopPropagation();

  return (
    <>
      <article
        onClick={open}
        className="leader-card"
        style={{
          // The shared elevation/hover treatment comes from .leader-card; we
          // override the party top-border with an action-type left accent.
          borderTop: '1px solid var(--outline-variant)',
          borderLeft: `4px solid ${accent}`,
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <PartyBadge party={achievement.party} />
          <CategoryBadge category={achievement.category} />
          <ManifestoPill status={achievement.manifesto_status} />
          {isNegative && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: accent,
              }}
            >
              Unmet
            </span>
          )}

          <div style={{ marginLeft: 'auto', position: 'relative' }} ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              onClick={(e) => {
                stop(e);
                setMenuOpen((v) => !v);
              }}
              style={iconBtnStyle}
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div onClick={stop} style={menuStyle}>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportOpen(true);
                  }}
                  style={menuItemStyle}
                >
                  <Flag size={15} /> Report entry
                </button>
              </div>
            )}
          </div>
        </div>

        <h3
          className="title-md"
          style={{ fontSize: '1.1rem', lineHeight: 1.25, color: 'var(--on-surface)', margin: 0 }}
        >
          {achievement.title}
        </h3>

        <p
          className="body-md text-on-surface-variant"
          style={{ margin: 0, lineHeight: 1.5 }}
        >
          {shownDesc}
          {isLong && (
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setExpanded((v) => !v);
              }}
              style={{
                marginLeft: '0.4rem',
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit',
              }}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </p>

        {achievement.government && (
          <div
            className="label-sm text-on-surface-variant"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--outline)' }}>
              account_balance
            </span>
            {achievement.government}
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <SourceTierBadge tier={achievement.source_tier} domain={achievement.source_domain} />
        </div>

        <div
          className="card-footer"
          style={{ paddingTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid var(--outline-variant)' }}
        >
          <button
            type="button"
            aria-pressed={liked}
            aria-label={liked ? 'Remove like' : 'Like'}
            onClick={(e) => {
              stop(e);
              toggleLike();
            }}
            style={{
              ...footerBtnStyle,
              color: liked ? 'var(--primary)' : 'var(--on-surface-variant)',
            }}
          >
            <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
            <span style={{ fontWeight: 600 }}>{achievement.like_count || 0}</span>
          </button>

          <button
            type="button"
            aria-label="View comments"
            onClick={(e) => {
              stop(e);
              open();
            }}
            style={{ ...footerBtnStyle, color: 'var(--on-surface-variant)' }}
          >
            <MessageSquare size={16} />
            <span style={{ fontWeight: 600 }}>{achievement.comment_count || 0}</span>
          </button>

          <span
            className="material-symbols-outlined"
            style={{ marginLeft: 'auto', color: 'var(--primary)', opacity: 0.5 }}
          >
            arrow_forward
          </span>
        </div>
      </article>

      <AchievementReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        achievement={achievement}
      />
    </>
  );
};

const iconBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: '9999px',
  padding: '0.3rem',
  cursor: 'pointer',
  color: 'var(--on-surface-variant)',
};

const menuStyle = {
  position: 'absolute',
  top: '110%',
  right: 0,
  zIndex: 20,
  minWidth: 160,
  background: 'var(--surface-container-lowest)',
  border: '1px solid var(--outline-variant)',
  borderRadius: '0.75rem',
  boxShadow: 'var(--shadow-strong)',
  padding: '0.35rem',
};

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.55rem 0.6rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  color: 'var(--on-surface)',
  fontSize: '0.88rem',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const footerBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '9999px',
  padding: '0.35rem 0.5rem',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
};

export default AchievementCard;
