import React, { useState, useMemo } from 'react';
import { X, Map as MapIcon, Users, Calendar, Award } from 'lucide-react';
import MapChart from './MapChart';
import { getDistrictData, partyColor } from '../data/mockData';
import { getAssetPath } from '../utils/assetHelper';

const MapTooltip = ({ data }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!data) return null;

  return (
    <div
      className="glass-panel p-4 rounded-xl shadow-xl flex items-center gap-4 w-64 transform scale-105"
      style={{
        top: mousePos.y + 15,
        left: mousePos.x + 15,
        position: 'fixed',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div className="relative">
        <img 
          src={getAssetPath(data.image)} 
          alt={data.currentMla} 
          style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.5rem', objectFit: 'cover' }} 
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.currentMla)}&background=random&color=fff`;
          }}
        />
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[var(--surface-container-lowest)] flex items-center justify-center"
          style={{ backgroundColor: partyColor(data.party) }}
        >
        </div>
      </div>
      <div>
        <h4 className="title-md text-on-surface mb-0.5">{data.name}</h4>
        <p className="label-sm text-primary font-bold">{data.party} • {data.majorityVotes.toLocaleString()} Majority</p>
      </div>
    </div>
  );
};

const DistrictView = () => {
  const [tooltipData, setTooltipData] = useState(null);

  const defaultDistrict = useMemo(() => {
    return getDistrictData('Kuppam');
  }, []);

  const [selectedDistrict, setSelectedDistrict] = useState(defaultDistrict);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  const [panelWidth, setPanelWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = React.useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (e) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX - 32;
        if (newWidth > 320 && newWidth < 800) {
          setPanelWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  React.useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const handleDistrictClick = (data) => {
    setSelectedDistrict(data);
    setIsPanelVisible(true);
  };

  if (!selectedDistrict) return <div className="p-8">Loading district data...</div>;

  return (
    <div className="district-layout">
      {/* Map Content - Fills Background */}
      <div className="map-wrapper">
        <MapChart
          setTooltipContent={setTooltipData}
          onDistrictClick={handleDistrictClick}
        />
        <MapTooltip data={tooltipData} />

        {/* Floating Controls Overlay (Native to Map) */}
        <div className="absolute top-24 left-8 pointer-events-none z-50">
          {/* branding is inside MapChart actually but we can layer additional things here */}
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-10 left-10 glass-panel px-6 py-4 rounded-3xl border border-outline-variant flex gap-8 z-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--tdp)]"></div>
            <span className="label-sm text-on-surface-variant font-medium">TDP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--ysrcp)]"></div>
            <span className="label-sm text-on-surface-variant font-medium">YSRCP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--jsp)]"></div>
            <span className="label-sm text-on-surface-variant font-medium">JSP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--bjp)]"></div>
            <span className="label-sm text-on-surface-variant font-medium">BJP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[var(--inc)]"></div>
            <span className="label-sm text-on-surface-variant font-medium">INC</span>
          </div>
        </div>
      </div>

      <div
        className={`details-panel-container ${isPanelVisible ? 'mobile-visible' : ''}`}
        style={{
          width: window.innerWidth <= 768 ? undefined : `${panelWidth}px`,
          transition: isResizing ? 'none' : 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: window.innerWidth > 768 ? (isPanelVisible ? 'translateX(0)' : 'translateX(120%)') : undefined,
          opacity: window.innerWidth > 768 ? (isPanelVisible ? 1 : 0) : undefined
        }}
      >
        <div
          onMouseDown={startResizing}
          style={{
            position: 'absolute',
            left: '-6px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '100px',
            width: '12px',
            cursor: 'ew-resize',
            zIndex: 10,
            pointerEvents: 'auto',
            backgroundColor: 'var(--outline-variant)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-1)'
          }}
          className="hover:bg-primary transition-colors"
        />
        <aside className="floating-panel">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="headline-md text-primary mb-2">Constituency Ledger</h2>
              <p className="body-md text-on-surface-variant opacity-80">
                A key political landscape showcasing the diverse democratic will of the people.
              </p>
            </div>
            <button
              onClick={() => setIsPanelVisible(false)}
              className="p-3 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant cursor-pointer glass-panel border border-outline-variant shadow-sm flex items-center justify-center"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {/* Header Identity */}
            <div className={`p-8 rounded-[2rem] bg-surface-container-low mb-8 ledger-line-${selectedDistrict.party?.toLowerCase()}`}>
              <div className="flex items-center gap-6 mb-4">
                <img
                  src={getAssetPath(selectedDistrict.image)}
                  alt={selectedDistrict.currentMla}
                  style={{ width: '6rem', height: '6rem', borderRadius: '1.5rem', objectFit: 'cover', boxShadow: 'var(--shadow-2)', border: '4px solid var(--surface-container-lowest)' }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDistrict.currentMla)}&background=random&color=fff`;
                  }}
                />
                <div>
                  <span className="label-sm px-4 py-1.5 rounded-full bg-white font-bold text-primary mb-3 inline-flex items-center justify-center shadow-sm border border-primary/10 whitespace-nowrap leading-none">
                    {selectedDistrict.name}
                  </span>
                  <h1 className="display-lg text-on-surface">
                    {selectedDistrict.currentMla}
                  </h1>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="flex flex-col gap-6 mb-8">
              <div className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant shadow-sm">
                <div className="flex items-center gap-3 mb-2 text-primary opacity-90">
                  <Users size={16} />
                  <span className="label-sm uppercase tracking-wider font-bold">Electors</span>
                </div>
                <p className="headline-sm text-on-surface font-semibold">{selectedDistrict.population}</p>
              </div>
              <div className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant shadow-sm">
                <div className="flex items-center gap-3 mb-2 text-primary opacity-90">
                  <Award size={16} />
                  <span className="label-sm uppercase tracking-wider font-bold">Majority</span>
                </div>
                <p className="headline-sm text-on-surface font-semibold">{selectedDistrict.majorityVotes?.toLocaleString()}</p>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              <div className="p-8 rounded-[2rem] glass-panel border border-outline-variant">
                <h3 className="title-md text-primary mb-6 flex items-center gap-3 border-b border-outline-variant/30 pb-4 leading-none">
                  <MapIcon size={18} /> Detailed Overview
                </h3>
                <div className="space-y-5">
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="label-sm text-on-surface-variant opacity-70">Former MLA</span>
                    <span className="body-md font-semibold text-on-surface">{selectedDistrict.pastMla}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant/20">
                    <span className="label-sm text-on-surface-variant opacity-70">Constituency Status</span>
                    <span className="label-sm px-3 py-1 rounded-full bg-primary/10 text-primary">
                      Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Social Media Section */}
              {(selectedDistrict.social_media?.facebook || selectedDistrict.social_media?.instagram || selectedDistrict.social_media?.x || selectedDistrict.social_media?.email) && (
                <div className="p-8 rounded-[2rem] bg-surface-container-low border border-outline-variant">
                  <h3 className="title-md text-primary mb-6 flex items-center gap-3 border-b border-outline-variant/30 pb-4 leading-none">
                    <Users size={18} /> Official Socials
                  </h3>
                  <div className="space-y-4">
                    {selectedDistrict.social_media.facebook && (
                      <div className="flex flex-col">
                        <span className="label-sm text-outline mb-1">Facebook</span>
                        <a href={selectedDistrict.social_media.facebook} target="_blank" rel="noopener noreferrer" className="body-md text-on-surface-variant hover:text-primary transition-colors truncate">
                          {selectedDistrict.social_media.facebook}
                        </a>
                      </div>
                    )}
                    {selectedDistrict.social_media.instagram && (
                      <div className="flex flex-col">
                        <span className="label-sm text-outline mb-1">Instagram</span>
                        <a href={selectedDistrict.social_media.instagram} target="_blank" rel="noopener noreferrer" className="body-md text-on-surface-variant hover:text-primary transition-colors truncate">
                          {selectedDistrict.social_media.instagram}
                        </a>
                      </div>
                    )}
                    {selectedDistrict.social_media.x && (
                      <div className="flex flex-col">
                        <span className="label-sm text-outline mb-1">Twitter / X</span>
                        <a href={selectedDistrict.social_media.x} target="_blank" rel="noopener noreferrer" className="body-md text-on-surface-variant hover:text-primary transition-colors truncate">
                          {selectedDistrict.social_media.x}
                        </a>
                      </div>
                    )}
                    {selectedDistrict.social_media.email && (
                      <div className="flex flex-col">
                        <span className="label-sm text-outline mb-1">Email</span>
                        <span className="body-md text-on-surface-variant truncate">
                          {selectedDistrict.social_media.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DistrictView;
