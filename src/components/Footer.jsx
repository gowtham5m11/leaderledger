import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full py-4 px-6 border-t border-outline-variant/30 flex justify-center items-center mt-auto">
      <p className="text-[10px] uppercase tracking-widest font-bold text-outline flex items-center gap-2">
        Data Sources: 
        <a href="https://eci.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ECI</a> 
        • 
        <a href="https://myneta.info" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MyNeta</a>
      </p>
    </footer>
  );
};

export default Footer;
