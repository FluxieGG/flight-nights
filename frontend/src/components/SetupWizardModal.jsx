import React, { useState } from 'react';
import {
  X,
  Sun,
  Monitor,
  Camera,
  Wifi,
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
    subtitle: '360° LED Light Ring & 3x OV9732 Camera Mounting',
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
    subtitle: 'Confirm Windows 10 Device Manager & Camera Focus',
    icon: Camera
  },
  {
    step: 4,
    title: 'Step 4: Start OpenDartboard',
    subtitle: 'Verify Daemon on ws://localhost:13520',
    icon: Wifi
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
  openDartboardStatus,
  onReconnectOpenDartboard,
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
                Smart Darts Setup &amp; Calibration Guide (Windows 10 PC)
              </h2>
              <p className="text-xs font-medium text-slate-400 sm:text-sm">
                Step-by-step physical hardware, Windows 10 USB camera setup, and OpenDartboard walkthrough
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
                    1. Mount the 360° LED Light Ring (Shadow Elimination)
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    Mount a <strong>360° LED dartboard light ring</strong> (such as the{' '}
                    <em>Target Corona Vision</em>, <em>Winmau Plasma</em>, or <em>Mission Torus 270/360</em>) securely around your bristle dartboard. Even, shadow-free illumination ensures the vision engine detects only the true steel dart tip and barrel without false shadow triggers.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-300">
                    CAMERA 1 · 10 O&apos;CLOCK
                  </span>
                  <h4 className="mt-2 text-base font-extrabold text-white">
                    Top-Left Mount (~300°)
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Mount the first <strong>OV9732 USB camera</strong> at roughly <strong>10 o&apos;clock</strong> on the light ring arm, angled toward the bullseye so the entire outer Double ring is visible with a small margin.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-black text-sky-300">
                    CAMERA 2 · 2 O&apos;CLOCK
                  </span>
                  <h4 className="mt-2 text-base font-extrabold text-white">
                    Top-Right Mount (~60°)
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Mount the second <strong>OV9732 USB camera</strong> at roughly <strong>2 o&apos;clock</strong>. Having 120° separation between cameras prevents one dart barrel from occluding another across all three views.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-black text-amber-300">
                    CAMERA 3 · 6 O&apos;CLOCK
                  </span>
                  <h4 className="mt-2 text-base font-extrabold text-white">
                    Bottom Mount (~180°)
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Mount the third <strong>OV9732 USB camera</strong> at roughly <strong>6 o&apos;clock</strong> looking upward across the board face. Ensure all 3 camera lenses are twisted into crisp focus.
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
                      <strong className="text-white">Spread Cameras Across USB 3.0 / 2.0 Root Hubs:</strong> Plug all 3 OV9732 USB cameras directly into your Windows 10 PC motherboard USB ports (use the blue <strong>USB 3.0 SuperSpeed ports</strong> and separate front/rear ports rather than a single unpowered USB 2.0 hub) so all three 720p streams run simultaneously without bandwidth drops.
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
                  <span>{testingCameras ? 'Scanning...' : 'Test Cameras'}</span>
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

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                <div className="mb-1.5 font-bold uppercase text-slate-400">
                  Windows 10 Camera Verification Checklist:
                </div>
                <ul className="list-disc space-y-1 pl-4 text-slate-300">
                  <li>
                    Press <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono">Win + X</kbd> → <strong>Device Manager</strong> → expand <strong>Cameras</strong> (or <strong>Imaging devices</strong>) to verify all 3 USB cameras are listed without yellow warning icons.
                  </li>
                  <li>
                    Open <strong>Windows Settings → Privacy → Camera</strong> and ensure <em>&ldquo;Allow apps to access your camera&rdquo;</em> and <em>&ldquo;Allow desktop apps to access your camera&rdquo;</em> are turned <strong>On</strong>.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 4: START OPENDARTBOARD */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">
                      Start &amp; Connect OpenDartboard Vision Engine on Windows 10
                    </h3>
                    <p className="text-xs text-slate-400 sm:text-sm">
                      This app connects automatically to <code className="text-emerald-300">{openDartboardStatus?.url || 'ws://localhost:13520'}</code> and retries every 3 seconds.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-xl border px-3 py-1.5 text-xs font-black ${
                        openDartboardStatus?.connected
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {openDartboardStatus?.connected
                        ? 'OpenDartboard: Connected'
                        : 'Disconnected / Reconnecting...'}
                    </span>

                    <button
                      type="button"
                      onClick={onReconnectOpenDartboard}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Test Reconnect</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <p>
                    1. Launch the <strong>OpenDartboard</strong> service on your Windows 10 PC so its WebSocket server listens on port <code className="text-emerald-300">13520</code> (configurable in <code className="text-emerald-300">.env</code> via <code className="text-emerald-300">OPENDARTBOARD_WS_URL</code>). If Windows Defender Firewall prompts you, allow access on Private networks.
                  </p>
                  <p>
                    2. Watch the status badge in the top navigation bar turn green (<strong className="text-emerald-400">OpenDartboard: Connected</strong>).
                  </p>
                  <p>
                    3. Incoming JSON dart payloads (<code className="text-emerald-300">{`{"segment": 20, "multiplier": 3, "x": 0.0, "y": -0.6}`}</code>) are immediately scored and logged.
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
                    Open the <strong>Camera Calibration</strong> tab and click the <strong>4 Double-ring intersection points</strong> on each of the 3 camera feeds:
                    <span className="ml-1 font-mono text-xs font-bold text-emerald-300">
                      20/1 (Top) → 6/10 (Right) → 3/19 (Bottom) → 11/14 (Left)
                    </span>.
                  </li>
                  <li>
                    Verify that the live visual dartboard ring overlay aligns cleanly with the physical wires on all 3 feeds, then click <strong>Save Calibration</strong> (persists to <code className="text-emerald-300">config/calibration.json</code>).
                  </li>
                  <li>
                    Switch to the <strong>Live Score Display</strong> and throw 5 test darts in order:
                    <strong className="text-white"> Bullseye (50), 20 (Top), 3 (Bottom), 11 (Left), and 6 (Right)</strong> to verify 360° triangulation accuracy.
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
                      onSwitchToLiveAndTestDart({ segment: 25, multiplier: 2 });
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/25"
                  >
                    <Target className="h-4 w-4" />
                    <span>Simulate Bullseye Test Throw</span>
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
