import React from 'react';
import {
  Target,
  Camera,
  HelpCircle,
  Eye,
  RefreshCw,
  FlaskConical,
  Cpu,
  Lock,
  Unlock
} from 'lucide-react';

export default function TopNavBar({
  activeTab,
  onSelectTab,
  scorerStatus,
  activeUsbCamerasCount = 0,
  visionArmed = true,
  onToggleVisionArmed,
  onCaptureEmptyBoard,
  simulateMode,
  onToggleSimulateMode,
  onOpenHelpWizard,
  calibratedCamerasCount,
  isDevUnlocked,
  onOpenDevPinModal
}) {
  const isEngineReady = scorerStatus?.ready !== false;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        {/* Brand & Hardware Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <Target className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                FLIGHT NIGHTS <span className="text-emerald-400">DARTS</span>
              </h1>
              <span className="hidden rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-300 sm:inline-block">
                Windows 10 PC · 3x OV9732
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 sm:text-sm">
              OpenCV-Darts 3-Camera Homography &amp; Triangulation Scorer
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => onSelectTab('live')}
            className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-bold transition-all sm:text-base ${
              activeTab === 'live'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Target className="h-5 w-5" />
            <span>Live Score Display</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('calibration')}
            className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-bold transition-all sm:text-base ${
              activeTab === 'calibration'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Camera className="h-5 w-5" />
            <span>Camera Calibration</span>
            <span
              className={`ml-0.5 rounded-full px-2 py-0.5 text-xs font-extrabold ${
                activeTab === 'calibration'
                  ? 'bg-slate-950/25 text-slate-950'
                  : calibratedCamerasCount === 3
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {calibratedCamerasCount}/3
            </span>
          </button>

          {isDevUnlocked && (
            <button
              type="button"
              onClick={() => onSelectTab('debug')}
              className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-bold transition-all sm:text-base ${
                activeTab === 'debug'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-purple-300 hover:bg-slate-800 hover:text-purple-200'
              }`}
            >
              <Cpu className="h-5 w-5 text-purple-300" />
              <span>Dev Debug Screen</span>
              <span className="rounded bg-purple-950 px-1.5 py-0.5 text-[10px] font-black uppercase text-purple-200">
                0161
              </span>
            </button>
          )}
        </nav>

        {/* Right Status Badges & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Dev Mode Button */}
          <button
            type="button"
            onClick={isDevUnlocked ? () => onSelectTab('debug') : onOpenDevPinModal}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
              activeTab === 'debug'
                ? 'border-purple-400 bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : isDevUnlocked
                ? 'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-purple-500/40 hover:text-purple-300'
            }`}
          >
            {isDevUnlocked ? (
              <Unlock className="h-4 w-4 text-purple-400" />
            ) : (
              <Lock className="h-4 w-4 text-slate-400" />
            )}
            <span>Dev Button</span>
            <span className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-400">
              PIN 0161
            </span>
          </button>

          {/* OpenCV-Darts Vision Scorer Status Indicator */}
          <div
            title="Built-in OpenCV-Darts 3-Camera Homography & Triangulation Scorer (Windows 10 Native)"
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-bold sm:text-sm ${
              isEngineReady && visionArmed
                ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                : 'border-amber-500/40 bg-amber-950/50 text-amber-300'
            }`}
          >
            <span className="relative flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isEngineReady && visionArmed ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${
                  isEngineReady && visionArmed ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>

            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-400" />
              <span>
                OpenCV-Darts Scorer:{' '}
                {visionArmed
                  ? activeUsbCamerasCount > 0
                    ? `Active (${activeUsbCamerasCount}/3 USB Cams)`
                    : 'Ready (Plug USB Cams)'
                  : 'Paused'}
              </span>
              <button
                type="button"
                onClick={onCaptureEmptyBoard}
                title="Capture empty board reference frame across all cameras"
                className="ml-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 p-1 text-emerald-200 transition hover:bg-emerald-500/30"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Toggleable Out-of-the-Box Simulate Dart / Test Mode */}
          <button
            type="button"
            onClick={onToggleSimulateMode}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
              simulateMode
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-sm shadow-cyan-950'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            <span>Test Controls: {simulateMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Prominent Always-Visible Help / Setup Guide Button */}
          <button
            type="button"
            onClick={onOpenHelpWizard}
            className="flex items-center gap-2 rounded-xl border-2 border-indigo-400/60 bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95 sm:text-base"
          >
            <HelpCircle className="h-5 w-5" />
            <span>Help / Setup Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
}
