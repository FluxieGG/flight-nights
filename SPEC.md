# Project Specification: Smart Darts MVP (Calibration & Score Tester)

## 1. Project Overview & Scope
Build a minimal, out-of-the-box, TV-optimized web application for a DIY smart darts setup running on a **Windows 10 PC** with **three USB cameras (OV9732)**, a **360° LED ring light**, and a nearby TV display.

**Strict MVP Scope (Do NOT overbuild):**
- **NO** party games (no Killer, no Donkey Derby, no X01 rulesets yet).
- **NO** user accounts, logins, or database stat tracking yet.
- **ONLY** build:
    1. Integration with the open-source **OpenDartboard** vision engine.
    2. A **3-Camera Calibration** interface.
    3. A **Live Score Display & Dart Tester** to verify dart detection accuracy.
    4. A built-in **Step-by-Step Setup & Help Wizard** accessible from a prominent Help button.

---

## 2. Tech Stack & Architecture
Keep the architecture lightweight, modular, and easy to run on a Windows 10 PC:
- **Backend:** Node.js + Express + `ws` (WebSocket client for OpenDartboard) + `socket.io` (real-time bridge to the frontend).
- **Frontend:** React (Vite) + Tailwind CSS (dark, high-contrast, TV-readable UI designed to be read from ~8 feet away).
- **Zero-Database:** Keep session state (current turn darts, dart history log, calibration points) in memory and persist calibration settings to a local `config/calibration.json` file.

---

## 3. OpenDartboard Integration (Open-Source Vision Engine)
Do NOT write custom OpenCV dart-detection algorithms from scratch. This app sits on top of the open-source **OpenDartboard** daemon:
- Connect the Node.js backend as a WebSocket client to `ws://localhost:13520` (configurable via `.env`).
- Parse incoming JSON dart-hit payloads (segment `1–20`, `25` for bull, multiplier `0–3`, and optional x/y coordinates).
- **Connection Status Indicator:** Show a live badge in the top bar (`OpenDartboard: Connected` in green, or `Disconnected / Reconnecting...` in amber/red) with automatic reconnection every 3 seconds.
- **Out-of-the-Box Mock Mode:** Include a toggleable **"Simulate Dart" / Test Mode** in the UI (e.g., quick buttons for `T20`, `Bull`, `D16`, `Miss`, or clicking a dartboard segment) so the user can test the entire app immediately even before the OpenDartboard daemon or cameras are connected.

---

## 4. Core Features to Build

### A. Live Score Display (Main View)
- **Current Turn Display:** Large, bold TV-friendly cards showing Dart 1, Dart 2, Dart 3, and the **Turn Total** (e.g., `T20 | S20 | T20 — Total: 140`).
- **Interactive SVG Dartboard:** A clean, dark-mode SVG dartboard that briefly highlights/pulses the exact segment just detected.
- **Testing Controls:**
    - **Undo Last Dart** button (removes the last recorded dart from the current turn).
    - **Next Turn / Clear** button (resets the 3-dart tray and logs the turn to a compact recent-throws sidebar).
    - **Accuracy Log:** A scrollable list of the last 20 detected darts with timestamps and raw payload values so the user can verify detection reliability.

### B. 3-Camera Calibration View
- Accessible via a top navigation tab: **"Camera Calibration"**.
- Displays a 3-panel grid for **Camera 1 (10 o'clock)**, **Camera 2 (2 o'clock)**, and **Camera 3 (6 o'clock)**.
- Supports fetching/displaying the live camera MJPEG/WebRTC streams (or snapshots) from OpenDartboard/Windows USB video devices (`USB Camera 0`, `USB Camera 1`, `USB Camera 2`), with a clean fallback placeholder if a camera is not detected.
- **Interactive Calibration Tool:**
    - Allow the user to click 4 reference calibration points on each camera feed (e.g., Double-ring intersections at 20/1, 6/10, 3/19, 11/14) to align the board overlay.
    - Provide **"Reset Points"** and **"Save Calibration"** buttons that write to `config/calibration.json` and forward/sync the calibration config to OpenDartboard.
    - Display a live visual overlay of the calibrated dartboard rings on top of each camera feed so the user can visually confirm alignment.

### C. Built-in "Help & Camera Setup" Wizard
- Place a prominent, always-visible **"Help / Setup Guide"** button in the top navigation bar.
- Clicking it opens a clean, step-by-step interactive modal/drawer that walks the user through the entire physical and software setup:
    - **Step 1: Hardware & Lighting** — Mount the 360° LED light ring (Target Corona / Winmau Plasma / Mission Torus) to eliminate dart shadows. Mount the 3 OV9732 USB cameras evenly at roughly **10 o'clock, 2 o'clock, and 6 o'clock**, angled so the entire dartboard is visible in each frame.
    - **Step 2: Windows 10 PC Connections** — Plug all 3 USB cameras into the Windows 10 PC USB ports (spread across USB 3.0 and USB 2.0 root hubs to balance bandwidth), disable USB Selective Suspend in Windows Power Options, and connect the TV via HDMI or DisplayPort.
    - **Step 3: Verify Camera Feeds** — Instructions (and a quick "Test Cameras" button) to confirm Windows 10 detects all 3 cameras in Device Manager and that the feeds are clear, focused, and shadow-free.
    - **Step 4: Start OpenDartboard** — Clear instructions on verifying the OpenDartboard daemon is running on Windows 10 and broadcasting on `ws://localhost:13520`, referencing the connection status badge.
    - **Step 5: Calibrate & Throw Test Darts** — Walkthrough of clicking the 4 reference points on each of the 3 camera feeds in the Calibration tab, saving, and throwing test darts (starting with Bullseye, 20, 3, 11, 6) to verify the Live Score Display matches reality.

---

## 5. Out-of-the-Box Deliverables
1. Clean monorepo structure (`/backend`, `/frontend`, `/config`).
2. `setup.bat` / `setup.sh` script that installs all npm dependencies for both backend and frontend.
3. `start.bat` / `start.sh` script that launches both the backend and frontend concurrently and prints the local URL (e.g., `http://localhost:5173`) to open on the TV browser.
4. A concise `README.md` explaining how to run `setup.bat` / `start.bat`, and how to configure the OpenDartboard WebSocket URL in `.env`.
5. Verify that both the backend and frontend build and start cleanly with zero errors before finishing.
