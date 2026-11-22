import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Crosshair,
  Sliders,
  Video,
  Sparkles,
  Compass
} from 'lucide-react';
import {
  BOARD_SECTORS,
  BOARD_RADII,
  OPEN_BOTTOM_GAP,
  RING_LAYOUT_PRESETS,
  CALIBRATION_REFERENCE_TARGETS,
  normalizeDeg,
  isAngleInOpenBottom,
  isAngleInTopBar,
  angleToClockLabel,
  angleToNearestSector,
  computeTriangulationMetrics,
  computePerspectivePresetPoints,
  polarToCartesian,
  createArcPath,
  buildBoardHomography,
  createProjectedRingPath,
  createProjectedArcPath
} from '../utils/dartboardMath';

const CAMERA_COLORS = {
  cam1: '#10b981', // emerald
  cam2: '#38bdf8', // sky
  cam3: '#f59e0b'  // amber
};

const DEFAULT_MOUNT_ANGLES = {
  cam1: 345,
  cam2: 110,
  cam3: 235
};

/**
 * Interactive top-down diagram of the 270° open-bottom LED ring light, the 12 o'clock
 * mounting bar obstruction, the dartboard numbers, and the 3 camera mounting spots.
 */
function RingMountDiagram({ cameras, activeLayoutId, onSelectLayout }) {
  const size = 270;
  const cx = size / 2;
  const cy = size / 2;
  const boardR = 72;
  const numR = 84;
  const ringR = 104;
  const camLabelR = 122;

  const angles = cameras.map((c) =>
    typeof c.mountAngleDeg === 'number' ? c.mountAngleDeg : DEFAULT_MOUNT_ANGLES[c.id] || 0
  );
  const metrics = computeTriangulationMetrics(angles);

  return (
    <div className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl lg:grid-cols-12">
      {/* Top-Down Ring SVG */}
      <div className="flex flex-col items-center justify-center lg:col-span-4">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-[250px] w-[250px] select-none">
          {/* Dartboard Base */}
          <circle cx={cx} cy={cy} r={boardR} fill="#0b1120" stroke="#334155" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={boardR * 0.93} fill="none" stroke="#1e293b" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={boardR * 0.62} fill="none" stroke="#1e293b" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={7} fill="#14532d" stroke="#475569" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={3} fill="#dc2626" />

          {/* Key Dartboard Sector Numbers */}
          {BOARD_SECTORS.map((num, idx) => {
            const deg = idx * 18;
            const pos = polarToCartesian(cx, cy, numR, deg);
            const highlight = [20, 5, 1, 10, 15, 3, 16, 8].includes(num);
            return (
              <text
                key={num}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                className={`font-mono text-[8px] font-bold ${
                  highlight ? 'fill-slate-200' : 'fill-slate-500'
                }`}
              >
                {num}
              </text>
            );
          })}

          {/* Open Bottom Missing Section (4:30 to 7:30) */}
          <path
            d={createArcPath(cx, cy, ringR, OPEN_BOTTOM_GAP.startDeg, OPEN_BOTTOM_GAP.endDeg)}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="3"
            strokeDasharray="4 4"
            strokeOpacity="0.65"
          />
          <text
            x={cx}
            y={cy + ringR + 14}
            textAnchor="middle"
            className="fill-rose-400 font-mono text-[8px] font-black uppercase"
          >
            Open Bottom (No Ring)
          </text>

          {/* Illuminated 270° Ring Light Arc (7:30 clockwise over 12:00 to 4:30) */}
          <path
            d={createArcPath(cx, cy, ringR, OPEN_BOTTOM_GAP.endDeg, OPEN_BOTTOM_GAP.startDeg)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="6"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          <path
            d={createArcPath(cx, cy, ringR, OPEN_BOTTOM_GAP.endDeg, OPEN_BOTTOM_GAP.startDeg)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.7"
          />

          {/* 12 o'clock Mounting Bar Obstruction */}
          <g>
            <rect
              x={cx - 6}
              y={cy - ringR - 9}
              width="12"
              height="18"
              rx="2.5"
              fill="#f43f5e"
              stroke="#020617"
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy - ringR - 14}
              textAnchor="middle"
              className="fill-rose-300 font-mono text-[8px] font-black uppercase"
            >
              12:00 Bar
            </text>
          </g>

          {/* Camera Mount Points + Sightlines */}
          {cameras.map((cam, idx) => {
            const angle =
              typeof cam.mountAngleDeg === 'number'
                ? cam.mountAngleDeg
                : DEFAULT_MOUNT_ANGLES[cam.id] || 0;
            const color = CAMERA_COLORS[cam.id] || '#10b981';
            const pt = polarToCartesian(cx, cy, ringR, angle);
            const lbl = polarToCartesian(cx, cy, camLabelR, angle);
            const invalid = isAngleInOpenBottom(angle) || isAngleInTopBar(angle);

            return (
              <g key={cam.id}>
                <line
                  x1={pt.x}
                  y1={pt.y}
                  x2={cx}
                  y2={cy}
                  stroke={invalid ? '#f43f5e' : color}
                  strokeWidth="1.3"
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="8"
                  fill="#020617"
                  stroke={invalid ? '#f43f5e' : color}
                  strokeWidth="2.5"
                />
                <text
                  x={pt.x}
                  y={pt.y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-white font-mono text-[8px] font-black"
                >
                  {`C${idx + 1}`}
                </text>
                <text
                  x={lbl.x}
                  y={lbl.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={invalid ? '#fda4af' : color}
                  className="font-mono text-[8px] font-black"
                >
                  {angleToClockLabel(angle)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Layout Selector & Physical Mounting Specs */}
      <div className="flex flex-col justify-between space-y-4 lg:col-span-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-black text-white sm:text-lg">
                270° Open-Bottom Ring Layout (Clears 12:00 Bar &amp; Open Bottom)
              </h3>
            </div>

            <span
              className={`rounded-full border px-3 py-1 font-mono text-xs font-black ${
                metrics.isOptimal
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              Gaps: {metrics.gapsDeg.join('° / ')}°
            </span>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
            Because your ring light has <strong className="text-white">no bottom section (~4:30–7:30)</strong> and a{' '}
            <strong className="text-white">bar at 12 o&apos;clock</strong>, mount Camera 1 slightly off-center (left toward{' '}
            <strong className="text-emerald-300">5</strong> or right toward{' '}
            <strong className="text-emerald-300">1</strong>) and balance Cameras 2 &amp; 3 along the lower legs of the ring for near-120° triangulation:
          </p>
        </div>

        {/* 1-Click Top Camera Side Switcher */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.values(RING_LAYOUT_PRESETS).map((preset) => {
            const isSelected = activeLayoutId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectLayout(preset.id)}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-500/15 shadow-md shadow-emerald-950/50'
                    : 'border-slate-700 bg-slate-950/70 hover:border-slate-500 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">
                    {preset.id === 'ring270_left5'
                      ? 'Option A: Left of Bar (toward 5)'
                      : 'Option B: Right of Bar (toward 1)'}
                  </span>
                  {isSelected && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase text-slate-950">
                      Active
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-slate-300">{preset.summary}</p>
              </button>
            );
          })}
        </div>

        {/* Exact Physical Mounting Readout Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {cameras.map((cam, idx) => {
            const angle =
              typeof cam.mountAngleDeg === 'number'
                ? cam.mountAngleDeg
                : DEFAULT_MOUNT_ANGLES[cam.id] || 0;
            const sector = angleToNearestSector(angle);
            const clock = angleToClockLabel(angle);
            const inGap = isAngleInOpenBottom(angle);
            const inBar = isAngleInTopBar(angle);
            const color = CAMERA_COLORS[cam.id] || '#10b981';

            return (
              <div
                key={cam.id}
                className={`rounded-xl border p-3 ${
                  inGap || inBar
                    ? 'border-rose-500/50 bg-rose-950/30'
                    : 'border-slate-800 bg-slate-950/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase" style={{ color }}>
                    Cam {idx + 1} · {clock}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                    {Math.round(normalizeDeg(angle))}°
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-white">
                  Align over Sector <span className="font-mono text-emerald-300">{sector}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {inGap
                    ? 'Warning: Inside open bottom gap!'
                    : inBar
                    ? 'Warning: Hits 12:00 mounting bar!'
                    : 'Clears bar & open bottom'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a Windows 10 USB camera feed, an MJPEG stream feed, or a realistic simulated OV9732
 * camera perspective dartboard feed, and overlays the live calibrated dartboard rings computed
 * from the 4 clicked reference points.
 */
function CameraCalibrationCanvas({
  slotNumber,
  slotKey,
  slotTitle,
  slotColor,
  slotPositionTip,
  camera,
  diagnostic,
  windowsVideoDevices,
  assignedDeviceId,
  onAssignDevice,
  onUpdatePoints,
  onToggleOverlay,
  onUpdateStreamUrl,
  onUpdateMountAngle,
  onSaveSingleCamera,
  isSaved,
  savedTimestamp
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useBrowserWebcam, setUseBrowserWebcam] = useState(true);
  const [justSaved, setJustSaved] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(
    assignedDeviceId || (windowsVideoDevices[slotNumber - 1]?.deviceId) || ''
  );
  const [webcamError, setWebcamError] = useState(null);

  useEffect(() => {
    if (assignedDeviceId) {
      setSelectedDeviceId(assignedDeviceId);
    } else if (windowsVideoDevices[slotNumber - 1]?.deviceId) {
      setSelectedDeviceId(windowsVideoDevices[slotNumber - 1].deviceId);
    }
  }, [assignedDeviceId, windowsVideoDevices, slotNumber]);

  const points = Array.isArray(camera?.points) ? camera.points : [];
  const showOverlay = camera?.showOverlay !== false;
  const isComplete = points.length === 4;
  const nextPointTarget =
    points.length < 4 ? CALIBRATION_REFERENCE_TARGETS[points.length] : null;

  const mountAngleDeg =
    typeof camera?.mountAngleDeg === 'number'
      ? camera.mountAngleDeg
      : DEFAULT_MOUNT_ANGLES[slotKey] || 345;

  // Connect to selected Windows 10 USB UVC camera via MediaDevices API
  useEffect(() => {
    let activeStream = null;
    let isMounted = true;

    if (useBrowserWebcam && navigator.mediaDevices?.getUserMedia) {
      const deviceIdToUse = selectedDeviceId || windowsVideoDevices[slotNumber - 1]?.deviceId;
      const videoConstraint = deviceIdToUse
        ? { deviceId: { exact: deviceIdToUse }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      navigator.mediaDevices
        .getUserMedia({ video: videoConstraint, audio: false })
        .then((stream) => {
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          activeStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setWebcamError(null);
        })
        .catch((err) => {
          if (!isMounted) return;
          setWebcamError(err.message || `Camera ${slotNumber} hardware feed not accessible`);
        });
    }

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useBrowserWebcam, selectedDeviceId, slotNumber, windowsVideoDevices]);

  const getNormalizedCoords = (clientX, clientY) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width));
    const y = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / rect.height));
    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4))
    };
  };

  const handleCanvasClick = (e) => {
    if (draggingIdx !== null) return;
    if (points.length >= 4) return;
    const coords = getNormalizedCoords(e.clientX, e.clientY);
    if (!coords) return;
    const targetInfo = CALIBRATION_REFERENCE_TARGETS[points.length];
    const nextPoints = [
      ...points,
      { x: coords.x, y: coords.y, label: targetInfo.shortLabel.replace(/\s+/g, '') }
    ];
    onUpdatePoints(camera.id, nextPoints);
  };

  const handlePointerMove = (e) => {
    if (draggingIdx === null) return;
    const coords = getNormalizedCoords(e.clientX, e.clientY);
    if (!coords) return;
    const nextPoints = points.map((pt, idx) =>
      idx === draggingIdx ? { ...pt, x: coords.x, y: coords.y } : pt
    );
    onUpdatePoints(camera.id, nextPoints);
  };

  const handlePointerUp = () => {
    if (draggingIdx !== null) {
      setDraggingIdx(null);
    }
  };

  // Compute 4-point perspective homography when all 4 reference points are placed
  const W = 400;
  const H = 300;
  const projectUserFn = isComplete ? buildBoardHomography(points) : null;

  // Simulated background board projection computed dynamically from this camera's mountAngleDeg
  const presetPts = computePerspectivePresetPoints(mountAngleDeg);
  const projectBgFn = buildBoardHomography(presetPts);

  const angleInGap = isAngleInOpenBottom(mountAngleDeg);
  const angleInBar = isAngleInTopBar(mountAngleDeg);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Fixed Box Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl font-black text-xl shadow-lg shrink-0"
            style={{
              backgroundColor: slotColor || CAMERA_COLORS[slotKey] || '#10b981',
              color: '#020617'
            }}
          >
            {slotNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-wide">
                CAMERA {slotNumber}
              </h3>
              <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300">
                Fixed Box #{slotNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {useBrowserWebcam
                ? selectedDeviceId && windowsVideoDevices.length > 0
                  ? `Hardware: Camera ${windowsVideoDevices.findIndex((d) => d.deviceId === selectedDeviceId) + 1 || slotNumber} (Active USB)`
                  : `Camera ${slotNumber} Live USB Feed`
                : camera?.streamUrl && !streamError
                ? `Live Stream: ${camera.streamUrl}`
                : diagnostic?.statusLabel || 'Simulated OV9732 Feed'}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {isComplete && isSaved ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>✓ SAVED (4/4 Points)</span>
            </span>
          ) : isComplete ? (
            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-300 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span>● UNSAVED (4/4 Ready)</span>
            </span>
          ) : points.length > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full border border-sky-500/50 bg-sky-500/20 px-3 py-1 text-xs font-extrabold text-sky-300">
              <Crosshair className="h-3.5 w-3.5 text-sky-400" />
              <span>{points.length}/4 Points</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-bold text-slate-400">
              <span>0/4 Points (Unset)</span>
            </span>
          )}
        </div>
      </div>

      {/* Prompt Bar for Next Reference Point */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950 px-4 py-2 text-xs">
        {nextPointTarget ? (
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: nextPointTarget.color }}
            />
            <span>Click feed to place {nextPointTarget.fullLabel}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 font-bold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>All 4 points placed! Drag any point (1–4) to fine-tune ring overlay.</span>
          </div>
        )}
      </div>

      {/* Interactive Camera Feed Viewport */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`relative aspect-[4/3] w-full select-none overflow-hidden bg-slate-950 ${
          points.length < 4 ? 'cursor-crosshair' : 'cursor-default'
        }`}
      >
        {/* 1. Optional Live MJPEG Stream Image if configured */}
        {camera?.streamUrl && !streamError && !useBrowserWebcam && (
          <img
            src={camera.streamUrl}
            alt={camera.name}
            onError={() => setStreamError(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* 2. Optional Windows 10 DirectShow / UVC USB Webcam Feed */}
        {useBrowserWebcam && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* 3. Interactive SVG Viewport (Simulated OV9732 Board Reference + Calibrated Ring Overlay + 4 Draggable Points) */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
        >
          {/* When no live stream or webcam is active, render a realistic dark camera frame of an illuminated dartboard */}
          {(!camera?.streamUrl || streamError) && !useBrowserWebcam && projectBgFn && (
            <g opacity="0.7">
              <rect width={W} height={H} fill="#050811" />

              {/* Simulated 270° Open-Bottom LED Light Ring (open from 4:30 to 7:30) */}
              <path
                d={createProjectedArcPath(
                  projectBgFn,
                  1.30,
                  OPEN_BOTTOM_GAP.endDeg,
                  OPEN_BOTTOM_GAP.startDeg,
                  W,
                  H
                )}
                fill="none"
                stroke="#334155"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d={createProjectedArcPath(
                  projectBgFn,
                  1.30,
                  OPEN_BOTTOM_GAP.startDeg,
                  OPEN_BOTTOM_GAP.endDeg,
                  W,
                  H,
                  20
                )}
                fill="none"
                stroke="#7f1d1d"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* Simulated physical board rings in camera perspective */}
              <path
                d={createProjectedRingPath(projectBgFn, 1.0, W, H)}
                fill="#0b1120"
                stroke="#475569"
                strokeWidth="1.5"
              />
              <path
                d={createProjectedRingPath(projectBgFn, BOARD_RADII.DOUBLE_INNER, W, H)}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
              />
              <path
                d={createProjectedRingPath(projectBgFn, BOARD_RADII.TRIPLE_OUTER, W, H)}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
              />
              <path
                d={createProjectedRingPath(projectBgFn, BOARD_RADII.TRIPLE_INNER, W, H)}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
              />
              <path
                d={createProjectedRingPath(projectBgFn, BOARD_RADII.OUTER_BULL, W, H)}
                fill="#14532d"
                stroke="#475569"
                strokeWidth="1"
              />
              <path
                d={createProjectedRingPath(projectBgFn, BOARD_RADII.INNER_BULL, W, H)}
                fill="#7f1d1d"
                stroke="#e2e8f0"
                strokeWidth="1"
              />

              {/* Radial sector wires on simulated feed */}
              {BOARD_SECTORS.map((num, idx) => {
                const wireAngleDeg = idx * 18 + 9;
                const rad = ((wireAngleDeg - 90) * Math.PI) / 180;
                const innerPt = projectBgFn(
                  Math.cos(rad) * BOARD_RADII.OUTER_BULL,
                  Math.sin(rad) * BOARD_RADII.OUTER_BULL
                );
                const outerPt = projectBgFn(Math.cos(rad) * 1.0, Math.sin(rad) * 1.0);
                const labelAngleRad = ((idx * 18 - 90) * Math.PI) / 180;
                const labelPt = projectBgFn(
                  Math.cos(labelAngleRad) * 1.12,
                  Math.sin(labelAngleRad) * 1.12
                );

                return (
                  <g key={num}>
                    <line
                      x1={innerPt.x * W}
                      y1={innerPt.y * H}
                      x2={outerPt.x * W}
                      y2={outerPt.y * H}
                      stroke="#334155"
                      strokeWidth="0.9"
                    />
                    <text
                      x={labelPt.x * W}
                      y={labelPt.y * H}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-slate-400 font-mono text-[10px] font-bold"
                    >
                      {num}
                    </text>
                  </g>
                );
              })}

              {/* Visual crosshair target hints at the 4 reference intersections on the simulated board */}
              {CALIBRATION_REFERENCE_TARGETS.map((t) => {
                const rad = ((t.angleDeg - 90) * Math.PI) / 180;
                const pt = projectBgFn(Math.cos(rad), Math.sin(rad));
                return (
                  <circle
                    key={t.shortLabel}
                    cx={pt.x * W}
                    cy={pt.y * H}
                    r="4"
                    fill="none"
                    stroke={t.color}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                );
              })}
            </g>
          )}

          {/* LIVE CALIBRATED DARTBOARD RING OVERLAY (Projected from User's 4 Points) */}
          {showOverlay && projectUserFn && (
            <g className="pointer-events-none">
              {/* Outer & Inner Double Ring Overlay */}
              <path
                d={createProjectedRingPath(projectUserFn, 1.0, W, H)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.2"
              />
              <path
                d={createProjectedRingPath(projectUserFn, BOARD_RADII.DOUBLE_INNER, W, H)}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.3"
                strokeDasharray="4 2"
              />

              {/* Outer & Inner Triple Ring Overlay */}
              <path
                d={createProjectedRingPath(projectUserFn, BOARD_RADII.TRIPLE_OUTER, W, H)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
              />
              <path
                d={createProjectedRingPath(projectUserFn, BOARD_RADII.TRIPLE_INNER, W, H)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />

              {/* Outer & Inner Bullseye Overlay */}
              <path
                d={createProjectedRingPath(projectUserFn, BOARD_RADII.OUTER_BULL, W, H, 36)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.8"
              />
              <path
                d={createProjectedRingPath(projectUserFn, BOARD_RADII.INNER_BULL, W, H, 24)}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.8"
              />

              {/* 20 Calibrated Sector Divider Wires */}
              {BOARD_SECTORS.map((num, idx) => {
                const wireAngleDeg = idx * 18 + 9;
                const rad = ((wireAngleDeg - 90) * Math.PI) / 180;
                const pInner = projectUserFn(
                  Math.cos(rad) * BOARD_RADII.OUTER_BULL,
                  Math.sin(rad) * BOARD_RADII.OUTER_BULL
                );
                const pOuter = projectUserFn(Math.cos(rad) * 1.0, Math.sin(rad) * 1.0);
                const isCardinalWire = [9, 99, 189, 279].includes(wireAngleDeg);

                return (
                  <line
                    key={num}
                    x1={pInner.x * W}
                    y1={pInner.y * H}
                    x2={pOuter.x * W}
                    y2={pOuter.y * H}
                    stroke={isCardinalWire ? '#fde047' : '#10b981'}
                    strokeWidth={isCardinalWire ? '1.8' : '0.9'}
                    strokeOpacity={isCardinalWire ? '0.95' : '0.65'}
                  />
                );
              })}
            </g>
          )}

          {/* Polygon outline connecting the clicked calibration points */}
          {points.length > 1 && (
            <polyline
              points={
                points.map((p) => `${p.x * W},${p.y * H}`).join(' ') +
                (points.length === 4 ? ` ${points[0].x * W},${points[0].y * H}` : '')
              }
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeDasharray="4 4"
              strokeOpacity="0.7"
            />
          )}

          {/* Render the 4 User-Clicked Reference Calibration Points (Draggable) */}
          {points.map((pt, idx) => {
            const targetMeta = CALIBRATION_REFERENCE_TARGETS[idx] || {
              shortLabel: `P${idx + 1}`,
              color: '#10b981'
            };
            const px = pt.x * W;
            const py = pt.y * H;

            return (
              <g
                key={idx}
                transform={`translate(${px}, ${py})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingIdx(idx);
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                <circle
                  r="12"
                  fill={targetMeta.color}
                  fillOpacity="0.22"
                  stroke={targetMeta.color}
                  strokeWidth="2"
                />
                <circle r="4" fill="#ffffff" />
                <rect
                  x="10"
                  y="-10"
                  width="46"
                  height="18"
                  rx="4"
                  fill="#020617"
                  stroke={targetMeta.color}
                  strokeWidth="1.2"
                />
                <text
                  x="33"
                  y="-1"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-white font-mono text-[9px] font-black"
                >
                  {`#${idx + 1} ${targetMeta.shortLabel}`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Camera Feed Top-Left HUD Badge */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950/85 px-2.5 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-sm">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: slotColor || CAMERA_COLORS[slotKey] || '#10b981' }}
          />
          <span>
            Camera {slotNumber} ({Math.round(normalizeDeg(mountAngleDeg))}°) · {slotPositionTip}
          </span>
        </div>
      </div>

      {/* Coordinate Pill Readout for the 4 Points */}
      <div className="grid grid-cols-4 gap-1.5 border-t border-slate-800 bg-slate-950/80 px-3 py-2.5">
        {CALIBRATION_REFERENCE_TARGETS.map((target, idx) => {
          const pt = points[idx];
          return (
            <div
              key={target.shortLabel}
              className={`rounded-lg border px-2 py-1.5 text-center ${
                pt
                  ? 'border-slate-800 bg-slate-900/90 text-slate-200'
                  : 'border-dashed border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              <div
                className="text-[11px] font-black"
                style={{ color: target.color }}
              >
                #{idx + 1} {target.shortLabel}
              </div>
              <div className="font-mono text-[10px]">
                {pt
                  ? `${Math.round(pt.x * 100)}%, ${Math.round(pt.y * 100)}%`
                  : 'Unset'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-Camera Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900 px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdatePoints(camera.id, [])}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Clear 4 Pts</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdatePoints(camera.id, computePerspectivePresetPoints(mountAngleDeg))
            }
            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto-Align</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleOverlay(camera.id)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              showOverlay
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}
          >
            {showOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Rings</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            title="Mount angle, Windows 10 USB Camera, or MJPEG Stream URL"
            className={`rounded-lg border p-1.5 transition ${
              showSettings
                ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
                : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Dedicated Save Button for this Camera */}
        <button
          type="button"
          onClick={async () => {
            if (onSaveSingleCamera) {
              await onSaveSingleCamera(slotKey, camera);
              setJustSaved(true);
              setTimeout(() => setJustSaved(false), 2500);
            }
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black shadow-md transition active:scale-95 ${
            justSaved
              ? 'border border-emerald-400 bg-emerald-500 text-slate-950 shadow-emerald-500/30'
              : !isSaved && isComplete
              ? 'border border-emerald-400 bg-emerald-500 text-slate-950 shadow-emerald-500/30 hover:bg-emerald-400 animate-pulse'
              : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          <Save className="h-4 w-4" />
          <span>
            {justSaved
              ? `✓ Camera ${slotNumber} Saved!`
              : `Save Camera ${slotNumber}${points.length === 4 ? '' : ` (${points.length}/4)`}`}
          </span>
        </button>
      </div>

      {/* Expandable Mount Angle & Windows 10 USB Camera / Stream Settings Drawer */}
      {showSettings && (
        <div className="space-y-3 border-t border-slate-800 bg-slate-950 p-3 text-xs">
          {/* Fine-Tune Ring Mount Angle */}
          <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">
                Ring Mount Position:
              </span>
              <span className="font-mono font-bold text-emerald-300">
                {angleToClockLabel(mountAngleDeg)} · {Math.round(normalizeDeg(mountAngleDeg))}° (over {angleToNearestSector(mountAngleDeg)})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              value={Math.round(normalizeDeg(mountAngleDeg))}
              onChange={(e) => onUpdateMountAngle(camera.id, Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
            {(angleInGap || angleInBar) && (
              <p className="text-[11px] font-bold text-rose-400">
                {angleInBar
                  ? 'Warning: 354°–6° overlaps the 12 o’clock bar — nudge left (~345° toward 5) or right (~15° toward 1).'
                  : 'Warning: 135°–225° is inside the missing bottom section of your 270° ring.'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-300">
              Windows 10 USB Camera Feed:
            </span>
            <button
              type="button"
              onClick={() => setUseBrowserWebcam(!useBrowserWebcam)}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-bold ${
                useBrowserWebcam
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Video className="h-3 w-3" />
              <span>{useBrowserWebcam ? 'Stop Live USB Feed' : 'Enable Live USB Feed'}</span>
            </button>
          </div>

          {windowsVideoDevices.length > 0 && (
            <div>
              <span className="mb-1 block font-bold text-slate-300">
                Assign USB Camera Device to Camera {slotNumber}:
              </span>
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  if (onAssignDevice) onAssignDevice(slotKey, e.target.value);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                {windowsVideoDevices.map((dev, i) => (
                  <option key={dev.deviceId || i} value={dev.deviceId}>
                    Camera {i + 1} ({dev.label || `USB Video Device #${i + 1}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          {webcamError && (
            <p className="text-rose-400">{webcamError}</p>
          )}

          <div>
            <span className="mb-1 block font-bold text-slate-400">
              Or OpenDartboard MJPEG Stream URL:
            </span>
            <input
              type="text"
              value={camera?.streamUrl || ''}
              onChange={(e) => {
                setStreamError(false);
                onUpdateStreamUrl(camera.id, e.target.value);
              }}
              placeholder="e.g. http://localhost:8080/cam1.mjpg"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalibrationView({
  calibration,
  cameraDiagnostics,
  onSaveCalibration,
  onSaveSingleCamera,
  onResetCalibration,
  onTestCameras
}) {
  const [localCal, setLocalCal] = useState(calibration);
  const [saveBanner, setSaveBanner] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [savedCameras, setSavedCameras] = useState({
    cam1: true,
    cam2: true,
    cam3: true
  });
  const [windowsVideoDevices, setWindowsVideoDevices] = useState([]);
  const [assignedDeviceMap, setAssignedDeviceMap] = useState({});

  const scanWindowsBrowserCameras = async () => {
    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter((d) => d.kind === 'videoinput');
        setWindowsVideoDevices(videoDevs);
      } catch {
        setWindowsVideoDevices([]);
      }
    }
  };

  useEffect(() => {
    scanWindowsBrowserCameras();
  }, []);

  useEffect(() => {
    if (calibration) {
      setLocalCal(calibration);
      setIsDirty(false);
    }
  }, [calibration]);

  if (!localCal || !localCal.cameras) {
    return null;
  }

  const activeLayoutId = localCal.ringLayout?.id || 'ring270_left5';

  const diagnosticsMap = {};
  if (cameraDiagnostics?.cameras) {
    cameraDiagnostics.cameras.forEach((d) => {
      diagnosticsMap[d.id] = d;
    });
  }

  const handleSelectRingLayout = async (layoutId) => {
    const preset = RING_LAYOUT_PRESETS[layoutId];
    if (!preset) return;
    await onResetCalibration(null, 'default', layoutId);
    setIsDirty(false);
    setSaveBanner({
      type: 'success',
      text: `Switched to ${preset.label} and updated perspective presets in config/calibration.json.`
    });
  };

  const handleUpdatePoints = (camId, newPoints) => {
    setLocalCal((prev) => ({
      ...prev,
      cameras: {
        ...prev.cameras,
        [camId]: {
          ...prev.cameras[camId],
          points: newPoints,
          calibrated: newPoints.length === 4
        }
      }
    }));
    setIsDirty(true);
    setSavedCameras((prev) => ({ ...prev, [camId]: false }));
    setSaveBanner(null);
  };

  const handleToggleOverlay = (camId) => {
    setLocalCal((prev) => ({
      ...prev,
      cameras: {
        ...prev.cameras,
        [camId]: {
          ...prev.cameras[camId],
          showOverlay: prev.cameras[camId].showOverlay === false
        }
      }
    }));
  };

  const handleUpdateStreamUrl = (camId, url) => {
    setLocalCal((prev) => ({
      ...prev,
      cameras: {
        ...prev.cameras,
        [camId]: {
          ...prev.cameras[camId],
          streamUrl: url
        }
      }
    }));
    setIsDirty(true);
    setSavedCameras((prev) => ({ ...prev, [camId]: false }));
  };

  const handleUpdateMountAngle = (camId, angleDeg) => {
    const normAngle = normalizeDeg(angleDeg);
    const clock = angleToClockLabel(normAngle);
    const sector = angleToNearestSector(normAngle);
    const camNum = camId === 'cam1' ? 1 : camId === 'cam2' ? 2 : 3;

    setLocalCal((prev) => ({
      ...prev,
      cameras: {
        ...prev.cameras,
        [camId]: {
          ...prev.cameras[camId],
          mountAngleDeg: normAngle,
          position: `${clock} (over ${sector})`,
          name: `Camera ${camNum}`,
          points: computePerspectivePresetPoints(normAngle),
          calibrated: true
        }
      }
    }));
    setIsDirty(true);
    setSavedCameras((prev) => ({ ...prev, [camId]: false }));
    setSaveBanner(null);
  };

  const handleAssignDevice = (camId, deviceId) => {
    setAssignedDeviceMap((prev) => ({ ...prev, [camId]: deviceId }));
  };

  const handleSaveAll = async () => {
    const result = await onSaveCalibration(localCal);
    setIsDirty(false);
    setSavedCameras({ cam1: true, cam2: true, cam3: true });
    setSaveBanner({
      type: 'success',
      text:
        result?.syncResult?.message ||
        `✓ All 3 cameras (Camera 1, Camera 2, Camera 3) saved to config/calibration.json at ${new Date().toLocaleTimeString()}!`
    });
  };

  const handleSaveCamera = async (camId) => {
    const camNum = camId === 'cam1' ? 1 : camId === 'cam2' ? 2 : 3;
    const camData = localCal.cameras?.[camId];
    if (onSaveSingleCamera) {
      await onSaveSingleCamera(camId, camData);
    } else {
      await onSaveCalibration(localCal);
    }
    setSavedCameras((prev) => ({ ...prev, [camId]: true }));
    setSaveBanner({
      type: 'success',
      text: `✓ Camera ${camNum} calibration saved successfully to config/calibration.json at ${new Date().toLocaleTimeString()}!`
    });
  };

  const handleResetAll = async (preset = 'empty') => {
    await onResetCalibration(null, preset);
    setIsDirty(false);
    setSaveBanner({
      type: 'info',
      text:
        preset === 'default'
          ? 'Restored 270° ring perspective presets for Camera 1, Camera 2, and Camera 3.'
          : 'Cleared all calibration points across Camera 1, 2, and 3. Click the 4 Double-ring intersections on each camera to calibrate.'
    });
  };

  const handleScanCameras = async () => {
    await scanWindowsBrowserCameras();
    await onTestCameras();
    setSaveBanner({
      type: 'info',
      text: `Scanned Windows 10 USB cameras (${windowsVideoDevices.length} browser videoinput device(s) found; Camera 1, Camera 2, Camera 3 ready).`
    });
  };

  const FIXED_SLOTS = [
    { number: 1, key: 'cam1', title: 'Camera 1', color: '#10b981', positionTip: 'Top (10–12 o\'clock)' },
    { number: 2, key: 'cam2', title: 'Camera 2', color: '#38bdf8', positionTip: 'Right (2–4 o\'clock)' },
    { number: 3, key: 'cam3', title: 'Camera 3', color: '#f59e0b', positionTip: 'Left (6–8 o\'clock)' }
  ];

  const camerasList = FIXED_SLOTS.map((s) => localCal.cameras?.[s.key]).filter(Boolean);

  return (
    <div className="mx-auto max-w-[1800px] space-y-5 px-4 py-5 lg:px-6">
      {/* Top Calibration Control Bar & Status */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-300">
                3 FIXED BOXES · FORCED 1, 2, 3 ALIGNMENT
              </span>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                Camera Calibration (Camera 1 → Camera 2 → Camera 3)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Each camera is forced into a fixed box below:{' '}
              <strong className="text-emerald-400">Box 1 (Camera 1)</strong> →{' '}
              <strong className="text-sky-400">Box 2 (Camera 2)</strong> →{' '}
              <strong className="text-amber-400">Box 3 (Camera 3)</strong>.{' '}
              Click the <strong className="text-white">4 Double-ring intersections</strong> in clockwise order (#1 20/1, #2 6/10, #3 3/19, #4 11/14), then click <strong className="text-white">Save Camera</strong> in each box.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleScanCameras}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
            >
              <Camera className="h-4 w-4 text-cyan-400" />
              <span>Scan USB Cameras</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetAll('empty')}
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-extrabold text-rose-200 transition hover:bg-rose-500/25"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Points</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetAll('default')}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Load Presets</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-95 sm:text-base"
            >
              <Save className="h-5 w-5" />
              <span>Save All Cameras (1, 2, 3)</span>
              {isDirty && (
                <span className="ml-1 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                  Unsaved
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 3-Camera Quick Status Pill Readout */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {FIXED_SLOTS.map((slot) => {
            const cam = localCal.cameras?.[slot.key];
            const pts = Array.isArray(cam?.points) ? cam.points : [];
            const isCamSaved = savedCameras[slot.key] !== false && pts.length === 4;
            const has4 = pts.length === 4;

            return (
              <div
                key={slot.key}
                className={`flex items-center justify-between rounded-xl border p-3 ${
                  has4 && isCamSaved
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                    : has4 && !isCamSaved
                    ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                    : 'border-slate-800 bg-slate-950/50 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-lg font-black text-xs"
                    style={{ backgroundColor: slot.color, color: '#020617' }}
                  >
                    {slot.number}
                  </span>
                  <div>
                    <div className="font-extrabold text-white text-xs">
                      {slot.title} ({slot.positionTip})
                    </div>
                    <div className="text-[11px] opacity-80">
                      {pts.length}/4 Points Placed
                    </div>
                  </div>
                </div>

                <div>
                  {has4 && isCamSaved ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>SAVED</span>
                    </span>
                  ) : has4 && !isCamSaved ? (
                    <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-black text-amber-300 animate-pulse">
                      <AlertTriangle className="h-3 w-3" />
                      <span>UNSAVED</span>
                    </span>
                  ) : (
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                      {pts.length > 0 ? `${pts.length}/4 PTS` : 'NOT CALIBRATED'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Save / Sync Feedback Banner */}
        {saveBanner && (
          <div
            className={`mt-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
              saveBanner.type === 'success'
                ? 'border-emerald-500/50 bg-emerald-950/80 text-emerald-200'
                : 'border-sky-500/50 bg-sky-950/80 text-sky-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>{saveBanner.text}</span>
            </div>
            <span className="font-mono text-xs opacity-75">
              config/calibration.json
            </span>
          </div>
        )}
      </section>

      {/* Interactive 270° Open-Bottom Ring Light Mounting Guide & Top-Camera Side Selector */}
      <RingMountDiagram
        cameras={camerasList}
        activeLayoutId={activeLayoutId}
        onSelectLayout={handleSelectRingLayout}
      />

      {/* 3 FIXED BOXES: CAMERA 1 -> CAMERA 2 -> CAMERA 3 */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {FIXED_SLOTS.map((slot) => {
          const cam = localCal.cameras?.[slot.key] || {
            id: slot.key,
            name: slot.title,
            position: slot.positionTip,
            points: []
          };
          const pts = Array.isArray(cam?.points) ? cam.points : [];
          const isCamSaved = savedCameras[slot.key] !== false && pts.length === 4;

          return (
            <CameraCalibrationCanvas
              key={slot.key}
              slotNumber={slot.number}
              slotKey={slot.key}
              slotTitle={slot.title}
              slotColor={slot.color}
              slotPositionTip={slot.positionTip}
              camera={cam}
              diagnostic={diagnosticsMap[slot.key]}
              windowsVideoDevices={windowsVideoDevices}
              assignedDeviceId={assignedDeviceMap[slot.key]}
              onAssignDevice={handleAssignDevice}
              onUpdatePoints={handleUpdatePoints}
              onToggleOverlay={handleToggleOverlay}
              onUpdateStreamUrl={handleUpdateStreamUrl}
              onUpdateMountAngle={handleUpdateMountAngle}
              onSaveSingleCamera={handleSaveCamera}
              isSaved={isCamSaved}
              savedTimestamp={cam.savedAt}
            />
          );
        })}
      </section>

      {/* Bottom Reference Legend & Persistence Info */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-3.5 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold uppercase tracking-wider text-slate-300">
            Overlay Ring Legend:
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span>Double Ring &amp; Sector Wires</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            <span>Triple Ring</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span>Outer Bull (25)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span>Inner Bull (50)</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span>
            Last Saved: {localCal.updatedAt ? new Date(localCal.updatedAt).toLocaleString() : 'Never'}
          </span>
        </div>
      </section>
    </div>
  );
}
