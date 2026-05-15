import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { getDistrictData, partyColor } from '../data/mockData';
import mapPaths from '../data/mapPaths.json';

const MapChart = ({ setTooltipContent, onDistrictClick }) => {
  const [position, setPosition] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [bboxes, setBboxes] = useState({});
  const [rotation, setRotation] = useState(0);
  const rotationGestureRef = useRef(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  const ROTATION_LIMIT = 60;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const next = {};
    svgRef.current.querySelectorAll('path[data-name]').forEach((el) => {
      try {
        const bb = el.getBBox();
        const totalLen = el.getTotalLength();
        const samples = Math.max(40, Math.min(200, Math.round(totalLen)));
        const pts = [];
        for (let i = 0; i < samples; i++) {
          const p = el.getPointAtLength((i / samples) * totalLen);
          pts.push([p.x, p.y]);
        }
        // Centroid of sampled boundary points.
        let cx = 0, cy = 0;
        for (const [x, y] of pts) { cx += x; cy += y; }
        cx /= pts.length; cy /= pts.length;
        // Covariance → principal axis angle.
        let sxx = 0, sxy = 0, syy = 0;
        for (const [x, y] of pts) {
          const dx = x - cx, dy = y - cy;
          sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
        }
        const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
        // Project points onto the principal axis (u) and perpendicular (v).
        const cos = Math.cos(angle), sin = Math.sin(angle);
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (const [x, y] of pts) {
          const dx = x - cx, dy = y - cy;
          const u = dx * cos + dy * sin;
          const v = -dx * sin + dy * cos;
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        // Keep text upright: normalize to (-90°, +90°], then cap tilt at ±60°.
        let deg = (angle * 180) / Math.PI;
        while (deg > 90) deg -= 180;
        while (deg <= -90) deg += 180;
        if (deg > 60) deg = 60;
        else if (deg < -60) deg = -60;
        next[el.dataset.name] = {
          cx, cy,
          bbw: bb.width,
          bbh: bb.height,
          lenU: maxU - minU,
          lenV: maxV - minV,
          angleDeg: deg,
        };
      } catch (err) {
        // getBBox can throw if path isn't fully laid out yet; skip silently
      }
    });
    setBboxes(next);
  }, []);

  const handleZoom = useCallback((factor, clientX, clientY) => {
    setPosition(pos => {
      const newZoom = Math.max(Math.min(pos.zoom * factor, 30), 0.5);
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

  const getTouchAngle = (touches) => {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const getTouchDistance = (touches) => {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchMidpoint = (touches) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });

  const handleTouchStart = (e) => {
    if (isMobile && e.touches.length === 2) {
      // Two-finger gesture → enter rotate + pinch-zoom mode, suspend pan.
      setIsDragging(false);
      rotationGestureRef.current = {
        startAngle: getTouchAngle(e.touches),
        startRotation: rotation,
        startDistance: getTouchDistance(e.touches),
        startZoom: position.zoom,
      };
      return;
    }
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = useCallback((e) => {
    if (isMobile && e.touches.length === 2 && rotationGestureRef.current) {
      const g = rotationGestureRef.current;
      // Rotation
      const delta = getTouchAngle(e.touches) - g.startAngle;
      let next = g.startRotation + delta;
      if (next > ROTATION_LIMIT) next = ROTATION_LIMIT;
      else if (next < -ROTATION_LIMIT) next = -ROTATION_LIMIT;
      setRotation(next);
      // Pinch-zoom around the gesture midpoint
      const dist = getTouchDistance(e.touches);
      if (g.startDistance > 0) {
        const targetZoom = Math.max(0.5, Math.min(30, g.startZoom * (dist / g.startDistance)));
        setPosition(pos => {
          if (targetZoom === pos.zoom) return pos;
          const container = containerRef.current;
          if (!container) return { ...pos, zoom: targetZoom };
          const rect = container.getBoundingClientRect();
          const mid = getTouchMidpoint(e.touches);
          const x = mid.x - rect.left;
          const y = mid.y - rect.top;
          const ratio = targetZoom / pos.zoom;
          return {
            x: x - (x - pos.x) * ratio,
            y: y - (y - pos.y) * ratio,
            zoom: targetZoom,
          };
        });
      }
      return;
    }
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition(pos => ({
      ...pos,
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    }));
  }, [isDragging, dragStart, isMobile, rotation, position.zoom]);

  const handleTouchEnd = (e) => {
    if (e && e.touches && e.touches.length < 2) {
      rotationGestureRef.current = null;
    }
    if (!e || !e.touches || e.touches.length === 0) {
      setIsDragging(false);
    }
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: 'none' }}
    >
      <div
        className={`w-full h-full flex items-center justify-center p-8 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onDoubleClick={(e) => handleZoom(1.5, e.clientX, e.clientY)}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${position.zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: rotationGestureRef.current ? 'none' : 'transform 120ms ease-out',
          }}
        >
        <svg
          ref={svgRef}
          viewBox="0 0 642.8 420"
          className="w-full h-full drop-shadow-2xl"
          style={{ maxHeight: '80vh' }}
        >
          <defs>
            {constituencyPaths.map(({ name, path }) => (
              <clipPath
                key={`clip-${name}`}
                id={`clip-${name.replace(/[^a-zA-Z0-9]/g, '_')}`}
                clipPathUnits="userSpaceOnUse"
              >
                <path d={path} />
              </clipPath>
            ))}
          </defs>

          {constituencyPaths.map((constituency) => {
            const { name, path, data } = constituency;
            const party = data.party || 'UNKNOWN';
            const color = partyColor(party);

            return (
              <path
                key={name}
                d={path}
                data-name={name}
                className="constituency-path transition-all duration-300 cursor-pointer"
                stroke="var(--surface)"
                strokeWidth={0.3}
                onClick={() => onDistrictClick(data)}
                onMouseEnter={() => {
                  setTooltipContent({ name, ...data });
                }}
                onMouseLeave={() => {
                  setTooltipContent(null);
                }}
                style={{
                  fill: color,
                  fillOpacity: 0.62,
                  '--hover-fill': color,
                }}
              />
            );
          })}

          {isMobile && position.zoom >= 2.0 && constituencyPaths.map(({ name }) => {
            const bb = bboxes[name];
            if (!bb) return null;

            // Strip disambiguation suffix in parens (e.g. "PRATHIPADU (VARUPULA SATYA PRABHA)" -> "PRATHIPADU"),
            // then title-case each word: "VIJAYAWADA CENTRAL" -> "Vijayawada Central".
            const display = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
            const lines = display.split(/\s+/);
            const longestWord = lines.reduce((m, w) => Math.max(m, w.length), 1);

            // Fit text along the principal axis (lenU = length, lenV = perpendicular width).
            // Progressive fill: at low zoom the text is conservative; as zoom grows it
            // expands to use more of the district — but never exceeds it (caps below 1.0).
            // Axis is locked (computed once on mount) — only the magnitude grows.
            const fillU = Math.min(0.92, 0.62 + (position.zoom - 2) * 0.08);
            const fillV = Math.min(0.85, 0.58 + (position.zoom - 2) * 0.07);
            const maxByLength = (bb.lenU * fillU) / (longestWord * 0.55);
            const maxByWidth = (bb.lenV * fillV) / (lines.length * 1.15);
            let fontSize = Math.min(maxByLength, maxByWidth);

            // Cap the on-screen size so text grows up to a comfortable reading size,
            // then stops growing as you keep zooming in.
            const containerWidth = containerRef.current?.clientWidth || 360;
            const pxPerUnit = (containerWidth / 642.8) * position.zoom;
            const MAX_ON_SCREEN_PX = 14;
            const fontSizeCap = MAX_ON_SCREEN_PX / Math.max(0.0001, pxPerUnit);
            fontSize = Math.min(fontSize, fontSizeCap);

            // Hide labels that would render too small to read.
            const onScreenPx = fontSize * pxPerUnit;
            if (onScreenPx < 7) return null;

            const clipId = `clip-${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

            return (
              <text
                key={`label-${name}`}
                x={bb.cx}
                y={bb.cy}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${bb.angleDeg} ${bb.cx} ${bb.cy})`}
                clipPath={`url(#${clipId})`}
                style={{
                  fill: 'var(--on-surface)',
                  opacity: 0.92,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  stroke: 'var(--surface)',
                  strokeWidth: fontSize * 0.05,
                  paintOrder: 'stroke fill',
                }}
              >
                {lines.map((line, i) => (
                  <tspan
                    key={i}
                    x={bb.cx}
                    dy={i === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em'}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
        </div>
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

