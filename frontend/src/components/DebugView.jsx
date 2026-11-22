import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RefreshCw,
  VideoOff,
  CheckCircle2,
  Eye,
  EyeOff,
  Cpu,
  Lock
} from 'lucide-react';
import {
  BOARD_RADII,
  OPEN_BOTTOM_GAP,
  normalizeDeg,
  angleToClockLabel,
  angleToNearestSector,
  computePerspectivePresetPoints,
  buildBoardHomography,
  createProjectedRingPath,
  createProjectedArcPath
} from '../utils/dartboardMath';

/**
 * Individual physical webcam live preview monitor (reuses persistent stream if already assigned to a slot)
 */
function PhysicalWebcamCard({ device, index, existingStream, onAssignToSlot }) {
  const videoRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [resolution, setResolution] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let localStream = null;
    let isMounted = true;

    async function startStream() {
      if (existingStream && existingStream.active) {
        if (videoRef.current) {
          videoRef.current.srcObject = existingStream;
        }
        setStreamActive(true);
        setError(null);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: device.deviceId },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStreamActive(true);
        setError(null);
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to open USB camera stream');
          setStreamActive(false);
        }
      }
    }

    startStream();

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [device.deviceId, existingStream]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setResolution({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 font-mono text-xs font-black text-purple-300">
            #{index + 1}
          </span>
          <div>
            <h4 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[280px]">
              {device.label || `USB Video Device ${index + 1}`}
            </h4>
            <p className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]">
              {device.deviceId.slice(0, 24)}...
            </p>
          </div>
        </div>

        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
            streamActive
              ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
              : 'border border-amber-500/40 bg-amber-500/20 text-amber-300'
          }`}
        >
          {streamActive ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </>
          ) : (
            <span>Standby</span>
          )}
        </span>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className="h-full w-full object-cover"
        />

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
            <VideoOff className="h-8 w-8 text-rose-400 mb-2" />
            <p className="text-xs font-bold text-rose-300">{error}</p>
          </div>
        )}

        {/* Live HUD Overlay */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-300 backdrop-blur-sm">
          <span>{resolution ? `${resolution.width}x${resolution.height}` : '720p'}</span>
          <span>•</span>
          <span className="text-emerald-400">DirectShow</span>
        </div>
      </div>

      {/* Assign Quick Buttons (Persists to calibration.json!) */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs">
        <span className="font-bold text-slate-400">Save to Slot:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAssignToSlot('cam1', device.deviceId)}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-bold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Cam 1 (Top)
          </button>
          <button
            type="button"
            onClick={() => onAssignToSlot('cam2', device.deviceId)}
            className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-bold text-sky-300 transition hover:bg-sky-500/20"
          >
            Cam 2 (Right)
          </button>
          <button
            type="button"
            onClick={() => onAssignToSlot('cam3', device.deviceId)}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-bold text-amber-300 transition hover:bg-amber-500/20"
          >
            Cam 3 (Left)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Camera Slot Diagnostic Card with persistent stream and ring calibration overlay
 */
function SlotPreviewCard({
  slotKey,
  camera,
  diagnostic,
  persistentStream,
  runtimeStatus,
  windowsVideoDevices,
  onAssignDevice
}) {
  const videoRef = useRef(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const mountAngleDeg = camera?.mountAngleDeg ?? (slotKey === 'cam1' ? 345 : slotKey === 'cam2' ? 110 : 235);
  const clockLabel = angleToClockLabel(mountAngleDeg);
  const sectorLabel = angleToNearestSector(mountAngleDeg);
  const points = Array.isArray(camera?.points) ? camera.points : [];
  const streamActive = Boolean(persistentStream && runtimeStatus?.active);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = persistentStream || null;
    }
  }, [persistentStream]);

  const W = 400;
  const H = 300;
  const presetPts = points.length === 4 ? points : computePerspectivePresetPoints(mountAngleDeg);
  const projectFn = buildBoardHomography(presetPts);

  const slotColors = {
    cam1: { text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    cam2: { text: 'text-sky-400', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
    cam3: { text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
  }[slotKey];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/70 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-base font-black ${slotColors.text}`}>
              {camera?.name || `Camera (${clockLabel})`}
            </h3>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
              {camera?.deviceLabel || camera?.devicePath || 'USB Camera'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Mount: <strong className="text-white">{clockLabel}</strong> ({Math.round(normalizeDeg(mountAngleDeg))}°) · Over Sector{' '}
            <strong className="text-emerald-300">{sectorLabel}</strong>
          </p>
        </div>

        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black border ${slotColors.badge}`}
        >
          {points.length === 4 ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Calibrated (4/4)</span>
            </>
          ) : (
            <span>{points.length}/4 Points</span>
          )}
        </span>
      </div>

      {/* Video Preview Viewport */}
      <div className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Fallback visual if no live stream available */}
        {!streamActive && projectFn && (
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
            <rect width={W} height={H} fill="#050811" />
            <path
              d={createProjectedArcPath(
                projectFn,
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
              d={createProjectedRingPath(projectFn, 1.0, W, H)}
              fill="#0b1120"
              stroke="#475569"
              strokeWidth="1.5"
            />
            <path
              d={createProjectedRingPath(projectFn, BOARD_RADII.OUTER_BULL, W, H)}
              fill="#14532d"
              stroke="#475569"
              strokeWidth="1"
            />
            <path
              d={createProjectedRingPath(projectFn, BOARD_RADII.INNER_BULL, W, H)}
              fill="#7f1d1d"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </svg>
        )}

        {/* Overlay calibrated rings */}
        {showOverlay && projectFn && (
          <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full">
            <path
              d={createProjectedRingPath(projectFn, 1.0, W, H)}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.2"
            />
            <path
              d={createProjectedRingPath(projectFn, BOARD_RADII.DOUBLE_INNER, W, H)}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.2"
              strokeDasharray="4 2"
            />
            <path
              d={createProjectedRingPath(projectFn, BOARD_RADII.TRIPLE_OUTER, W, H)}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.8"
            />
            <path
              d={createProjectedRingPath(projectFn, BOARD_RADII.OUTER_BULL, W, H, 36)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
            />
            <path
              d={createProjectedRingPath(projectFn, BOARD_RADII.INNER_BULL, W, H, 24)}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.8"
            />
          </svg>
        )}

        {/* Labels HUD */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950/85 px-2.5 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-sm">
          <span className={`h-2 w-2 rounded-full ${streamActive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span>{streamActive ? `USB Live (${runtimeStatus?.resolution || '720p'})` : 'Simulated Preview'}</span>
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 rounded-lg border border-slate-800 bg-slate-950/85 px-2 py-0.5 font-mono text-[10px] text-slate-300">
          Diff: {runtimeStatus?.diffScore || 0}px
        </div>
      </div>

      {/* Footer Controls & Device Selector */}
      <div className="flex flex-col gap-2.5 border-t border-slate-800 bg-slate-950 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-400">Assigned USB Camera:</span>
          <button
            type="button"
            onClick={() => setShowOverlay(!showOverlay)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              showOverlay
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}
          >
            {showOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Overlay</span>
          </button>
        </div>

        <select
          value={camera?.deviceId || ''}
          onChange={(e) => onAssignDevice(slotKey, e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="">Auto-Assign Distinct USB Camera</option>
          {windowsVideoDevices.map((dev, i) => (
            <option key={dev.deviceId || i} value={dev.deviceId}>
              {dev.label || `Windows USB Camera #${i + 1}`}
            </option>
          ))}
        </select>

        <p className="text-[11px] text-slate-400 truncate">
          Port: {diagnostic?.usbBusTip || 'Windows 10 USB 3.0 Port'}
        </p>
      </div>
    </div>
  );
}

export default function DebugView({
  calibration,
  cameraDiagnostics,
  scorerStatus,
  onExitDevMode,
  onSwitchToCalibration,
  onTestCameras,
  vision
}) {
  const [scanning, setScanning] = useState(false);

  const windowsVideoDevices = vision?.windowsVideoDevices || [];

  const scanDevices = async () => {
    setScanning(true);
    try {
      if (vision?.scanWindowsCameras) {
        await vision.scanWindowsCameras(true);
      }
      if (onTestCameras) {
        await onTestCameras();
      }
    } finally {
      setTimeout(() => setScanning(false), 300);
    }
  };

  const handleAssignToSlot = async (slotKey, deviceId) => {
    if (vision?.assignDeviceToSlot) {
      await vision.assignDeviceToSlot(slotKey, deviceId);
    }
  };

  const camerasObj = calibration?.cameras || {};
  const cam1 = camerasObj.cam1;
  const cam2 = camerasObj.cam2;
  const cam3 = camerasObj.cam3;

  const diagMap = {};
  if (cameraDiagnostics?.cameras) {
    cameraDiagnostics.cameras.forEach((d) => {
      diagMap[d.id] = d;
    });
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 px-4 py-5 lg:px-6">
      {/* Top Banner: Dev Mode Active & Controls */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-950 p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/50 bg-purple-500/20 text-purple-300 shadow-lg shadow-purple-950/60">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-purple-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-purple-300">
                DEVELOPER MODE (PIN: 0161 UNLOCKED)
              </span>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                Camera Previews &amp; OpenCV-Darts Vision Diagnostics
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
              Live Windows 10 DirectShow USB video feeds, persistent slot mapping, and 270° ring geometry verification
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={scanDevices}
            disabled={scanning}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700 active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 text-cyan-400 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Re-scan USB Cameras'}</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToCalibration}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95"
          >
            <Camera className="h-4 w-4" />
            <span>Go to Calibration</span>
          </button>

          <button
            type="button"
            onClick={onExitDevMode}
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-sm font-black text-rose-200 transition hover:bg-rose-500/25 active:scale-95"
          >
            <Lock className="h-4 w-4" />
            <span>Exit Dev Mode</span>
          </button>
        </div>
      </section>

      {/* System Hardware Status Bar */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Physical USB Cameras
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-white">
              {windowsVideoDevices.length} Connected
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-black ${
                windowsVideoDevices.length >= 3
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {windowsVideoDevices.length >= 3 ? 'All 3 Ready' : 'Hot-Plug Ready'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Detected via Windows 10 DirectShow / MediaDevices
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            OpenCV-Darts Scorer Engine
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-emerald-400">
              {vision?.visionArmed ? 'ACTIVE' : 'PAUSED'}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {vision?.fps || 0} FPS
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {scorerStatus?.algorithm || '4-Point Homography + 3-Camera Triangulation'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ring Light Configuration
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-white">
              270° Open-Bottom
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-300">
              Bar Cleared
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Top mount ~11:30 (or ~12:30) · 125°/125°/110°
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Windows 10 USB Hubs
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-cyan-400">
              {vision?.resolutionMode || '720p'}
            </span>
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-black text-cyan-300">
              Auto-Fallback
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Automatically steps down to 480p if USB 2.0 hub saturates
          </p>
        </div>
      </section>

      {/* SECTION 1: 3-CAMERA SLOTS (Cam 1, Cam 2, Cam 3) PREVIEWS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-white sm:text-xl">
              3 Dartboard Camera Slots (Assigned Previews &amp; Calibration Overlays)
            </h3>
            <p className="text-xs text-slate-400 sm:text-sm">
              Verify each camera slot&apos;s angle, position relative to the 12:00 bar and open bottom, and ring overlay
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SlotPreviewCard
            slotKey="cam1"
            camera={cam1}
            diagnostic={diagMap.cam1}
            persistentStream={vision?.cameraStreams?.cam1}
            runtimeStatus={vision?.cameraStatusMap?.cam1}
            windowsVideoDevices={windowsVideoDevices}
            onAssignDevice={handleAssignToSlot}
          />
          <SlotPreviewCard
            slotKey="cam2"
            camera={cam2}
            diagnostic={diagMap.cam2}
            persistentStream={vision?.cameraStreams?.cam2}
            runtimeStatus={vision?.cameraStatusMap?.cam2}
            windowsVideoDevices={windowsVideoDevices}
            onAssignDevice={handleAssignToSlot}
          />
          <SlotPreviewCard
            slotKey="cam3"
            camera={cam3}
            diagnostic={diagMap.cam3}
            persistentStream={vision?.cameraStreams?.cam3}
            runtimeStatus={vision?.cameraStatusMap?.cam3}
            windowsVideoDevices={windowsVideoDevices}
            onAssignDevice={handleAssignToSlot}
          />
        </div>
      </section>

      {/* SECTION 2: RAW DETECTED PHYSICAL USB WEBCAMS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white sm:text-xl">
              Connected Physical USB Cameras ({windowsVideoDevices.length} Detected)
            </h3>
            <p className="text-xs text-slate-400 sm:text-sm">
              Live feeds direct from each physical USB webcam. Use &ldquo;Save to Slot&rdquo; to permanently bind any webcam to Cam 1, 2, or 3.
            </p>
          </div>

          <button
            type="button"
            onClick={scanDevices}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
            <span>Refresh Device List</span>
          </button>
        </div>

        {windowsVideoDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
            <Camera className="h-12 w-12 text-slate-600 mb-3" />
            <h4 className="text-base font-bold text-slate-300">
              No Physical USB Webcams Detected Yet
            </h4>
            <p className="mt-1 max-w-md text-xs text-slate-400 sm:text-sm">
              Plug your 3 OV9732 USB cameras into your Windows 10 PC USB ports, ensure Windows Camera Privacy settings allow access, and click &ldquo;Re-scan USB Cameras&rdquo; above.
            </p>
            <button
              type="button"
              onClick={scanDevices}
              className="mt-4 rounded-xl bg-purple-600 px-5 py-2 text-sm font-black text-white transition hover:bg-purple-500"
            >
              Request Camera Access &amp; Scan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {windowsVideoDevices.map((dev, idx) => {
              const matchedSlot = ['cam1', 'cam2', 'cam3'].find(
                (k) =>
                  vision?.cameraStreams?.[k] &&
                  vision.cameraStreams[k]
                    .getVideoTracks?.()[0]
                    ?.getSettings?.().deviceId === dev.deviceId
              );
              return (
                <PhysicalWebcamCard
                  key={dev.deviceId || idx}
                  device={dev}
                  index={idx}
                  existingStream={matchedSlot ? vision.cameraStreams[matchedSlot] : null}
                  onAssignToSlot={handleAssignToSlot}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
