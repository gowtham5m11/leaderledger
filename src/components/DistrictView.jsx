import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Map as MapIcon, Users, Calendar, Award } from 'lucide-react';
import MapChart from './MapChart';
import Footer from './Footer';
import { trackEvent } from '../utils/analytics';
import { getDistrictData, partyColors } from '../data/mockData';

const MapTooltip = ({ data }) => {
  if (!data) return null;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
        <img src={data.image} alt={data.currentMla} className="w-14 h-14 rounded-lg object-cover" />
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
          style={{ backgroundColor: partyColors[data.party] || '#ccc' }}
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
  const navigate = useNavigate();

  const defaultDistrict = useMemo(() => {
    return getDistrictData('Kuppam');
  }, []);

  const [selectedDistrict, setSelectedDistrict] = useState(defaultDistrict);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  React.useEffect(() => {
    if (selectedDistrict) {
      trackEvent('select_district', {
        district_name: selectedDistrict.name,
        party: selectedDistrict.party,
        representative: selectedDistrict.currentMla,
      });
    }
  }, [selectedDistrict]);

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
            <div className="w-3 h-3 rounded-full bg-[#fce903]"></div>
            <span className="label-sm text-on-surface-variant font-medium">TDP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00249c]"></div>
            <span className="label-sm text-on-surface-variant font-medium">YSRCP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff0000]"></div>
            <span className="label-sm text-on-surface-variant font-medium">JSP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
            <span className="label-sm text-on-surface-variant font-medium">BJP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#0ea5e9]"></div>
            <span className="label-sm text-on-surface-variant font-medium">INC</span>
          </div>
        </div>
      </div>

      <div
        className="details-panel-container"
        style={{
          transition: 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isPanelVisible ? 'translateX(0)' : 'translateX(120%)',
          opacity: isPanelVisible ? 1 : 0
        }}
      >
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
              className="p-3 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant cursor-pointer bg-white/50 border border-outline-variant shadow-sm flex items-center justify-center"
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
                  src={selectedDistrict.image}
                  alt={selectedDistrict.currentMla}
                  className="w-24 h-24 rounded-3xl object-cover shadow-xl border-4 border-white"
                />
                <div>
                  <span className="label-sm px-3 py-1 rounded-full bg-white font-bold text-primary mb-3 inline-block shadow-sm">
                    {selectedDistrict.name}
                  </span>
                  <h1 className="display-lg text-on-surface">
                    {selectedDistrict.currentMla}
                  </h1>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-6 rounded-3xl bg-white/60 border border-outline-variant shadow-sm">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                  <Users size={16} />
                  <span className="label-sm">Electors</span>
                </div>
                <p className="title-md text-on-surface">{selectedDistrict.population}</p>
              </div>
              <div className="p-6 rounded-3xl bg-white/60 border border-outline-variant shadow-sm">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                  <Award size={16} />
                  <span className="label-sm">Majority</span>
                </div>
                <p className="title-md text-on-surface">{selectedDistrict.majorityVotes?.toLocaleString()}</p>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              <div className="p-8 rounded-[2rem] bg-white/40 border border-outline-variant backdrop-blur-sm">
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

              {selectedDistrict.id && (
                <button 
                  onClick={() => navigate(`/profile/${selectedDistrict.id}`)}
                  className="w-full py-5 rounded-[1.5rem] bg-primary text-on-primary font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-3"
                >
                  <Users size={20} />
                  View Full Profile
                </button>
              )}
            </div>
            <Footer />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DistrictView;
