import React from 'react';

const Footer = () => {
  return (
    <footer className="glass-panel mt-auto py-12 border-t border-outline-variant" style={{ paddingBottom: '10rem', background: 'var(--surface-container-low)' }}>
      <div className="container mx-auto px-6 flex flex-col items-center gap-2">
        <p className="body-md text-on-surface-variant font-medium opacity-80" style={{ margin: 0 }}>
          Source of Data: <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold transition-all">myneta.info</a>
        </p>
        <p className="label-sm text-on-surface-variant opacity-60" style={{ margin: 0 }}>
          Presented for democratic awareness and civic education.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
