# Project Specification: Flight Nights Smart Darts (Windows 10 PC)

## 1. Project Overview & Scope
A minimal, out-of-the-box, TV-optimized web application for a DIY smart darts setup running natively on a **Windows 10 PC** with **three USB cameras (OV9732)**, a **270° open-bottom LED ring light**, and a nearby TV display.

**Core System Components:**
1. Built-in open-source **OpenCV-Darts Multi-Camera Homography & Triangulation Vision Scorer** (`opencv-darts` / `Darts_Project` / `DeepDarts` pipeline) running natively without any external Linux/Raspberry Pi daemon.
2. **3-Camera Calibration Interface** with 4-point perspective homography ring overlays and persistent Windows 10 USB camera assignment.
3. **Live Score Display & Vision Monitor** with real-time 3-camera previews, synthetic 3-camera triangulation self-tests, and a 20-dart accuracy log.
4. **Step-by-Step Windows 10 Setup & Help Wizard**.

---

## 2. Tech Stack & Architecture
- **Backend:** Node.js + Express + `socket.io` + built-in `OpenCVDartsScorer` (`backend/src/opencvDartsScorer.js`).
- **Frontend:** React (Vite) + Tailwind CSS + persistent Windows 10 DirectShow `MediaStream` vision pipeline (`frontend/src/utils/visionEngine.js`).
- **Zero-Database Persistence:** In-memory session state with calibration coordinates and USB camera mappings persisted to `config/calibration.json`.
