import React, { useState } from 'react';
import {
  X,
  Sun,
  Monitor,
  Camera,
  Eye,
  Target,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Sparkles
} from 'lucide-react';

const WIZARD_STEPS = [
  {
    step: 1,
    title: 'Step 1: Hardware & Lighting',
    subtitle: '270° Open-Bottom Ring Light & 3x OV9732 Camera Mounting',
    icon: Sun
  },
  {
    step: 2,
    title: 'Step 2: Windows 10 PC Connections',
    subtitle: 'USB 3.0 Root Hub Balancing, Power Settings & TV HDMI',
    icon: Monitor
  },
  {
    step: 3,
    title: 'Step 3: Verify Camera Feeds',
    subtitle: 'Confirm Windows 10 DirectShow Detection & Focus',
    icon: Camera
  },
  {
    step: 4,
    title: 'Step 4: OpenCV-Darts Vision Scorer',
    subtitle: 'Built-In 3-Camera Homography & Triangulation Engine',
    icon: Eye
  },
  {
    step: 5,
    title: 'Step 5: Calibrate & Throw Test Darts',
    subtitle: '4-Point Alignment & Live Score Verification',
    icon: Target
  }
];

export default function SetupWizardModal({
  isOpen,
  onClose,
  scorerStatus,
  activeUsbCamerasCount = 0,
  cameraDiagnostics,
  onTestCameras,
  onSwitchToCalibration,
  onSwitchToLiveAndTestDart
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [testingCameras, setTestingCameras] = useState(false);

  if (!isOpen) return null;

  const handleRunCameraTest = async () => {
    setTestingCameras(true);
    try {
      await onTestCameras();
    } finally {
      setTimeout(() => setTestingCameras(false), 350);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                Flight Nights Setup &amp; Calibration Guide (Windows 10 PC)
              </h2>
              <p className="text-xs font-medium text-slate-400 sm:text-sm">
                Step-by-step physical hardware, Windows 10 USB camera setup, and OpenCV-Darts triangulation walkthrough
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 5-Step Progress Stepper Bar */}
        <div className="grid grid-cols-5 gap-1.5 border-b border-slate-800 bg-slate-950/60 px-6 py-3">
          {WIZARD_STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                  isActive
                    ? 'border-indigo-400 bg-indigo-600/20 text-white shadow-sm'
                    : isDone
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-black uppercase">
                    Step {s.step}
                  </span>
                  <Icon className="h-4 w-4 shrink-0" />
                </div>
                <span className="mt-1 line-clamp-1 text-xs font-bold">
                  {s.title.replace(/^Step \d:\s*/, '')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Step Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: HARDWARE & LIGHTING */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
                <Sun className="mt-1 h-7 w-7 shrink-0 text-amber-400" />
                <div>
                  <h3 className="text-lg font-black text-white">
                    1. 270° Open-Bottom LED Light Ring &amp; 12:00 Bar Clearance
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    Your <strong>270° open-bottom ring light</strong> (open at the bottom from ~4:30 to ~7:30, with a mounting bar at <strong>12 o&apos;clock</strong>) provides shadow-free lighting across the board. Mount Camera 1 slightly left toward the <strong>5</strong> (<strong>11:30</strong>) or right toward the <strong>1</strong> (<strong>12:30</strong>) to clear the top bar, and place Cameras 2 &amp; 3 along the lower legs of the ring for near-120° triangulation (125° / 125° / 110°).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-300">
                    CAMERA 1 · 11:30 (OR 12:30)
                  </span>
                  <h4 className="mt-2 text-base font-extrabold text-white">
                    Top Mount — Left of Bar (~345° / 5)
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Mount the first <strong>OV9732 USB camera</strong> just left of the 12 o&apos;clock bar toward the <strong>5</strong> (~11:30 / 345°). Prefer the right side? Select <strong>Option B (12:30 / toward 1)</strong> in the Calibration tab instead.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-black text-sky-300">
                    CAMERA 2 · 3:40 (OR 4:10)
                  </span>
                  <h4 className="mt-2 text-base font-extrabold text-white">
                    Lower-Right Ring Arm (~110° / 10)
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Mount the second <strong>OV9732 USB camera</strong> on the lower-right section of the ring over the <strong>10</strong> (~3:40 / 110°, or over <strong>15</strong> at ~4:10 if using Option B) — safely above the open bottom edge.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-black text-amber-300">
                    CAMERA 3 · 7:50 (OR 8:20)
                  </span>
                  <h4 className="mt-2 text-base font-extrabold text-white">
                    Lower-Left Ring Arm (~235° / 16)
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Mount the third <strong>OV9732 USB camera</strong> on the lower-left section of the ring over the <strong>16</strong> (~7:50 / 235°, or over <strong>8</strong> at ~8:20 if using Option B). Aim all 3 lenses at the bullseye with the full Double ring visible.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: WINDOWS 10 PC CONNECTIONS */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="text-lg font-black text-white">
                  Windows 10 PC Wiring &amp; USB Bandwidth Checklist
                </h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <div>
                      <strong className="text-white">Spread Cameras Across USB 3.0 / 2.0 Root Hubs:</strong> Plug all 3 OV9732 USB cameras directly into your Windows 10 PC motherboard USB ports (use the blue <strong>USB 3.0 SuperSpeed ports</strong> and separate front/rear ports rather than a single unpowered USB 2.0 hub). If all 3 cameras share one hub, the built-in vision engine automatically offers a <strong>480p Safe Mode</strong> so all 3 streams run concurrently without drops.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <div>
                      <strong className="text-white">Disable Windows 10 USB Selective Suspend:</strong> In Windows 10 <em>Control Panel → Power Options → Change plan settings → Change advanced power settings → USB settings</em>, set <strong>USB selective suspend setting</strong> to <strong>Disabled</strong> so Windows never puts the cameras to sleep mid-match.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <div>
                      <strong className="text-white">TV Display via HDMI / DisplayPort:</strong> Connect your nearby TV display to your Windows 10 PC via HDMI or DisplayPort and open Edge or Chrome in fullscreen mode (<kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">F11</kbd>) at <code className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-300">http://localhost:5173</code>.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 3: VERIFY CAMERA FEEDS ON WINDOWS 10 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div>
                  <h3 className="text-lg font-black text-white">
                    Verify Windows 10 Camera Detection (DirectShow / UVC)
                  </h3>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    Confirm all 3 OV9732 cameras appear under <strong>Device Manager → Cameras</strong> and that Windows 10 Camera Privacy permissions are enabled.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunCameraTest}
                  disabled={testingCameras}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  <RefreshCw className={`h-4 w-4 ${testingCameras ? 'animate-spin' : ''}`} />
                  <span>{testingCameras ? 'Scanning...' : 'Scan & Test Cameras'}</span>
                </button>
              </div>

              {/* Live Camera Diagnostic Results */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(cameraDiagnostics?.cameras || []).map((cam) => (
                  <div
                    key={cam.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/90 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{cam.name}</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-emerald-300">
                        {cam.devicePath}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                      {cam.deviceExists || cam.hasStream ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{cam.statusLabel}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-300">
                          <AlertCircle className="h-4 w-4" />
                          <span>{cam.statusLabel}</span>
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Recommended Port: {cam.usbBusTip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: BUILT-IN OPENCV-DARTS VISION SCORER */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">
                      Built-In OpenCV-Darts 3-Camera Triangulation Scorer
                    </h3>
                    <p className="text-xs text-slate-400 sm:text-sm">
                      Runs natively inside the Windows 10 app — no external Linux daemon, no WSL, and no usbipd required!
                    </p>
                  </div>

                  <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300">
                    {scorerStatus?.engineName || 'OpenCV-Darts Scorer'}: Ready ({activeUsbCamerasCount}/3 Live USB)
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-sm text-slate-300">
                  <p>
                    1. <strong>Zero External Setup:</strong> As soon as you plug your 3 physical USB cameras into Windows 10, the browser&apos;s persistent DirectShow camera manager opens all 3 feeds and keeps them alive across all tabs.
                  </p>
                  <p>
                    2. <strong>Background Subtraction &amp; PCA Tip Extraction:</strong> The vision loop captures an empty-board reference frame, detects when a thrown dart lands and stops vibrating, isolates the new dart contour, and locates the exact metal tip using 3D perspective geometry.
                  </p>
                  <p>
                    3. <strong>Multi-Camera Ray Triangulation &amp; Auto-Clear:</strong> Detections from Camera 1, Camera 2, and Camera 3 are projected through each camera&apos;s 4-point inverse homography (<code className="text-emerald-300">H⁻¹</code>) and triangulated to compute the exact board coordinate <code className="text-emerald-300">(x, y)</code> and WDF score. When you pull your 3 darts out of the board, it automatically advances to the next turn!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: CALIBRATE & THROW TEST DARTS */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="text-lg font-black text-white">
                  Calibrate All 3 Cameras &amp; Throw Verification Darts
                </h3>
                <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-sm text-slate-300">
                  <li>
                    Open the <strong>Camera Calibration</strong> tab, pick your top camera side (<strong>Left of Bar toward 5</strong> or <strong>Right of Bar toward 1</strong>), and click the <strong>4 Double-ring intersection points</strong> on each live camera feed:
                    <span className="ml-1 font-mono text-xs font-bold text-emerald-300">
                      20/1 (Top) → 6/10 (Right) → 3/19 (Bottom) → 11/14 (Left)
                    </span>.
                  </li>
                  <li>
                    Verify that the live visual dartboard ring overlay aligns cleanly with the physical wires on all 3 feeds, then click <strong>Save All Cameras</strong> (persists to <code className="text-emerald-300">config/calibration.json</code> and captures the clean empty-board reference).
                  </li>
                  <li>
                    Switch to the <strong>Live Score Display</strong> and throw test darts at <strong className="text-white">Bullseye (50), T20 (Top), T19 (Bottom), D11 (Left), and D6 (Right)</strong> to verify 360° triangulation accuracy.
                  </li>
                </ol>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchToCalibration();
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Open 3-Camera Calibration</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSwitchToLiveAndTestDart({ segment: 20, multiplier: 3 });
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/25"
                  >
                    <Target className="h-4 w-4" />
                    <span>Run 3-Camera T20 Triangulation Self-Test</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-6 py-4">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous Step</span>
          </button>

          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Step {currentStep} of {WIZARD_STEPS.length}
          </span>

          {currentStep < WIZARD_STEPS.length ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.min(WIZARD_STEPS.length, s + 1))}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-black text-white transition hover:bg-indigo-500"
            >
              <span>Next Step</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Finish Setup</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
