import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { getDistrictData, partyColors } from '../data/mockData';
import mapPaths from '../data/mapPaths.json';

const MapChart = ({ setTooltipContent, onDistrictClick }) => {
  const [position, setPosition] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleZoom = useCallback((factor, clientX, clientY) => {
    setPosition(pos => {
      const newZoom = Math.max(Math.min(pos.zoom * factor, 10), 0.5);
      if (newZoom === pos.zoom) return pos;

      const container = containerRef.current;
      if (!container) return pos;

      const rect = container.getBoundingClientRect();
      
      // If no mouse coordinates provided, zoom to center of container
      const x = clientX !== undefined ? clientX - rect.left : rect.width / 2;
      const y = clientY !== undefined ? clientY - rect.top : rect.height / 2;

      const zoomRatio = newZoom / pos.zoom;
      const newX = x - (x - pos.x) * zoomRatio;
      const newY = y - (y - pos.y) * zoomRatio;

      return {
        x: newX,
        y: newY,
        zoom: newZoom
      };
    });
  }, []);

  const handleZoomIn = useCallback(() => handleZoom(1.2), [handleZoom]);
  const handleZoomOut = useCallback(() => handleZoom(1 / 1.2), [handleZoom]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    handleZoom(factor, e.clientX, e.clientY);
  }, [handleZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition(pos => ({
      ...pos,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const constituencyPaths = useMemo(() => {
    return Object.entries(mapPaths).map(([name, path]) => {
      const data = getDistrictData(name);
      return {
        name,
        path,
        data
      };
    });
  }, []);

  return (
    <div 
      ref={containerRef}
      className="map-container relative w-full h-full overflow-hidden bg-surface-container-low rounded-3xl border border-outline-variant/30"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        className={`w-full h-full flex items-center justify-center p-8 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onDoubleClick={(e) => handleZoom(1.5, e.clientX, e.clientY)}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${position.zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <svg
          viewBox="0 0 642.8 420"
          className="w-full h-full drop-shadow-2xl"
          style={{ maxHeight: '80vh' }}
        >
          {constituencyPaths.map((constituency) => {
            const { name, path, data } = constituency;
            const party = data.party || 'UNKNOWN';
            const color = partyColors[party] || '#cccccc';

            return (
              <path
                key={name}
                d={path}
                className="constituency-path transition-all duration-300 cursor-pointer"
                fill={color}
                fillOpacity={0.6}
                stroke="var(--surface-container-lowest)"
                strokeWidth={0.2}
                onClick={() => onDistrictClick(data)}
                onMouseEnter={() => {
                  setTooltipContent({ name, ...data });
                }}
                onMouseLeave={() => {
                  setTooltipContent(null);
                }}
                style={{
                  '--hover-fill': color,
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Manual Zoom Controls - Positioned Left */}
      {/* Manual Zoom Controls - Positioned Bottom-Right */}
      <div 
        className="absolute bottom-8 right-8 flex flex-col gap-3 z-[60]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleZoomIn}
          className="w-14 h-14 bg-white backdrop-blur-md rounded-2xl border border-outline-variant shadow-xl hover:bg-surface-container-highest text-primary transition-all active:scale-90 flex items-center justify-center cursor-pointer pointer-events-auto"
          title="Zoom In"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-14 h-14 bg-white backdrop-blur-md rounded-2xl border border-outline-variant shadow-xl hover:bg-surface-container-highest text-primary transition-all active:scale-90 flex items-center justify-center cursor-pointer pointer-events-auto"
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

