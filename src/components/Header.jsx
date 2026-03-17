import React from 'react';
import { Search, Eye, Menu, ChevronDown } from 'lucide-react';

const Header = ({ viewMode, toggleView }) => {
  return (
    <header className="glass-nav relative z-[100] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <h1 className="font-headline text-2xl tracking-tight text-primary">
          KnowYourLeader.com
        </h1>
        
        <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 border border-outline-variant w-80">
          <Search size={18} className="text-outline" />
          <input 
            type="text" 
            placeholder="Search districts or leaders..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2 font-body outline-none"
          />
        </div>
      </div>

      <nav className="flex items-center gap-6">
        <div className="flex bg-surface-container-high p-1 rounded-lg">
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'district' ? 'bg-surface-container-lowest shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => viewMode !== 'district' && toggleView()}
          >
            District
          </button>
          <button 
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'candidate' ? 'bg-surface-container-lowest shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => viewMode !== 'candidate' && toggleView()}
          >
            Candidate
          </button>
        </div>
        
        <button className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface">
          <Menu size={24} />
        </button>
      </nav>
    </header>
  );
};

export default Header;
