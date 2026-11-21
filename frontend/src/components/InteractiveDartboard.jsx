import React from 'react';
import {
  BOARD_SECTORS,
  BOARD_RADII,
  polarToCartesian,
  createSectorPath
} from '../utils/dartboardMath';

export default function InteractiveDartboard({
  currentTurn = [],
  highlightedDart = null,
  simulateMode = true,
  onSimulateThrow
}) {
  const size = 560;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 215; // 1.0 double outer radius = 215px

  const isHighlighted = (segment, multiplier) => {
    if (!highlightedDart) return false;
    return (
      highlightedDart.segment === segment &&
      highlightedDart.multiplier === multiplier
    );
  };

  const handleSegmentClick = (e, segment, multiplier) => {
    if (!onSimulateThrow) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * size;
      const clickY = ((e.clientY - rect.top) / rect.height) * size;
      const normX = Number(((clickX - cx) / scale).toFixed(4));
      const normY = Number(((clickY - cy) / scale).toFixed(4));
      onSimulateThrow({ segment, multiplier, x: normX, y: normY });
    } else {
      onSimulateThrow({ segment, multiplier });
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Interactive SVG Dartboard */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={`h-full w-full max-h-[540px] max-w-[540px] select-none drop-shadow-[0_0_35px_rgba(15,23,42,0.9)] ${
          simulateMode ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        <defs>
          <radialGradient id="boardSurroundGrad" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <filter id="neonPulse" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Surround / Miss Ring (Click to simulate Miss) */}
        <circle
          cx={cx}
          cy={cy}
          r={BOARD_RADII.BOARD_EDGE * scale}
          fill="url(#boardSurroundGrad)"
          stroke={isHighlighted(0, 0) ? '#f43f5e' : '#1e293b'}
          strokeWidth={isHighlighted(0, 0) ? 5 : 3}
          onClick={(e) => handleSegmentClick(e, 0, 0)}
          className="transition-colors duration-200 hover:stroke-slate-600"
        >
          <title>Outer Surround — Click to Simulate Miss (0 pts)</title>
        </circle>

        {/* Subtle LED 360 Ring Rim Indicator */}
        <circle
          cx={cx}
          cy={cy}
          r={(BOARD_RADII.BOARD_EDGE - 0.015) * scale}
          fill="none"
          stroke="#334155"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* 20 Sectors */}
        {BOARD_SECTORS.map((sectorNum, idx) => {
          const centerAngle = idx * 18;
          const startAngle = centerAngle - 9;
          const endAngle = centerAngle + 9;
          const isEven = idx % 2 === 0;

          // High-contrast dark-mode TV palette
          const singleFill = isEven ? '#090d16' : '#e2e8f0';
          const ringFill = isEven ? '#dc2626' : '#16a34a';

          const doubleHit = isHighlighted(sectorNum, 2);
          const outerSingleHit = isHighlighted(sectorNum, 1);
          const tripleHit = isHighlighted(sectorNum, 3);

          // Number position
          const numPos = polarToCartesian(
            cx,
            cy,
            BOARD_RADII.NUMBER_RING * scale,
            centerAngle
          );

          return (
            <g key={sectorNum}>
              {/* DOUBLE RING (Multiplier 2) */}
              <path
                d={createSectorPath(
                  cx,
                  cy,
                  BOARD_RADII.DOUBLE_INNER * scale,
                  BOARD_RADII.DOUBLE_OUTER * scale,
                  startAngle,
                  endAngle
                )}
                fill={doubleHit ? '#34d399' : ringFill}
                stroke={doubleHit ? '#ffffff' : '#475569'}
                strokeWidth={doubleHit ? 2.5 : 1}
                filter={doubleHit ? 'url(#neonPulse)' : undefined}
                onClick={(e) => handleSegmentClick(e, sectorNum, 2)}
                className={`transition-opacity hover:opacity-90 ${
                  doubleHit ? 'segment-pulse' : ''
                }`}
              >
                <title>{`D${sectorNum} (${sectorNum * 2} pts)`}</title>
              </path>

              {/* OUTER SINGLE (Multiplier 1) */}
              <path
                d={createSectorPath(
                  cx,
                  cy,
                  BOARD_RADII.TRIPLE_OUTER * scale,
                  BOARD_RADII.DOUBLE_INNER * scale,
                  startAngle,
                  endAngle
                )}
                fill={outerSingleHit ? '#38bdf8' : singleFill}
                stroke={outerSingleHit ? '#ffffff' : '#475569'}
                strokeWidth={outerSingleHit ? 2.5 : 0.9}
                filter={outerSingleHit ? 'url(#neonPulse)' : undefined}
                onClick={(e) => handleSegmentClick(e, sectorNum, 1)}
                className={`transition-opacity hover:opacity-90 ${
                  outerSingleHit ? 'segment-pulse' : ''
                }`}
              >
                <title>{`S${sectorNum} (${sectorNum} pts)`}</title>
              </path>

              {/* TRIPLE RING (Multiplier 3) */}
              <path
                d={createSectorPath(
                  cx,
                  cy,
                  BOARD_RADII.TRIPLE_INNER * scale,
                  BOARD_RADII.TRIPLE_OUTER * scale,
                  startAngle,
                  endAngle
                )}
                fill={tripleHit ? '#34d399' : ringFill}
                stroke={tripleHit ? '#ffffff' : '#475569'}
                strokeWidth={tripleHit ? 2.5 : 1}
                filter={tripleHit ? 'url(#neonPulse)' : undefined}
                onClick={(e) => handleSegmentClick(e, sectorNum, 3)}
                className={`transition-opacity hover:opacity-90 ${
                  tripleHit ? 'segment-pulse' : ''
                }`}
              >
                <title>{`T${sectorNum} (${sectorNum * 3} pts)`}</title>
              </path>

              {/* INNER SINGLE (Multiplier 1) */}
              <path
                d={createSectorPath(
                  cx,
                  cy,
                  BOARD_RADII.OUTER_BULL * scale,
                  BOARD_RADII.TRIPLE_INNER * scale,
                  startAngle,
                  endAngle
                )}
                fill={outerSingleHit ? '#38bdf8' : singleFill}
                stroke={outerSingleHit ? '#ffffff' : '#475569'}
                strokeWidth={outerSingleHit ? 2.5 : 0.9}
                filter={outerSingleHit ? 'url(#neonPulse)' : undefined}
                onClick={(e) => handleSegmentClick(e, sectorNum, 1)}
                className={`transition-opacity hover:opacity-90 ${
                  outerSingleHit ? 'segment-pulse' : ''
                }`}
              >
                <title>{`S${sectorNum} (${sectorNum} pts)`}</title>
              </path>

              {/* High-Contrast TV Sector Number */}
              <text
                x={numPos.x}
                y={numPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                onClick={(e) => handleSegmentClick(e, sectorNum, 1)}
                className={`select-none text-[18px] font-black tracking-tighter ${
                  doubleHit || outerSingleHit || tripleHit
                    ? 'fill-emerald-400'
                    : 'fill-slate-100'
                }`}
              >
                {sectorNum}
              </text>
            </g>
          );
        })}

        {/* OUTER BULL (Segment 25, Multiplier 1 = 25 pts) */}
        <circle
          cx={cx}
          cy={cy}
          r={BOARD_RADII.OUTER_BULL * scale}
          fill={isHighlighted(25, 1) ? '#34d399' : '#16a34a'}
          stroke={isHighlighted(25, 1) ? '#ffffff' : '#e2e8f0'}
          strokeWidth={isHighlighted(25, 1) ? 3 : 1.5}
          filter={isHighlighted(25, 1) ? 'url(#neonPulse)' : undefined}
          onClick={(e) => handleSegmentClick(e, 25, 1)}
          className={`transition-opacity hover:opacity-90 ${
            isHighlighted(25, 1) ? 'segment-pulse' : ''
          }`}
        >
          <title>Outer Bull (25 pts)</title>
        </circle>

        {/* INNER BULLSEYE (Segment 25, Multiplier 2 = 50 pts) */}
        <circle
          cx={cx}
          cy={cy}
          r={BOARD_RADII.INNER_BULL * scale}
          fill={isHighlighted(25, 2) ? '#fde047' : '#dc2626'}
          stroke="#ffffff"
          strokeWidth={isHighlighted(25, 2) ? 3 : 1.5}
          filter={isHighlighted(25, 2) ? 'url(#neonPulse)' : undefined}
          onClick={(e) => handleSegmentClick(e, 25, 2)}
          className={`transition-opacity hover:opacity-90 ${
            isHighlighted(25, 2) ? 'segment-pulse' : ''
          }`}
        >
          <title>Bullseye (50 pts)</title>
        </circle>

        {/* Current Turn Plotted Dart Hit Markers (Dart 1, Dart 2, Dart 3) */}
        {currentTurn.map((dart, idx) => {
          const px = cx + (dart.x || 0) * scale;
          const py = cy + (dart.y || 0) * scale;
          const isLatest =
            highlightedDart && highlightedDart.id === dart.id;

          return (
            <g key={dart.id || idx} className="pointer-events-none">
              {/* Outer pulse ring on dart impact */}
              <circle
                cx={px}
                cy={py}
                r={isLatest ? 16 : 11}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={isLatest ? 2.5 : 1.5}
                strokeOpacity={isLatest ? 0.95 : 0.6}
              />
              {/* Pin center */}
              <circle
                cx={px}
                cy={py}
                r={6}
                fill="#fde047"
                stroke="#020617"
                strokeWidth="2"
              />
              {/* Dart slot badge (D1, D2, D3) */}
              <g transform={`translate(${px + 10}, ${py - 12})`}>
                <rect
                  x="-12"
                  y="-9"
                  width="24"
                  height="16"
                  rx="4"
                  fill="#020617"
                  stroke="#fde047"
                  strokeWidth="1.2"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-yellow-300 text-[9px] font-black"
                >
                  {`D${idx + 1}`}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Bottom Interactive Hint */}
      <div className="mt-2 flex items-center gap-2 text-center text-xs font-medium text-slate-400 sm:text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        <span>
          Click any segment on the SVG dartboard to simulate a hit &amp; test pulse detection
        </span>
      </div>
    </div>
  );
}
