import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  FastForward,
  Trash2,
  Zap,
  Activity,
  History,
  Code2,
  Shuffle,
  CheckCircle2,
  Camera,
  Eye,
  RefreshCw,
  Lock,
  Unlock,
  Sliders,
  Sparkles
} from 'lucide-react';
import InteractiveDartboard from './InteractiveDartboard';
import { BOARD_SECTORS } from '../utils/dartboardMath';

const QUICK_TEST_DARTS = [
  { label: 'T20', desc: '60 pts', payload: { segment: 20, multiplier: 3 }, style: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' },
  { label: 'BULL', desc: '50 pts', payload: { segment: 25, multiplier: 2 }, style: 'border-rose-500/50 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' },
  { label: '25', desc: 'Outer Bull', payload: { segment: 25, multiplier: 1 }, style: 'border-green-500/50 bg-green-500/15 text-green-300 hover:bg-green-500/25' },
  { label: 'D16', desc: '32 pts', payload: { segment: 16, multiplier: 2 }, style: 'border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25' },
  { label: 'T19', desc: '57 pts', payload: { segment: 19, multiplier: 3 }, style: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' },
  { label: 'S20', desc: '20 pts', payload: { segment: 20, multiplier: 1 }, style: 'border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700' },
  { label: 'D20', desc: '40 pts', payload: { segment: 20, multiplier: 2 }, style: 'border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25' },
  { label: 'MISS', desc: '0 pts', payload: { segment: 0, multiplier: 0 }, style: 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' }
];

function MiniCameraVisionFeed({ slotKey, slotNumber, color, stream, status, cameraConfig }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5">
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        {stream && status?.active ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-[10px] font-bold text-slate-500">
            <Camera className="h-4 w-4 mb-0.5 text-slate-600" />
            <span>Standby</span>
          </div>
        )}
        {status?.lastTip && (
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-emerald-400 shadow"
            style={{
              left: `${status.lastTip.x * 100}%`,
              top: `${status.lastTip.y * 100}%`
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-black uppercase" style={{ color }}>
            Cam {slotNumber}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              status?.active
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {status?.active ? status.resolution || 'LIVE' : 'Standby'}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-400">
          {cameraConfig?.position || `Mount #${slotNumber}`}
        </div>
        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
          <span>Diff: {status?.diffScore || 0}px</span>
          <span>{Array.isArray(cameraConfig?.points) && cameraConfig.points.length === 4 ? '4/4 Cal' : 'Uncal'}</span>
        </div>
      </div>
    </div>
  );
}

export default function LiveScoreView({
  turnNumber = 1,
  currentTurn = [],
  currentTurnTotal = 0,
  turnHistory = [],
  accuracyLog = [],
  highlightedDart = null,
  simulateMode = true,
  onSimulateDart,
  onUndoLastDart,
  onNextTurn,
  onClearAllLogs,
  onOpenDevPinModal,
  isDevUnlocked,
  vision,
  calibration,
  onSwitchToCalibration
}) {
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [showVisionControls, setShowVisionControls] = useState(false);

  const handleRandomDart = () => {
    const isBull = Math.random() < 0.1;
    if (isBull) {
      onSimulateDart({ segment: 25, multiplier: Math.random() < 0.5 ? 2 : 1 });
      return;
    }
    const randomSector = BOARD_SECTORS[Math.floor(Math.random() * BOARD_SECTORS.length)];
    const r = Math.random();
    const mult = r < 0.2 ? 3 : r < 0.4 ? 2 : 1;
    onSimulateDart({ segment: randomSector, multiplier: mult });
  };

  const VERIFICATION_TARGETS = [
    { label: 'Bullseye', payload: { segment: 25, multiplier: 2 } },
    { label: 'Top (T20)', payload: { segment: 20, multiplier: 3 } },
    { label: 'Bottom (T19)', payload: { segment: 19, multiplier: 3 } },
    { label: 'Left (D11)', payload: { segment: 11, multiplier: 2 } },
    { label: 'Right (D6)', payload: { segment: 6, multiplier: 2 } }
  ];

  const turnSummaryText =
    currentTurn.length > 0
      ? `${currentTurn.map((d) => d.label).join(' | ')} — Total: ${currentTurnTotal}`
      : 'Waiting for Dart 1...';

  const activeCameraCount = vision
    ? Object.values(vision.cameraStatusMap).filter((c) => c.active).length
    : 0;

  return (
    <div className="mx-auto max-w-[1800px] space-y-5 px-4 py-5 lg:px-6">
      {/* TOP SECTION: Current Turn Display (TV-Readable from ~8 Feet Away) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-emerald-500/20 px-3 py-1 text-sm font-black uppercase tracking-wider text-emerald-300">
              TURN #{turnNumber}
            </span>
            <h2 className="text-lg font-extrabold tracking-wide text-slate-200 sm:text-2xl">
              {turnSummaryText}
            </h2>
          </div>

          {/* Testing Controls: Capture Empty Board, Undo Last Dart, Next Turn / Clear & Dev Button */}
          <div className="flex flex-wrap items-center gap-3">
            {vision && (
              <button
                type="button"
                onClick={vision.captureEmptyBoardReference}
                title="Capture clean empty board reference frame across all connected USB cameras"
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-extrabold text-cyan-200 transition hover:bg-cyan-500/25 active:scale-95 sm:text-sm"
              >
                <RefreshCw className="h-4 w-4 text-cyan-400" />
                <span>Recalibrate Empty Board</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenDevPinModal}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition active:scale-95 sm:text-base ${
                isDevUnlocked
                  ? 'border-purple-400 bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-500'
                  : 'border-purple-500/40 bg-purple-500/15 text-purple-300 shadow-md shadow-purple-950/50 hover:bg-purple-500/25'
              }`}
            >
              {isDevUnlocked ? (
                <Unlock className="h-5 w-5 text-purple-200" />
              ) : (
                <Lock className="h-5 w-5 text-purple-400" />
              )}
              <span>Dev Debug</span>
              <span className="rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-xs font-bold text-purple-200">
                PIN 0161
              </span>
            </button>

            <button
              type="button"
              onClick={onUndoLastDart}
              disabled={currentTurn.length === 0 && turnHistory.length === 0}
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-extrabold text-amber-200 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            >
              <RotateCcw className="h-5 w-5" />
              <span>Undo Last Dart</span>
            </button>

            <button
              type="button"
              onClick={onNextTurn}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95 sm:text-base"
            >
              <FastForward className="h-5 w-5" />
              <span>Next Turn / Clear</span>
            </button>
          </div>
        </div>

        {/* 4 Large TV-Friendly Cards: DART 1, DART 2, DART 3, TURN TOTAL */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2].map((slotIdx) => {
            const dart = currentTurn[slotIdx];
            const isJustThrown =
              dart && highlightedDart && highlightedDart.id === dart.id;

            let badgeColor = 'border-slate-800 bg-slate-950/70 text-slate-500';
            if (dart) {
              if (dart.segment === 0) {
                badgeColor = 'border-rose-500/50 bg-rose-950/40 text-rose-300';
              } else if (dart.multiplier === 3 || (dart.segment === 25 && dart.multiplier === 2)) {
                badgeColor = 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300';
              } else if (dart.multiplier === 2) {
                badgeColor = 'border-sky-500/60 bg-sky-950/50 text-sky-300';
              } else {
                badgeColor = 'border-slate-700 bg-slate-900 text-white';
              }
            }

            return (
              <div
                key={slotIdx}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-5 transition-all duration-300 ${badgeColor} ${
                  isJustThrown ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">
                    DART {slotIdx + 1}
                  </span>
                  {dart && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                        dart.source === 'vision' || dart.source === 'vision-test'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-cyan-500/20 text-cyan-300'
                      }`}
                    >
                      {dart.source === 'vision'
                        ? `OpenCV (${dart.camerasUsed?.length || 3} Cam)`
                        : dart.source === 'vision-test'
                        ? '3-Cam CV Test'
                        : 'Simulated'}
                    </span>
                  )}
                </div>

                {dart ? (
                  <div className="my-3 flex items-baseline justify-between">
                    <span className="font-mono text-5xl font-black tracking-tight text-white sm:text-6xl">
                      {dart.label}
                    </span>
                    <div className="text-right">
                      <div className="font-mono text-2xl font-extrabold text-emerald-400 sm:text-3xl">
                        +{dart.score}
                      </div>
                      <div className="text-xs font-semibold text-slate-400">
                        {dart.ringName}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="my-5 flex items-center justify-between text-slate-600">
                    <span className="font-mono text-4xl font-black sm:text-5xl">—</span>
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Ready
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
                  <span>
                    {dart
                      ? `Coords: (${dart.x}, ${dart.y})`
                      : 'Awaiting detection'}
                  </span>
                  {dart && (
                    <span className="font-mono">
                      {new Date(dart.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* JUMBO TURN TOTAL CARD */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-950 p-5 shadow-lg shadow-emerald-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-300 sm:text-sm">
                TURN TOTAL
              </span>
              {currentTurnTotal >= 100 && (
                <span className="animate-pulse rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black text-slate-950">
                  {currentTurnTotal === 180 ? '180 MAXIMUM!' : 'TON+ SCORE!'}
                </span>
              )}
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <span className="font-mono text-6xl font-black tracking-tighter text-emerald-400 sm:text-7xl">
                {currentTurnTotal}
              </span>
              <span className="text-sm font-bold uppercase tracking-wider text-slate-400">
                {currentTurn.length} / 3 Darts
              </span>
            </div>

            <div className="border-t border-emerald-800/50 pt-2 text-xs font-semibold text-emerald-200/80">
              {currentTurn.length === 3
                ? 'Turn complete — Pull darts from board or press Next Turn'
                : `${3 - currentTurn.length} dart${3 - currentTurn.length === 1 ? '' : 's'} remaining in turn`}
            </div>
          </div>
        </div>
      </section>

      {/* LIVE 3-CAMERA OPENCV-DARTS VISION MONITOR BAR */}
      {vision && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/85 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    OpenCV-Darts 3-Camera Vision Monitor
                  </h3>
                  <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                    {vision.visionStateLabel}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {activeCameraCount}/3 USB Cameras Active · {vision.fps} FPS
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time background subtraction, contour PCA tip extraction &amp; 3-camera homography triangulation
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => vision.scanWindowsCameras(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
              >
                <Camera className="h-3.5 w-3.5 text-cyan-400" />
                <span>Connect USB Cameras</span>
              </button>

              <button
                type="button"
                onClick={() => vision.setVisionArmed((v) => !v)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                  vision.visionArmed
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                    : 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                }`}
              >
                {vision.visionArmed ? 'Vision: ARMED' : 'Vision: PAUSED'}
              </button>

              <button
                type="button"
                onClick={() => setShowVisionControls((s) => !s)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
              >
                <Sliders className="h-3.5 w-3.5 text-emerald-400" />
                <span>Vision Settings</span>
              </button>
            </div>
          </div>

          {/* 3 Mini Live Camera Previews */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniCameraVisionFeed
              slotKey="cam1"
              slotNumber={1}
              color="#10b981"
              stream={vision.cameraStreams.cam1}
              status={vision.cameraStatusMap.cam1}
              cameraConfig={calibration?.cameras?.cam1}
            />
            <MiniCameraVisionFeed
              slotKey="cam2"
              slotNumber={2}
              color="#38bdf8"
              stream={vision.cameraStreams.cam2}
              status={vision.cameraStatusMap.cam2}
              cameraConfig={calibration?.cameras?.cam2}
            />
            <MiniCameraVisionFeed
              slotKey="cam3"
              slotNumber={3}
              color="#f59e0b"
              stream={vision.cameraStreams.cam3}
              status={vision.cameraStatusMap.cam3}
              cameraConfig={calibration?.cameras?.cam3}
            />
          </div>

          {showVisionControls && (
            <div className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs sm:grid-cols-3">
              <div>
                <div className="flex items-center justify-between font-bold text-slate-300">
                  <span>Detection Sensitivity Threshold:</span>
                  <span className="font-mono text-emerald-300">{vision.sensitivity}</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="55"
                  value={vision.sensitivity}
                  onChange={(e) => vision.setSensitivity(Number(e.target.value))}
                  className="mt-1.5 w-full accent-emerald-400"
                />
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Lower = more sensitive to thin dart tips; Higher = ignores ambient light flicker.
                </p>
              </div>

              <div className="flex flex-col justify-between">
                <span className="font-bold text-slate-300">Auto-Clear When Darts Pulled:</span>
                <label className="mt-1.5 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={vision.autoClearOnPull}
                    onChange={(e) => vision.setAutoClearOnPull(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  <span className="text-slate-200 font-semibold">
                    Automatically advance turn when board returns to empty state
                  </span>
                </label>
              </div>

              <div className="flex flex-col justify-between">
                <span className="font-bold text-slate-300">Windows USB Hub Bandwidth Mode:</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => vision.setResolutionMode('720p')}
                    className={`rounded-lg border px-3 py-1 font-bold ${
                      vision.resolutionMode === '720p'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    720p HD (USB 3.0)
                  </button>
                  <button
                    type="button"
                    onClick={() => vision.setResolutionMode('480p')}
                    className={`rounded-lg border px-3 py-1 font-bold ${
                      vision.resolutionMode === '480p'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    480p Safe Mode (Single USB Hub)
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* OUT-OF-THE-BOX SIMULATE DART / 3-CAMERA CV PIPELINE TEST PANEL */}
      {simulateMode && (
        <section className="rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Zap className="h-5 w-5 text-cyan-400" />
              <span className="text-sm font-extrabold uppercase tracking-wider text-cyan-300">
                Vision Pipeline Self-Test &amp; Manual Simulator
              </span>
              <span className="hidden text-xs text-slate-400 md:inline">
                (Test real 3-camera homography &amp; triangulation math or simulate throws)
              </span>
            </div>

            {/* 3-Camera Synthetic CV Pipeline Verification Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 flex items-center gap-1 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>3-Cam Vision Triangulation Test:</span>
              </span>
              {VERIFICATION_TARGETS.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() =>
                    vision
                      ? vision.runSyntheticVisionTest(t.payload.segment, t.payload.multiplier)
                      : onSimulateDart(t.payload)
                  }
                  className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/25"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {QUICK_TEST_DARTS.map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => onSimulateDart(btn.payload)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition active:scale-95 sm:text-base ${btn.style}`}
              >
                <span>{btn.label}</span>
                <span className="rounded bg-slate-950/50 px-1.5 py-0.5 font-mono text-xs font-semibold opacity-90">
                  {btn.desc}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={handleRandomDart}
              className="flex items-center gap-2 rounded-xl border border-purple-500/50 bg-purple-500/15 px-4 py-2.5 text-sm font-black text-purple-300 transition hover:bg-purple-500/25 active:scale-95 sm:text-base"
            >
              <Shuffle className="h-4 w-4" />
              <span>Random Throw</span>
            </button>
          </div>
        </section>
      )}

      {/* MAIN LOWER GRID: Interactive SVG Dartboard (Left/Center) + Accuracy Log & Recent Turns (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Interactive SVG Dartboard Panel (5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-xl lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
                Interactive SVG Dartboard
              </h3>
              <p className="text-xs text-slate-400">
                Pulses triangulated segment in real time &amp; plots current turn markers
              </p>
            </div>
            {highlightedDart && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-sm font-black text-emerald-300">
                <span>Last Hit: {highlightedDart.label}</span>
                <span className="font-mono text-xs">({highlightedDart.score})</span>
              </div>
            )}
          </div>

          <div className="my-auto py-2">
            <InteractiveDartboard
              currentTurn={currentTurn}
              highlightedDart={highlightedDart}
              simulateMode={simulateMode}
              onSimulateThrow={onSimulateDart}
            />
          </div>

          {/* Compact Recent Turns History Bar inside Board Card */}
          <div className="mt-4 border-t border-slate-800 pt-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <div className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-slate-400" />
                <span>Recent Completed Turns</span>
              </div>
              <span>{turnHistory.length} turns logged</span>
            </div>

            {turnHistory.length === 0 ? (
              <p className="text-xs text-slate-500">
                Completed 3-dart turns will appear here when you pull your darts, throw a 4th dart, or click &ldquo;Next Turn / Clear&rdquo;.
              </p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {turnHistory.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-slate-400">#{t.turnNumber}</span>
                    <span className="font-mono font-bold text-slate-200">
                      {t.darts.map((d) => d.label).join(' · ')}
                    </span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono font-black text-emerald-300">
                      {t.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accuracy Log Panel — Last 20 Detected Darts with Timestamps & Raw Payloads (7 cols) */}
        <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/75 p-5 shadow-xl lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="text-base font-extrabold uppercase tracking-wider text-white sm:text-lg">
                  Detection Accuracy Log (Last 20 Darts)
                </h3>
                <p className="text-xs text-slate-400">
                  Verify OpenCV-Darts segment, multiplier, triangulated coordinates, confidence, and raw JSON payloads
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold text-slate-300">
                {accuracyLog.length} / 20 Logged
              </span>
              {accuracyLog.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllLogs}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Reset Session</span>
                </button>
              )}
            </div>
          </div>

          {accuracyLog.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-base font-bold text-slate-300">
                No Darts Detected Yet
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-400 sm:text-sm">
                Throw a dart in front of your calibrated USB cameras, run a 3-Cam Vision Triangulation Test above, or click any segment on the interactive SVG dartboard.
              </p>
            </div>
          ) : (
            <div className="max-h-[540px] flex-1 space-y-2.5 overflow-y-auto pr-1">
              {accuracyLog.map((item, idx) => {
                const isExpanded = expandedLogId === item.id;
                const rawJsonString = JSON.stringify(item.raw);

                return (
                  <div
                    key={item.id || idx}
                    className={`rounded-xl border transition ${
                      idx === 0
                        ? 'border-emerald-500/50 bg-emerald-950/20'
                        : 'border-slate-800 bg-slate-950/75 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Hit Badge */}
                        <span
                          className={`flex h-11 w-16 items-center justify-center rounded-xl font-mono text-xl font-black ${
                            item.segment === 0
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : item.multiplier === 3 || (item.segment === 25 && item.multiplier === 2)
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : item.multiplier === 2
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : 'bg-slate-800 text-white border border-slate-700'
                          }`}
                        >
                          {item.label}
                        </span>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-white sm:text-base">
                              {item.ringName}
                            </span>
                            <span className="font-mono text-sm font-black text-emerald-400">
                              +{item.score} pts
                            </span>
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                              Turn #{item.turnNumber} · Dart {item.dartIndex}
                            </span>
                            {item.method && item.method !== 'simulated' && (
                              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                                {item.method} ({Math.round((item.confidence || 0.95) * 100)}%)
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs text-slate-400">
                            <span>seg: {item.segment}</span>
                            <span>mult: {item.multiplier}</span>
                            <span>
                              xy: ({item.x}, {item.y})
                            </span>
                            <span
                              className={
                                item.source === 'vision' || item.source === 'vision-test'
                                  ? 'text-emerald-400'
                                  : 'text-cyan-400'
                              }
                            >
                              src: {item.source}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timestamp & Raw Payload Toggle */}
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLogId(isExpanded ? null : item.id)
                          }
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-300 transition hover:border-slate-500 hover:text-white"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          <span>Payload</span>
                        </button>
                      </div>
                    </div>

                    {/* Always show compact inline raw JSON payload + expandable full JSON */}
                    <div className="border-t border-slate-800/80 bg-slate-950/90 px-4 py-1.5 font-mono text-xs text-slate-400">
                      {isExpanded ? (
                        <pre className="overflow-x-auto whitespace-pre-wrap text-emerald-300">
                          {JSON.stringify(item.raw, null, 2)}
                        </pre>
                      ) : (
                        <div className="truncate">
                          <span className="text-slate-500">raw: </span>
                          <span className="text-slate-300">{rawJsonString}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
