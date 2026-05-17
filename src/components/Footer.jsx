import React from 'react';

const replayTour = () => {
  try {
    localStorage.removeItem('ll_tour_step_v3');
    localStorage.removeItem('ll_tour_step_v2');
  } catch (_e) { /* ignore */ }
  window.location.hash = '#/district';
  window.location.reload();
};

const manageCookies = () => {
  try { localStorage.removeItem('ll_consent_v1'); } catch (_e) { /* ignore */ }
  window.dispatchEvent(new CustomEvent('ll:show-consent'));
};

const linkBtnStyle = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  cursor: 'pointer',
};

const Footer = () => {
  return (
    <footer className="w-full py-4 px-6 border-t border-outline-variant/30 flex flex-col items-center gap-2 mt-auto">
      <p className="text-[10px] uppercase tracking-widest font-bold text-outline flex flex-wrap justify-center items-center gap-2">
        Data Sources:
        <a href="https://eci.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ECI</a>
        •
        <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MyNeta</a>
        •
        <button type="button" onClick={replayTour} className="text-primary hover:underline" style={linkBtnStyle}>
          Replay tour
        </button>
      </p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-outline flex flex-wrap justify-center items-center gap-2">
        <a href="#/privacy" className="text-primary hover:underline">Privacy</a>
        •
        <a href="#/terms" className="text-primary hover:underline">Terms</a>
        •
        <button type="button" onClick={manageCookies} className="text-primary hover:underline" style={linkBtnStyle}>
          Manage cookies
        </button>
      </p>
    </footer>
  );
};

export default Footer;
