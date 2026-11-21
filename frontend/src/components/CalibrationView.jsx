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
  Sparkles
} from 'lucide-react';
import {
  BOARD_SECTORS,
  BOARD_RADII,
  CALIBRATION_REFERENCE_TARGETS,
  buildBoardHomography,
  createProjectedRingPath
} from '../utils/dartboardMath';

// Default realistic camera perspective presets for 10 o'clock, 2 o'clock, and 6 o'clock OV9732 cameras
const CAMERA_PRESET_POINTS = {
  cam1: [
    { x: 0.525, y: 0.165, label: '20/1' },
    { x: 0.835, y: 0.525, label: '6/10' },
    { x: 0.475, y: 0.835, label: '3/19' },
    { x: 0.165, y: 0.475, label: '11/14' }
  ],
  cam2: [
    { x: 0.530, y: 0.170, label: '20/1' },
    { x: 0.830, y: 0.530, label: '6/10' },
    { x: 0.470, y: 0.830, label: '3/19' },
    { x: 0.170, y: 0.470, label: '11/14' }
  ],
  cam3: [
    { x: 0.522, y: 0.168, label: '20/1' },
    { x: 0.832, y: 0.522, label: '6/10' },
    { x: 0.478, y: 0.832, label: '3/19' },
    { x: 0.168, y: 0.478, label: '11/14' }
  ]
};

/**
 * Renders a Windows 10 USB camera feed, an MJPEG stream feed, or a realistic simulated OV9732
 * camera perspective dartboard feed, and overlays the live calibrated dartboard rings computed
 * from the 4 clicked reference points.
 */
function CameraCalibrationCanvas({
  camera,
  diagnostic,
  windowsVideoDevices,
  onUpdatePoints,
  onToggleOverlay,
  onUpdateStreamUrl
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useBrowserWebcam, setUseBrowserWebcam] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [webcamError, setWebcamError] = useState(null);

  const points = Array.isArray(camera.points) ? camera.points : [];
  const showOverlay = camera.showOverlay !== false;
  const isComplete = points.length === 4;
  const nextPointTarget =
    points.length < 4 ? CALIBRATION_REFERENCE_TARGETS[points.length] : null;

  // Connect to selected Windows 10 USB UVC camera via MediaDevices API
  useEffect(() => {
    let activeStream = null;
    if (useBrowserWebcam && navigator.mediaDevices?.getUserMedia) {
      const videoConstraint = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };

      navigator.mediaDevices
        .getUserMedia({ video: videoConstraint, audio: false })
        .then((stream) => {
          activeStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setWebcamError(null);
        })
        .catch((err) => {
          setWebcamError(err.message || 'No Windows USB camera accessible');
          setUseBrowserWebcam(false);
        });
    }
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useBrowserWebcam, selectedDeviceId]);

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
      { x: coords.x, y: coords.y, label: targetInfo.shortLabel }
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

  // Simulated background board projection (represents the physical board seen by the OV9732 camera)
  const presetPts = CAMERA_PRESET_POINTS[camera.id] || CAMERA_PRESET_POINTS.cam1;
  const projectBgFn = buildBoardHomography(presetPts);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Camera Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
              isComplete
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-400'
            }`}
          >
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                {camera.name}
              </h3>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                {camera.devicePath}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {useBrowserWebcam
                ? 'Live Windows 10 USB Camera Active'
                : camera.streamUrl && !streamError
                ? `Live Stream: ${camera.streamUrl}`
                : diagnostic?.statusLabel || 'Simulated OV9732 Feed (Fallback active)'}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
            isComplete
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>4/4 Aligned</span>
            </>
          ) : (
            <>
              <Crosshair className="h-3.5 w-3.5" />
              <span>{points.length}/4 Points</span>
            </>
          )}
        </span>
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
        {camera.streamUrl && !streamError && !useBrowserWebcam && (
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
          {(!camera.streamUrl || streamError) && !useBrowserWebcam && projectBgFn && (
            <g opacity="0.65">
              <rect width={W} height={H} fill="#050811" />
              {/* Simulated 360 LED light halo */}
              <circle cx={W / 2} cy={H / 2} r="138" fill="#0f172a" stroke="#1e293b" strokeWidth="4" />

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
                  Math.cos(labelAngleRad) * 1.11,
                  Math.sin(labelAngleRad) * 1.11
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
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>{camera.position} · OV9732 (Win10)</span>
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-900 px-3.5 py-2.5">
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
              onUpdatePoints(
                camera.id,
                JSON.parse(JSON.stringify(CAMERA_PRESET_POINTS[camera.id] || CAMERA_PRESET_POINTS.cam1))
              )
            }
            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Auto-Align</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
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
            title="Select Windows 10 USB Camera or MJPEG Stream URL"
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700"
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expandable Windows 10 USB Camera / Stream Settings Drawer */}
      {showSettings && (
        <div className="space-y-2.5 border-t border-slate-800 bg-slate-950 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-300">
              Windows 10 USB Camera Input:
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
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Default Windows USB Camera</option>
              {windowsVideoDevices.map((dev, i) => (
                <option key={dev.deviceId || i} value={dev.deviceId}>
                  {dev.label || `Windows USB Camera #${i + 1}`}
                </option>
              ))}
            </select>
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
              value={camera.streamUrl || ''}
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
  onResetCalibration,
  onTestCameras
}) {
  const [localCal, setLocalCal] = useState(calibration);
  const [saveBanner, setSaveBanner] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [windowsVideoDevices, setWindowsVideoDevices] = useState([]);

  const scanWindowsBrowserCameras = async () => {
    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setWindowsVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
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

  const camerasList = ['cam1', 'cam2', 'cam3'].map((id) => localCal.cameras[id]).filter(Boolean);
  const diagnosticsMap = {};
  if (cameraDiagnostics?.cameras) {
    cameraDiagnostics.cameras.forEach((d) => {
      diagnosticsMap[d.id] = d;
    });
  }

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
  };

  const handleSave = async () => {
    const result = await onSaveCalibration(localCal);
    setIsDirty(false);
    setSaveBanner({
      type: 'success',
      text:
        result?.syncResult?.message ||
        'Saved to config/calibration.json and synced to OpenDartboard!'
    });
  };

  const handleResetAll = async (preset = 'empty') => {
    await onResetCalibration(null, preset);
    setIsDirty(false);
    setSaveBanner({
      type: 'info',
      text:
        preset === 'default'
          ? 'Restored default 4-point calibration presets for all 3 cameras.'
          : 'Cleared all calibration points across all 3 cameras. Click 4 points on each camera to recalibrate.'
    });
  };

  const handleScanCameras = async () => {
    await scanWindowsBrowserCameras();
    await onTestCameras();
    setSaveBanner({
      type: 'info',
      text: `Scanned Windows 10 USB cameras (${windowsVideoDevices.length} browser videoinput device(s) found; 3 camera slots ready).`
    });
  };

  return (
    <div className="mx-auto max-w-[1800px] space-y-5 px-4 py-5 lg:px-6">
      {/* Top Calibration Control Bar */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-300">
                3-CAMERA VISION ALIGNMENT
              </span>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                OV9732 4-Point Board Calibration (Windows 10)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Click the <strong className="text-white">4 Double-ring intersections</strong> in clockwise order on each camera feed:{' '}
              <span className="font-mono font-bold text-emerald-400">#1 (20/1 Top)</span> →{' '}
              <span className="font-mono font-bold text-sky-400">#2 (6/10 Right)</span> →{' '}
              <span className="font-mono font-bold text-amber-400">#3 (3/19 Bottom)</span> →{' '}
              <span className="font-mono font-bold text-rose-400">#4 (11/14 Left)</span>.
            </p>
          </div>

          {/* Global Calibration Buttons: Scan USB Cameras, Reset Points, Restore Presets, Save Calibration */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleScanCameras}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
            >
              <Camera className="h-4 w-4 text-cyan-400" />
              <span>Scan Windows USB Cameras</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetAll('empty')}
              className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-sm font-extrabold text-rose-200 transition hover:bg-rose-500/25"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Points</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetAll('default')}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Load Demo Points</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-95 sm:text-base"
            >
              <Save className="h-5 w-5" />
              <span>Save Calibration</span>
              {isDirty && (
                <span className="ml-1 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                  Unsaved
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Save / Sync Feedback Banner */}
        {saveBanner && (
          <div
            className={`mt-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold ${
              saveBanner.type === 'success'
                ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                : 'border-sky-500/50 bg-sky-950/60 text-sky-200'
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

      {/* 3-PANEL CAMERA CALIBRATION GRID: Camera 1 (10 o'clock), Camera 2 (2 o'clock), Camera 3 (6 o'clock) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {camerasList.map((cam) => (
          <CameraCalibrationCanvas
            key={cam.id}
            camera={cam}
            diagnostic={diagnosticsMap[cam.id]}
            windowsVideoDevices={windowsVideoDevices}
            onUpdatePoints={handleUpdatePoints}
            onToggleOverlay={handleToggleOverlay}
            onUpdateStreamUrl={handleUpdateStreamUrl}
          />
        ))}
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
