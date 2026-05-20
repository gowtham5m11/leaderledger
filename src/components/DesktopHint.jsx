import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

const STORAGE_KEY = 'll_desktop_hint_v1';
const DELAY_MS = 1000000;

const DesktopHint = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isMobile) return undefined;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return undefined;
    } catch (_e) { /* ignore */ }
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [isMobile]);

  // Manual replay hook — fired by the `dev_request_replay` search trigger.
  // Forces the popup open immediately, bypassing the 10s wait + seen flag.
  React.useEffect(() => {
    const onForce = () => setOpen(true);
    window.addEventListener('ll:show-desktop-hint', onForce);
    return () => window.removeEventListener('ll:show-desktop-hint', onForce);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_e) { /* ignore */ }
    setOpen(false);
  };

  if (!isMobile || !open) return null;

  return (
    <div
      className="desktop-hint-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-hint-title"
      onClick={dismiss}
    >
      <div className="desktop-hint-card" onClick={(e) => e.stopPropagation()}>
        <div className="desktop-hint-icon" aria-hidden="true">
          <span className="material-symbols-outlined">desktop_windows</span>
        </div>
        <p id="desktop-hint-title" className="desktop-hint-body">
          this website is much better optimised for desktop. please take your time to visit us through a desktop 😄
        </p>
        <p className="desktop-hint-signature">~gowtham</p>
        <button type="button" className="desktop-hint-cta" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
};

export default DesktopHint;
