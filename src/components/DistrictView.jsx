import React, { useState, useMemo, useRef } from 'react';
import { X, Map as MapIcon, Users, Calendar, Award, Layers } from 'lucide-react';
import MapChart from './MapChart';
import { getDistrictData, partyColor, partyOnColor } from '../data/mockData';
import { getAssetPath } from '../utils/assetHelper';
import { safeHref } from '../utils/safeHref';
import districtPathsData from '../data/districtPaths.json';
import constituencyDistrict from '../data/constituencyDistrict.json';
import candidatesRaw from '../data/candidates.json';

// Mobile bottom-sheet sizing. Sheet is freely draggable like the desktop
// side panel — no snap points. Height is stored in vh units and clamped
// to this range so the handle stays reachable and the map stays visible.
const SHEET_MIN_VH = 8;
const SHEET_MAX_VH = 95;
const SHEET_DEFAULT_VH = 48;

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
          className="absolute -bottom-1 -right-1 flex items-center justify-center"
          style={{ 
            width: '1.25rem', 
            height: '1.25rem', 
            borderRadius: '50%', 
            border: '2px solid var(--surface-container-lowest)', 
            backgroundColor: partyColor(data.party) 
          }}
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
  const [selectedDistrictName, setSelectedDistrictName] = useState(null);
  const [showDistrictBorders, setShowDistrictBorders] = useState(false);
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false);

  const candidates = Array.isArray(candidatesRaw) ? candidatesRaw : [];

  const districtNames = useMemo(
    () => [...new Set(Object.values(constituencyDistrict))].sort(),
    []
  );

  const districtCandidates = useMemo(() => {
    if (!selectedDistrictName) return [];
    return candidates
      .filter(c => constituencyDistrict[(c.constituency || '').toUpperCase()] === selectedDistrictName)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedDistrictName, candidates]);

  const [panelWidth, setPanelWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);

  // Mobile bottom-sheet free-drag state. `sheetVh` persists wherever the
  // user releases the drag; during the drag we mutate the DOM directly
  // (via panelRef) to avoid a re-render per frame.
  const [sheetVh, setSheetVh] = useState(SHEET_DEFAULT_VH);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const dragRef = useRef({ active: false, startY: 0, startVh: SHEET_DEFAULT_VH });

  const startSheetDrag = React.useCallback((clientY) => {
    if (!panelRef.current) return;
    const startVh = (panelRef.current.getBoundingClientRect().height / window.innerHeight) * 100;
    dragRef.current = { active: true, startY: clientY, startVh };
    setIsDragging(true);
  }, []);

  const moveSheetDrag = React.useCallback((clientY) => {
    if (!dragRef.current.active || !panelRef.current) return;
    const deltaPx = dragRef.current.startY - clientY; // up-swipe is positive
    const deltaVh = (deltaPx / window.innerHeight) * 100;
    const nextVh = Math.max(SHEET_MIN_VH, Math.min(SHEET_MAX_VH, dragRef.current.startVh + deltaVh));
    panelRef.current.style.height = `${nextVh}vh`;
  }, []);

  const endSheetDrag = React.useCallback(() => {
    if (!dragRef.current.active || !panelRef.current) return;
    dragRef.current.active = false;
    const rect = panelRef.current.getBoundingClientRect();
    const currentVh = (rect.height / window.innerHeight) * 100;
    const finalVh = Math.max(SHEET_MIN_VH, Math.min(SHEET_MAX_VH, currentVh));
    // Don't clear panelRef.style.height — React's next render will overwrite
    // it with the new `sheetVh`, avoiding a one-frame fallback to the base CSS.
    setIsDragging(false);
    setSheetVh(finalVh);
  }, []);

  // Publish the current sheet height as a CSS variable so .map-wrapper can
  // subtract it from 100vh and keep the map visible above the sheet. Only
  // fires after the user releases the drag (not during), so the map underneath
  // stays stable while the user is gesturing.
  React.useEffect(() => {
    const root = document.documentElement;
    if (!isPanelVisible) {
      root.style.removeProperty('--ll-sheet-vh');
      return undefined;
    }
    root.style.setProperty('--ll-sheet-vh', `${sheetVh}vh`);
    return () => root.style.removeProperty('--ll-sheet-vh');
  }, [sheetVh, isPanelVisible]);

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
    setSelectedDistrictName(null);
    setIsPanelVisible(true);
    setSheetVh(SHEET_DEFAULT_VH);
  };

  const handleDistrictNameClick = (districtName) => {
    if (selectedDistrictName === districtName) {
      setSelectedDistrictName(null);
      return;
    }
    setSelectedDistrictName(districtName);
    setIsPanelVisible(true);
    setSheetVh(SHEET_DEFAULT_VH);
  };

  if (!selectedDistrict) return <div className="p-8">Loading district data...</div>;

  return (
    <div className="district-layout">
      {/* Map Content - Fills Background */}
      <div className="map-wrapper">
        <MapChart
          setTooltipContent={setTooltipData}
          onDistrictClick={handleDistrictClick}
          districtPaths={districtPathsData}
          showDistrictBorders={showDistrictBorders}
          highlightedDistrict={selectedDistrictName}
          constituencyDistrict={constituencyDistrict}
        />
        <MapTooltip data={tooltipData} />

        {/* Floating Controls Overlay (Native to Map) */}
        <div className="absolute top-24 left-8 pointer-events-none z-50">
          {/* branding is inside MapChart actually but we can layer additional things here */}
        </div>

        {/* Bottom-left controls */}
        <div style={{ position: 'absolute', bottom: '2.5rem', left: '2.5rem', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
          {/* District picker popup — floats above the buttons */}
          {districtPickerOpen && (
            <div className="district-picker-popup custom-scrollbar">
              {districtNames.map(name => (
                <button
                  key={name}
                  className={`district-btn${selectedDistrictName === name ? ' active' : ''}`}
                  onClick={() => handleDistrictNameClick(name)}
                >
                  {name.charAt(0) + name.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}

          {/* Two action buttons side by side */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowDistrictBorders(v => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border border-outline-variant shadow-xl transition-all active:scale-90 cursor-pointer pointer-events-auto ${showDistrictBorders ? 'bg-primary text-on-primary' : 'glass-panel text-primary'}`}
              title="Toggle district borders"
            >
              <Layers size={18} />
              <span className="label-sm font-semibold">Borders</span>
            </button>
            <button
              onClick={() => setDistrictPickerOpen(v => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl border border-outline-variant shadow-xl transition-all active:scale-90 cursor-pointer pointer-events-auto ${districtPickerOpen || selectedDistrictName ? 'bg-primary text-on-primary' : 'glass-panel text-primary'}`}
              title="Select district"
            >
              <MapIcon size={18} />
              <span className="label-sm font-semibold">
                {selectedDistrictName
                  ? selectedDistrictName.charAt(0) + selectedDistrictName.slice(1).toLowerCase()
                  : 'Select District'}
              </span>
            </button>
          </div>

          {/* Party legend */}
          <div className="glass-panel rounded-3xl border border-outline-variant" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
            {[
              { party: 'TDP',   color: 'var(--tdp)'   },
              { party: 'YSRCP', color: 'var(--ysrcp)' },
              { party: 'JSP',   color: 'var(--jsp)'   },
              { party: 'BJP',   color: 'var(--bjp)'   },
              { party: 'INC',   color: 'var(--inc)'   },
            ].map(({ party, color }) => (
              <div key={party} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span className="label-sm text-on-surface-variant font-medium">{party}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={panelRef}
        className={`details-panel-container ${isPanelVisible ? 'mobile-visible' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={{
          width: window.innerWidth <= 768 ? undefined : `${panelWidth}px`,
          // On mobile, height is controlled here (free-resize). While the
          // user is mid-drag we leave it undefined so the inline ref-write
          // in moveSheetDrag owns the value frame-by-frame.
          height: window.innerWidth <= 768 && isPanelVisible && !isDragging
            ? `${sheetVh}vh`
            : undefined,
          transition: isResizing ? 'none' : 'all 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          transform: window.innerWidth > 768 ? (isPanelVisible ? 'translateX(0)' : 'translateX(120%)') : undefined,
          opacity: window.innerWidth > 768 ? (isPanelVisible ? 1 : 0) : undefined
        }}
      >
        {/* Mobile drag handle — invisible on desktop (CSS-scoped). */}
        <div
          className="sheet-handle"
          role="separator"
          aria-label="Drag to resize sheet"
          onTouchStart={(e) => startSheetDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveSheetDrag(e.touches[0].clientY)}
          onTouchEnd={endSheetDrag}
          onTouchCancel={endSheetDrag}
          onMouseDown={(e) => {
            e.preventDefault();
            startSheetDrag(e.clientY);
            const onMove = (ev) => moveSheetDrag(ev.clientY);
            const onUp = () => {
              endSheetDrag();
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        />

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
              {selectedDistrictName ? (
                <>
                  <h2 className="headline-md text-primary mb-2">
                    {selectedDistrictName.charAt(0) + selectedDistrictName.slice(1).toLowerCase()} District
                  </h2>
                  <p className="body-md text-on-surface-variant opacity-80">
                    {districtCandidates.length} constituencies — alphabetical
                  </p>
                </>
              ) : (
                <>
                  <h2 className="headline-md text-primary mb-2">Constituency Ledger</h2>
                  <p className="body-md text-on-surface-variant opacity-80">
                    A key political landscape showcasing the diverse democratic will of the people.
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => setIsPanelVisible(false)}
              className="p-3 hover:bg-surface-container-high rounded-full transition-all text-on-surface-variant cursor-pointer glass-panel border border-outline-variant shadow-sm flex items-center justify-center"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>

          {selectedDistrictName ? (
            /* District MLA list mode */
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-3">
                {districtCandidates.map(c => {
                  const data = getDistrictData(c.constituency);
                  const pColor = partyColor(data.party);
                  const pOn = partyOnColor(data.party);
                  return (
                    <button
                      key={c.id}
                      className="district-mla-item"
                      onClick={() => {
                        setSelectedDistrict(data);
                        setSelectedDistrictName(null);
                      }}
                    >
                      <img
                        src={getAssetPath(c.image)}
                        alt={c.name}
                        style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0 }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff&size=64`;
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="body-md font-semibold text-on-surface" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                        <p className="label-sm text-on-surface-variant" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.constituency}</p>
                      </div>
                      <span
                        className="party-badge"
                        style={{ backgroundColor: pColor, color: pOn }}
                      >
                        {data.party}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          /* Single constituency mode */
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <span className="constituency-badge">
                      {selectedDistrict.name}
                    </span>
                    {(!selectedDistrict.dob || selectedDistrict.dob.startsWith('Age:')) && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '9999px',
                        background: 'color-mix(in srgb, var(--outline) 12%, transparent)',
                        color: 'var(--outline)',
                        border: '1px solid color-mix(in srgb, var(--outline) 24%, transparent)',
                        verticalAlign: 'middle'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.90rem' }}>sync</span>
                        Under Process
                      </span>
                    )}
                  </div>
                  <h1 className="candidate-sheet-name">
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
                  <span className="label-sm uppercase tracking-wider font-bold">
                    Electors{selectedDistrict.electorsYear === 2019 ? " (2019)" : ""}
                  </span>
                </div>
                <p className="headline-sm text-on-surface font-semibold">{selectedDistrict.population}</p>
                {selectedDistrict.electorsYear === 2024
                  && selectedDistrict.votesPolled
                  && selectedDistrict.turnoutPercent != null && (
                  <p className="label-sm text-on-surface-variant mt-1 opacity-80">
                    {selectedDistrict.votesPolled} voted • {selectedDistrict.turnoutPercent}% turnout
                  </p>
                )}
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
                    <span className="status-badge">
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
                        <a href={safeHref(selectedDistrict.social_media.facebook)} target="_blank" rel="noopener noreferrer" className="body-md text-on-surface-variant hover:text-primary transition-colors truncate">
                          {selectedDistrict.social_media.facebook}
                        </a>
                      </div>
                    )}
                    {selectedDistrict.social_media.instagram && (
                      <div className="flex flex-col">
                        <span className="label-sm text-outline mb-1">Instagram</span>
                        <a href={safeHref(selectedDistrict.social_media.instagram)} target="_blank" rel="noopener noreferrer" className="body-md text-on-surface-variant hover:text-primary transition-colors truncate">
                          {selectedDistrict.social_media.instagram}
                        </a>
                      </div>
                    )}
                    {selectedDistrict.social_media.x && (
                      <div className="flex flex-col">
                        <span className="label-sm text-outline mb-1">Twitter / X</span>
                        <a href={safeHref(selectedDistrict.social_media.x)} target="_blank" rel="noopener noreferrer" className="body-md text-on-surface-variant hover:text-primary transition-colors truncate">
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
          )}
        </aside>
      </div>
    </div>
  );
};

export default DistrictView;
