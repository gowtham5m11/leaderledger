import React, { useState } from 'react';
import { 
  Users, TrendingUp, History, 
  ChevronRight, Map as MapIcon, Info,
  ExternalLink, ArrowUpRight, Award,
  Sparkles, CheckCircle2
} from 'lucide-react';
import { getDistrictData, partyColors } from '../data/mockData';

const DistrictView = ({ selectedDistrict }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const data = getDistrictData(selectedDistrict);
  
  const partyColor = partyColors[data.party] || '#ccc';

  return (
    <div className="floating-panel">
      {/* Decorative Brand Element */}
      <div className="absolute top-0 right-0 p-8 overflow-hidden pointer-events-none opacity-5">
        <MapIcon size={200} weight="fill" />
      </div>

      {/* Header Section */}
      <header className="relative mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ 
              backgroundColor: partyColor,
              boxShadow: `0 8px 25px ${partyColor}40`
            }}
          >
            <MapIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Verified Sector</span>
              <div className="w-1 h-1 rounded-full bg-outline opacity-30" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AP-2024</span>
            </div>
            <h2 className="text-4xl font-headline tracking-tight text-on-surface">
              {data.name}
            </h2>
          </div>
        </div>

        {/* Action Belt */}
        <div className="flex gap-2">
          {['profile', 'stats', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-surface-container-high text-outline hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-8 custom-scrollbar overflow-y-auto pr-2">
        {activeTab === 'profile' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col gap-8">
            {/* Representative Card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-transparent rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-6 rounded-[2rem] bg-surface-container-low border border-outline-variant/30 flex items-center gap-5 transition-transform group-hover:scale-[1.01]">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white">
                    <img src={data.image} alt={data.currentMla} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-lg shadow-md">
                    <CheckCircle2 size={16} className="text-primary" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest text-white"
                      style={{ backgroundColor: partyColor }}
                    >
                      {data.party}
                    </span>
                    <span className="text-[10px] font-bold text-outline uppercase tracking-widest opacity-60">Verified</span>
                  </div>
                  <h3 className="text-2xl font-headline text-on-surface mb-1">{data.currentMla}</h3>
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <Award size={14} className="opacity-50" />
                    <span className="text-xs font-semibold opacity-80 uppercase tracking-widest">Sitting MLA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Insight Grid */}
            <div className="grid grid-cols-2 gap-4">
              <StatBox 
                icon={<Users size={18} />} 
                label="Voters Base" 
                value={data.votersCount}
                trend="Verified"
              />
              <StatBox 
                icon={<TrendingUp size={18} />} 
                label="Win Margin" 
                value={data.majorityVotes?.toLocaleString() || '---'}
                trend="+12% Avg"
              />
            </div>

            {/* Quick Context */}
            <div className="p-6 rounded-[2rem] bg-surface-container-high/40 border border-outline-variant/20">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="text-primary" size={18} />
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Sector Insight</h4>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                Established assembly ledger showing demographic spread across <span className="text-on-surface font-bold">{data.population}</span>. Current administrative focus: Infrastructure & Local Governance.
              </p>
            </div>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'profile' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40 animate-in fade-in duration-500">
            <div className="p-6 bg-surface-container-high rounded-full mb-4">
              <Info size={32} />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">Comprehensive Records Pending</p>
            <p className="text-xs mt-2">Extended verified ledger logs for {activeTab} will be available shortly.</p>
          </div>
        )}
      </div>

      {/* Footer Signature */}
      <footer className="mt-8 pt-6 border-t border-outline-variant/30">
        <button className="w-full p-4 rounded-2xl bg-on-surface text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-on-surface-variant transition-all active:scale-95 shadow-xl shadow-on-surface/10">
          Constituency Dossier <ArrowUpRight size={16} />
        </button>
      </footer>
    </div>
  );
};

const StatBox = ({ icon, label, value, trend }) => (
  <div className="p-5 rounded-[2rem] bg-white border border-outline-variant/20 hover:border-primary/20 transition-all flex flex-col gap-3 group">
    <div className="flex justify-between items-start">
      <div className="p-2.5 bg-surface-container-low text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
        {icon}
      </div>
      <span className="text-[8px] font-extrabold uppercase tracking-widest text-primary bg-primary/5 px-2 py-1 rounded-full">
        {trend}
      </span>
    </div>
    <div>
      <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-headline text-on-surface">{value}</p>
    </div>
  </div>
);

// Legend Item Component (Exported for MapChart)
export const MapLegend = () => {
    const legends = [
        { name: 'TDP', color: '#fce903' },
        { name: 'YSRCP', color: '#00249c' },
        { name: 'JSP', color: '#ff0000' }
    ];

    return (
        <div className="absolute bottom-10 left-10 p-6 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-outline-variant/30 flex flex-col gap-4 shadow-xl shadow-black/5 animate-in slide-in-from-left-4 duration-700">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline opacity-60 px-1">AP Alliance / Party Control</p>
            <div className="flex flex-col gap-3">
                {legends.map(l => (
                    <div key={l.name} className="flex items-center gap-3 hover:translate-x-1 transition-transform cursor-pointer group">
                        <div className="w-3 h-3 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: l.color }} />
                        <span className="text-xs font-bold tracking-widest text-on-surface-variant group-hover:text-on-surface">{l.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DistrictView;
