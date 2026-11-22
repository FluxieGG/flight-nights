# AGENTS.md — Flight Nights (Smart Darts Vision Scorer)

This file is automatically loaded by Antigravity (AGY) at the start of every session. **Do NOT run broad exploratory directory scans or read unrelated files to understand the project.** Use the architecture map, contracts, and file index below to jump directly to the exact file you need to edit.

---

## 1. Project Snapshot & Environment Constraints

- **Platform:** Windows 10 PC (`win32`, PowerShell). **No Python, no Raspberry Pi, no Linux/WSL, no `usbipd`, and no external `OpenDartboard` daemon.**
- **Runtime:** Node.js + npm monorepo (`/backend` on port `3001`, `/frontend` Vite React app on port `5173`, proxying `/api` and `/socket.io` to `http://localhost:3001`).
- **Physical Hardware:**
  - **3x OV9732 720p USB UVC cameras** accessed natively on Windows 10 via DirectShow / MediaFoundation (`navigator.mediaDevices.getUserMedia`).
  - **270° Open-Bottom LED Ring Light:** Open gap at the bottom from `135°` to `225°` (~4:30 to ~7:30) where no camera can be mounted, plus a mounting bracket bar at `12 o'clock` (`354°` to `6°`).
  - **Two Built-In Ring Mount Presets:**
    - `ring270_left5` (Option A, default): `cam1` = `345°` (11:30 toward 5), `cam2` = `110°` (3:40 over 10), `cam3` = `235°` (7:50 over 16).
    - `ring270_right1` (Option B): `cam1` = `15°` (12:30 toward 1), `cam2` = `125°` (4:10 over 15), `cam3` = `250°` (8:20 over 8).
- **Vision Scorer Engine:** Built-in **OpenCV-Darts 4-Point Homography & 3-Camera Ray Triangulation Engine** split cleanly between the browser frame-differencing pipeline (`frontend/src/utils/visionEngine.js`) and the backend multi-camera triangulation scorer (`backend/src/opencvDartsScorer.js`).
- **Persistence:** Zero database. Session state lives in memory in `backend/src/server.js`; calibration points, ring layout, vision settings, and USB camera `deviceId`/`deviceLabel` assignments persist to `config/calibration.json`.

---

## 2. Exact File Map & Module Responsibilities

### Root Files
- `package.json` — Root scripts: `npm run setup`, `npm test` (runs `backend/src/test-smoke.js`), `npm run build` (runs Vite build in `frontend`), `npm run start:backend`, `npm run start:frontend`.
- `setup.bat` — Copies `.env.example` to `.env` if missing and installs `backend` and `frontend` npm dependencies.
- `start.bat` — Starts the backend (`http://localhost:3001`) in a child window and launches the Vite dev server (`http://localhost:5173`).
- `.env` / `.env.example` — Configures `PORT=3001`, `CAMERA_1_DEVICE`..`CAMERA_3_DEVICE`, and optional `CAMERA_1_STREAM_URL`..`CAMERA_3_STREAM_URL`.
- `config/calibration.json` — Saved JSON containing `ringLayout`, `visionSettings`, `boardReferencePoints`, and `cameras` (`cam1`, `cam2`, `cam3` with `mountAngleDeg`, `deviceId`, `deviceLabel`, `points` [4 normalized `{x, y, label}` points]).

### Backend (`backend/src/`)
- `backend/src/server.js` — Express + Socket.IO server (`PORT=3001`). Holds `sessionState` (`turnNumber`, `currentTurn` [max 3 darts], `turnHistory` [max 15], `accuracyLog` [max 20], `lastDetectedDart`), `calibrationState`, and `scorerEngine` (`OpenCVDartsScorer`). Exports `{ app, server, scorerEngine, startServer }`.
- `backend/src/opencvDartsScorer.js` — Core mathematical scoring engine:
  - `buildForwardHomography(imagePoints)` ($H$: canonical board $(bx, by) \to$ camera $(u, v)$) & `buildInverseHomography(imagePoints)` ($H^{-1}$: camera $(u, v) \to$ canonical board $(bx, by)$) using an 8x8 Gaussian elimination solver.
  - `scoreFromBoardCoordinates(x, y, radii)` — Converts canonical board $(x, y)$ (`1.0` = outer Double ring) to polar $(r, \theta)$ and returns `{ segment, multiplier, score, label, ringName, x, y, radius, angleDeg }`.
  - `triangulateMultiCameraDetections(detections, calibration)` — Projects 1–3 per-camera detections through each camera's $H_i^{-1}$, builds epipolar sightlines from each camera's ring mount angle, performs 3-camera outlier down-weighting, blends homography tip consensus (70%) with pairwise ray intersection (30%), and scores the coordinate.
  - `OpenCVDartsScorer` class — Manages engine telemetry and `scoreDetection(payload, calibration)`.
- `backend/src/dartParser.js` — `parseDartPayload(rawPayload, source)` normalizes shorthand (`"T20"`, `"BULL"`, `"D16"`, `"MISS"`), structured `{ segment, multiplier, x, y }`, or coordinate-only `{ x, y }` payloads into canonical dart objects.
- `backend/src/calibrationStore.js` — `loadCalibration()`, `saveCalibration(newConfig)`, `saveSingleCamera(cameraId, cameraData)`, `resetCalibrationPoints(cameraId, preset, layoutId)`, `computePerspectivePresetPoints(mountAngleDeg)`. Keeps an in-memory cache (`memoryCalibrationCache`) backed by `config/calibration.json`.
- `backend/src/cameraManager.js` — `inspectCameras(calibration)` & `computeTriangulationDiagnostics(angles)` verify camera slot mappings and check that all 3 camera mount angles clear the 12:00 bar (`354°–6°`) and 270° open bottom (`135°–225°`) with `95°–145°` angular separation.
- `backend/src/test-smoke.js` — Automated Node `assert` test suite covering `dartParser`, `calibrationStore`, `cameraManager`, `opencvDartsScorer` homography round-trips & 3-camera triangulation, and Express/Socket.IO endpoints.

### Frontend (`frontend/src/`)
- `frontend/src/App.jsx` — Top-level state container, Socket.IO client connection, and host of the `useVisionScorer` hook (so USB camera streams stay open across all tabs: `'live' | 'calibration' | 'debug'`).
- `frontend/src/utils/visionEngine.js` — Browser real-time computer vision pipeline:
  - `useVisionScorer({...})` — Manages persistent Windows 10 `MediaStream`s for `cam1`, `cam2`, `cam3` (with automatic `devicechange` hot-plug detection and `1280x720` $\to$ `640x480` fallback), runs an ~11 FPS offscreen `240x180` luminance differencing loop inside the calibrated board ROI ($r \le 1.15$), gates on motion settlement (`ARMED` $\to$ `IN_MOTION` $\to$ `SETTLING`), auto-detects when darts are pulled (`onBoardCleared`), and runs `runSyntheticVisionTest(segment, multiplier)`.
  - `detectDartFromDiffBuffer({...})` — Flood-fill connected-component clustering + 2D covariance PCA eigenvector analysis oriented from `mountAngleDeg` to find `imageTip`, `imageTail`, `boardTip`, `boardTail`, and `confidence`.
- `frontend/src/utils/dartboardMath.js` — Shared geometry constants (`BOARD_SECTORS`, `BOARD_RADII`, `OPEN_BOTTOM_GAP`, `TOP_BAR_ZONE`, `RING_LAYOUT_PRESETS`, `CALIBRATION_REFERENCE_TARGETS`), `project3DPointToCamera`, `computePerspectivePresetPoints`, `buildBoardHomography`, `buildInverseBoardHomography`, `scoreFromBoardCoordinates`, and SVG ring/sector path builders.
- `frontend/src/components/TopNavBar.jsx` — Header bar with tab switcher (`Live Score Display`, `Camera Calibration`, `Dev Debug Screen`), `OpenCV-Darts Scorer` live badge + empty-board recalibrate button, `Test Controls: ON/OFF` toggle, `Dev Button (PIN 0161)`, and `Help / Setup Guide` button.
- `frontend/src/components/LiveScoreView.jsx` — 3-Dart Turn Cards + Jumbo Turn Total card, **OpenCV-Darts 3-Camera Vision Monitor** (3 live mini camera feeds, diff counters, `Recalibrate Empty Board`, `Vision: ARMED/PAUSED`, `Vision Settings` drawer), **3-Cam Vision Triangulation Self-Test** bar, `InteractiveDartboard`, and 20-dart `Detection Accuracy Log`.
- `frontend/src/components/CalibrationView.jsx` — Top-down `RingMountDiagram` (Option A vs. Option B layout switcher) + 3 fixed `CameraCalibrationCanvas` boxes (`cam1`, `cam2`, `cam3`) with interactive 4-point clicking/dragging, live projected ring overlay, mount angle slider, and USB camera assignment dropdown.
- `frontend/src/components/DebugView.jsx` — PIN-unlocked (`0161`) hardware diagnostics view showing the 3 assigned slot previews with overlays plus raw physical USB webcam cards with one-click `Save to Slot: Cam 1 / Cam 2 / Cam 3`.
- `frontend/src/components/DevPinModal.jsx` — Keypad modal verifying PIN **`0161`** to unlock `DebugView`.
- `frontend/src/components/InteractiveDartboard.jsx` — High-contrast SVG dartboard that pulses the last hit segment and plots current turn dart markers (`D1`, `D2`, `D3`).
- `frontend/src/components/SetupWizardModal.jsx` — 5-step interactive setup guide modal for hardware mounting, Windows 10 USB settings, camera verification, OpenCV-Darts vision scorer overview, and calibration.

---

## 3. Coordinate & Calibration Conventions

1. **Canonical Dartboard Space $(bx, by)$:**
   - $(0, 0)$ is the center of the Inner Bullseye.
   - Radius `1.0` is the outer edge of the Double ring (`170mm` WDF standard).
   - $(0, -1.0)$ is `12 o'clock` (`0°`, top center of sector `20`); angles increase clockwise.
   - Normalized ring radii (`BOARD_RADII` / `SCORING_RADII`):
     - `INNER_BULL`: `0.045` (segment `25`, mult `2` = 50 pts)
     - `OUTER_BULL`: `0.110` (segment `25`, mult `1` = 25 pts)
     - `TRIPLE_INNER`..`TRIPLE_OUTER`: `0.565`..`0.635` (mult `3`)
     - `DOUBLE_INNER`..`DOUBLE_OUTER`: `0.930`..`1.000` (mult `2`)
2. **4 Canonical Calibration Reference Points (Outer Double Ring $r = 1.0$, Clockwise):**
   - Point 1 (`20/1` wire): `9°`
   - Point 2 (`6/10` wire): `99°`
   - Point 3 (`3/19` wire): `189°`
   - Point 4 (`11/14` wire): `279°`
3. **3D Perspective Dart Tip Geometry:**
   - For a camera mounted on the ring at angle $\theta_i$ ($\mathbf{C}_{i,xy} = (1.35 \sin\theta_i, -1.35 \cos\theta_i)$), a dart sticking out of the board ($z > 0$) projects radially *away* from $\mathbf{C}_{i,xy}$ in canonical board space. Therefore, the **dart tip** ($z = 0$) is always the contour extremity along the principal axis **closest** to $\mathbf{C}_{i,xy}$.

---

## 4. REST API & Socket.IO Contracts (`backend/src/server.js`)

### REST Endpoints
- `GET /api/health` $\to$ `{ ok, service, scorerEngine, uptimeSeconds }`
- `GET /api/state` $\to$ Full application state (`turnNumber`, `currentTurn`, `currentTurnTotal`, `turnHistory`, `accuracyLog`, `lastDetectedDart`, `scorerEngine`, `calibration`, `cameraDiagnostics`)
- `POST /api/vision/detect` — Body: `{ detections: [{ cameraId, imageTip, imageTail, boardTip, boardTail, confidence }], synthetic? }` or `{ x, y }` $\to$ Triangulates and records dart hit.
- `POST /api/vision/status` — Body: `{ activeCamerasCount, fps, armed }` $\to$ Updates scorer runtime telemetry.
- `POST /api/dart/simulate` — Body: `{ segment, multiplier, x?, y? }` or shorthand $\to$ Records simulated dart hit.
- `POST /api/turn/undo` / `POST /api/turn/next` / `POST /api/log/clear` $\to$ Turn & log controls.
- `GET /api/calibration` / `POST /api/calibration` / `POST /api/calibration/camera/:id` / `POST /api/calibration/reset` $\to$ Reads/saves/resets `config/calibration.json`.
- `GET /api/cameras/status` / `POST /api/cameras/test` $\to$ Returns Windows 10 camera slot diagnostics & triangulation metrics.

### Socket.IO Events
- **Server $\to$ Client:** `state:init`, `state:update`, `dart:detected`, `scorer:status`, `calibration:updated`, `cameras:diagnostics`
- **Client $\to$ Server:** `vision:detect`, `vision:camera_status`, `dart:simulate`, `turn:undo`, `turn:next`, `log:clear`, `calibration:save`, `calibration:save_camera`, `calibration:reset`, `cameras:test`

---

## 5. Verification Commands

After making any code changes, verify in a single command:
- **Backend Smoke & E2E Triangulation Tests:** `npm test` (executes `node backend/src/test-smoke.js`)
- **Frontend Production Build Check:** `npm run build`
