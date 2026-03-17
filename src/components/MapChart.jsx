import React, { useMemo, useState, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { Plus, Minus } from 'lucide-react';
import { getDistrictData, partyColors } from '../data/mockData';
import apData from '../data/AndhraPradesh_assembly_geo.json';

const MapChart = ({ setTooltipContent, onDistrictClick }) => {
  const [position, setPosition] = useState({ coordinates: [80.5, 15.8], zoom: 1.2 });

  const { projection } = useMemo(() => {
    // fitSize ensures the entire state is scaled to fill the viewport
    // Increasing reference viewBox slightly for better fit
    const proj = geoMercator().fitSize([1200, 900], apData);
    return { projection: proj };
  }, []);

  const handleZoomIn = () => {
    setPosition(pos => ({ ...pos, zoom: Math.min(pos.zoom * 1.5, 15) }));
  };

  const handleZoomOut = () => {
    setPosition(pos => ({ ...pos, zoom: Math.max(pos.zoom / 1.5, 0.5) }));
  };

  const handleMoveEnd = useCallback((newPosition) => {
    // Debounce/Prevent jitter: Only update if change is visible
    const dx = Math.abs(newPosition.coordinates[0] - position.coordinates[0]);
    const dy = Math.abs(newPosition.coordinates[1] - position.coordinates[1]);
    const dz = Math.abs(newPosition.zoom - position.zoom);
    if (dx > 0.001 || dy > 0.001 || dz > 0.01) {
      setPosition(newPosition);
    }
  }, [position]);

  return (
    <div className="map-container">
      <ComposableMap
        projection={projection}
        width={1200}
        height={900}
        style={{ width: "100%", height: "100%", outline: "none" }}
      >
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          minZoom={0.5}
          maxZoom={20}
          onMoveEnd={handleMoveEnd}
        >
          <Geographies geography={apData} strokeWidth={0.3}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const districtName = geo.properties.ac_name || geo.properties.name || "Unknown";
                const data = getDistrictData(districtName);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onDistrictClick(data)}
                    onMouseEnter={() => {
                      setTooltipContent({ name: districtName, ...data });
                    }}
                    onMouseLeave={() => {
                      setTooltipContent(null);
                    }}
                    style={{
                      default: {
                        fill: partyColors[data.party] ? partyColors[data.party] + "50" : "var(--primary-container)",
                        stroke: "var(--outline)",
                        strokeWidth: 0.1,
                        outline: "none",
                        transition: "fill 300ms ease"
                      },
                      hover: {
                        fill: partyColors[data.party] ? partyColors[data.party] : "var(--primary)",
                        stroke: "var(--on-surface)",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: "pointer",
                        transition: "all 300ms ease"
                      },
                      pressed: {
                        fill: "var(--surface-container-highest)",
                        outline: "none",
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Manual Zoom Controls - Positioned Left */}
      <div className="absolute top-48 left-10 flex flex-col gap-3 z-50">
        <button 
          onClick={handleZoomIn}
          className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl border border-outline-variant shadow-xl hover:bg-white text-primary transition-all active:scale-90 flex items-center justify-center cursor-pointer pointer-events-auto"
          title="Zoom In"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
        <button 
          onClick={handleZoomOut}
          className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-2xl border border-outline-variant shadow-xl hover:bg-white text-primary transition-all active:scale-90 flex items-center justify-center cursor-pointer pointer-events-auto"
          title="Zoom Out"
        >
          <Minus size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Decorative Plate */}
      <div className="absolute top-10 left-10 p-6 glass-panel rounded-3xl border border-outline-variant shadow-sm pointer-events-none z-50">
        <h3 className="title-md text-primary mb-1">Andhra Pradesh</h3>
        <p className="label-sm opacity-60">Sovereign Assembly Ledger</p>
      </div>
    </div>
  );
};

export default React.memo(MapChart);
