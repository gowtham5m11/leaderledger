import React from 'react';

const replayTour = () => {
  try { localStorage.removeItem('ll_tour_step_v2'); } catch (_e) { /* ignore */ }
  window.location.hash = '#/district';
  window.location.reload();
};

const Footer = () => {
  return (
    <footer className="w-full py-4 px-6 border-t border-outline-variant/30 flex justify-center items-center mt-auto">
      <p className="text-[10px] uppercase tracking-widest font-bold text-outline flex items-center gap-2">
        Data Sources:
        <a href="https://eci.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ECI</a>
        •
        <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MyNeta</a>
        •
        <button
          type="button"
          onClick={replayTour}
          className="text-primary hover:underline"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            font: 'inherit',
            letterSpacing: 'inherit',
            textTransform: 'inherit',
            cursor: 'pointer',
          }}
        >
          Replay tour
        </button>
      </p>
    </footer>
  );
};

export default Footer;
