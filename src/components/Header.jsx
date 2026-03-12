import React from 'react';
import { Search, Eye, Menu, ChevronDown } from 'lucide-react';

const Header = ({ viewMode, toggleView }) => {
  return (
    <header className="header">
      <div className="br-logo">
        <h1>KnowYourLeader.com</h1>
      </div>
      
      <div className="nav-controls">
        <div className="search-bar">
          <input type="text" placeholder="Search..." />
          <Search size={18} className="search-icon" />
        </div>
        
        <button className="view-toggle" onClick={toggleView}>
          <Eye size={18} />
          <span>{viewMode === 'district' ? 'DISTRICT' : 'CANDIDATE'}</span>
          <ChevronDown size={16} />
        </button>
        
        <button className="burger-menu">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
};

export default Header;
