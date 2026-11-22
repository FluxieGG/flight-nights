# Flight Nights — Smart Darts Vision Scorer (Windows 10 PC)

A native Windows 10, TV-optimized automatic steel-tip dart scoring application built for **three OV9732 USB cameras** mounted on a **270° open-bottom LED ring light**, powered by a built-in **OpenCV-Darts 4-Point Homography & 3-Camera Ray Triangulation Scoring Engine** (based on the open-source `opencv-darts`, `Darts_Project`, and `DeepDarts` computer vision architecture).

> **100% Native Windows 10 — Zero External Daemons:** No Raspberry Pi, no Linux/WSL, no `usbipd`, and no external background daemon required. Plug your 3 USB cameras directly into your Windows 10 PC and launch with `start.bat`.

---

## 1. Quick Start (Windows 10)

### Prerequisites
- **Windows 10 PC** (or Windows 11)
- **Node.js** (v18+ recommended)
- **Google Chrome** or **Microsoft Edge**
- **3x USB UVC Webcams** (e.g., OV9732 720p USB cameras) mounted around a 270° or 360° LED ring light

### Step 1: Install Dependencies (First Time Only)
Double-click **`setup.bat`** in File Explorer, or run in PowerShell / Command Prompt:

```powershell
.\setup.bat

Release from WSL usbipd (Only if you ran the old WSL script earlier):                                                                                                                                                                        
      • If you previously used use-cameras-in-wsl.bat, Windows may still have your USB cameras bound to WSL. To make sure Windows owns all 3 cameras natively, open PowerShell as Administrator once and run:                                     
        & "C:\Program Files\usbipd-win\usbipd.exe" unbind --all
        ```

This automatically creates `.env` (if not present) and installs all backend and frontend dependencies.

### Step 2: Start the App
Double-click **`start.bat`** in File Explorer, or run in PowerShell / Command Prompt:

```powershell
.\start.bat
```

- **Backend API & Socket.IO Server:** `http://localhost:3001`
- **TV Browser Display URL:** `http://localhost:5173`

Open **`http://localhost:5173`** in Chrome or Edge (press **`F11`** for fullscreen on your TV display).

---

## 2. Physical Camera Mounting & Windows 10 USB Setup

### A. Mounting Cameras on a 270° Open-Bottom Ring Light
Because a 270° open-bottom LED ring light has **no ring section at the bottom (~4:30 to ~7:30)** and a **mounting bracket bar at 12 o'clock**, the app supports two optimal near-120° triangulation layouts:

| Camera Slot | Option A: Left of Bar (Default) | Option B: Right of Bar |
| :--- | :--- | :--- |
| **Camera 1 (Top)** | **~11:30** (`345°`, just left of bar toward **5**) | **~12:30** (`15°`, just right of bar toward **1**) |
| **Camera 2 (Right)** | **~3:40** (`110°`, lower-right arm over **10**) | **~4:10** (`125°`, lower-right arm over **15**) |
| **Camera 3 (Left)** | **~7:50** (`235°`, lower-left arm over **16**) | **~8:20** (`250°`, lower-left arm over **8**) |

Aim all 3 lenses toward the bullseye so the entire outer **Double ring** is visible in each camera frame.

### B. Plugging Cameras into Windows 10
1. **Spread Across USB Ports:** Plug your 3 USB cameras directly into your Windows 10 PC motherboard USB ports (ideally across blue **USB 3.0 SuperSpeed** ports and separate front/rear USB ports so all three 720p streams have full USB bandwidth).
   - *Note:* If all 3 cameras share a single USB 2.0 hub, the app automatically falls back to **480p Safe Mode** (or you can toggle **480p Safe Mode** in **Vision Settings**) so all 3 cameras stream concurrently without drops.
2. **Enable Windows 10 Camera Privacy Permissions:**
   - Open **Windows Settings → Privacy → Camera**.
   - Ensure **"Allow apps to access your camera"** and **"Allow desktop apps to access your camera"** are turned **On**.
3. **Disable Windows USB Selective Suspend (Recommended):**
   - Open **Control Panel → Power Options → Change plan settings → Change advanced power settings → USB settings → USB selective suspend setting** and set it to **Disabled** so Windows never puts the cameras to sleep during a match.

---

## 3. Step-by-Step Camera Calibration

Once the app is running at `http://localhost:5173` and your USB cameras are plugged in:

1. **Grant Browser Camera Permission:** When prompted by Chrome/Edge, click **Allow** so the browser can access your Windows 10 USB cameras. (Hot-plugging is supported — you can plug cameras in while the app is open or click **Scan USB Cameras**).
2. **Open the `Camera Calibration` Tab:**
   - Select **Option A (Left of Bar toward 5)** or **Option B (Right of Bar toward 1)** at the top to match your physical ring mount.
   - Verify the live video feed in **Box 1 (Camera 1)**, **Box 2 (Camera 2)**, and **Box 3 (Camera 3)**.
   - Need to swap which physical USB camera goes to which box? Click the **Sliders icon** in any camera card (or open the **Dev Debug Screen** with PIN **`0161`**) and assign each USB camera to **Cam 1**, **Cam 2**, or **Cam 3**. Your device mapping is saved permanently to `config/calibration.json`.
3. **Place the 4 Reference Points on Each Camera:**
   - If points are already placed, click **Clear 4 Pts** (or drag the existing numbered points `#1`–`#4` directly onto the wires).
   - Click the **outer edge of the Double ring** at the 4 canonical sector wire intersections in clockwise order:
     1. **`#1 20/1`** — Outer Double wire between **20 and 1** (Top)
     2. **`#2 6/10`** — Outer Double wire between **6 and 10** (Right)
     3. **`#3 3/19`** — Outer Double wire between **3 and 19** (Bottom)
     4. **`#4 11/14`** — Outer Double wire between **11 and 14** (Left)
4. **Confirm Overlay Alignment & Save:**
   - Once all 4 points are placed, the green/blue/red calibrated dartboard ring overlay is projected onto your live camera feed. Drag any of the 4 points to fine-tune alignment with the physical wires.
   - Click **Save All Cameras (1, 2, 3)** (or **Save Camera** on individual boxes). This saves the homography points to `config/calibration.json` and automatically captures a clean empty-board reference frame.

---

## 4. Throwing Darts & Using the Live Vision Scorer

Switch to the **`Live Score Display`** tab:

1. **Make Sure the Board is Empty & Click `Recalibrate Empty Board`:**
   - Before throwing your first turn (or if room lighting changes), click **Recalibrate Empty Board** in the top bar (or the refresh icon next to `OpenCV-Darts Scorer: Active`) while no darts are in the board.
2. **Throw Your Darts (Dart 1, Dart 2, Dart 3):**
   - The **OpenCV-Darts 3-Camera Vision Monitor** continuously monitors all active camera feeds at ~11 FPS.
   - When a dart enters the board area, the status changes to `Motion Detected...` → `Settling Frame...` → `Dart Triangulated`.
   - Each camera isolates the new dart contour, locates the metal dart tip at the board plane ($z = 0$) via 2D Principal Component Analysis (PCA), projects it through that camera's 4-point inverse homography ($H^{-1}$), and sends the observations to the backend triangulation engine to compute the exact board coordinates $(x, y)$ and WDF score (`T20`, `BULL`, `D16`, etc.).
3. **Pull Your Darts (Automatic Turn Advance):**
   - When you pull your darts out of the board, the vision engine sees the board return to its clean empty-board state and automatically advances to the next turn (or you can click **Next Turn / Clear** manually at any time).
   - Made a mistake or had a bounce-out? Click **Undo Last Dart**.

### Vision Settings (Sensitivity, Auto-Clear & USB Bandwidth Mode)
In the **Live Score Display**, click **Vision Settings** inside the **OpenCV-Darts 3-Camera Vision Monitor** bar to adjust:
- **Detection Sensitivity Threshold (`14`–`55`, default `26`):** Lower values make the detector more sensitive to thin barrels/tips; higher values ignore ambient room light fluctuations.
- **Auto-Clear When Darts Pulled:** Toggle automatic turn advance when darts are removed from the board.
- **Windows USB Hub Bandwidth Mode:** Switch between **720p HD (USB 3.0)** and **480p Safe Mode (Single USB Hub)**.

### Testing Without Physical Darts
With **Test Controls: ON** in the top navigation bar, you can:
- Run a **3-Cam Vision Triangulation Test** (`Bullseye`, `Top (T20)`, `Bottom (T19)`, `Left (D11)`, `Right (D6)`), which renders a synthetic 3D dart onto all 3 camera perspectives and runs the full pixel-differencing, PCA tip extraction, inverse homography, and 3-camera ray triangulation pipeline end-to-end.
- Click quick-throw buttons (`T20`, `BULL`, `25`, `D16`, `T19`, `S20`, `D20`, `MISS`, `Random Throw`) or click any segment directly on the **Interactive SVG Dartboard**.

---

## 5. Developer Debug Screen (PIN: `0161`)

Click **Dev Button (PIN 0161)** in the top bar and enter **`0161`** to open the **Camera Previews & OpenCV-Darts Vision Diagnostics** view:
- View all connected physical Windows 10 DirectShow USB cameras with live resolution (`1280x720` / `640x480`) and real-time pixel-diff counters.
- Permanently bind any physical USB camera to **Cam 1 (Top)**, **Cam 2 (Right)**, or **Cam 3 (Left)** with one click.

---

## 6. Project Structure & Configuration

```text
├── backend/                          # Node.js + Express + Socket.IO + OpenCV-Darts Triangulation Scorer
│   ├── src/
│   │   ├── server.js                 # Express REST API, Socket.IO real-time bridge, session state
│   │   ├── opencvDartsScorer.js      # 4-point forward/inverse homography (H, H^-1) & 3-camera ray triangulation
│   │   ├── dartParser.js             # Normalizes dart coordinates, segments, multipliers & scores
│   │   ├── calibrationStore.js       # Persists 3-camera calibration points & USB device IDs to config/calibration.json
│   │   ├── cameraManager.js          # Windows 10 DirectShow USB diagnostics & 270° ring triangulation checks
│   │   └── test-smoke.js             # End-to-end homography, 3-camera triangulation, and API smoke test suite
│   └── package.json
├── frontend/                         # React (Vite) + Tailwind CSS high-contrast TV UI (~8ft readability)
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopNavBar.jsx              # Vision scorer status badge, empty-board recalibrate button, Help button
│   │   │   ├── LiveScoreView.jsx          # 3-Dart Turn Cards, Live 3-Camera Vision Monitor, 20-Dart Accuracy Log
│   │   │   ├── InteractiveDartboard.jsx   # Dark-mode SVG dartboard with hit pulsing & plotted dart markers
│   │   │   ├── CalibrationView.jsx        # 3-Camera Calibration grid + live 4-point perspective ring overlay
│   │   │   ├── DebugView.jsx              # PIN-protected (0161) hardware camera diagnostics & slot mapping
│   │   │   └── SetupWizardModal.jsx       # 5-Step interactive Windows 10 Hardware & Vision Scorer Setup Guide
│   │   └── utils/
│   │       ├── dartboardMath.js           # Dartboard geometry, 3D camera projection & 8x8 homography solver
│   │       └── visionEngine.js            # Persistent Windows 10 USB camera stream manager, frame differencing & PCA tip detector
│   └── package.json
├── config/
│   └── calibration.json              # Persisted 4-point calibration coordinates, vision settings & USB camera IDs
├── .env                              # Environment configuration (server port, default camera labels)
├── setup.bat                         # Installs all npm dependencies for backend and frontend on Windows 10
└── start.bat                         # Launches backend and frontend concurrently and prints the TV URL
```

### Running Backend Tests
To run the automated smoke test suite (verifying `dartParser`, `calibrationStore`, `opencvDartsScorer` 4-point homography & 3-camera triangulation, and all Express/Socket.IO endpoints):

```powershell
npm test
```
