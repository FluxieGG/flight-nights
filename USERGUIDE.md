# Flight Nights — Step-by-Step Windows 10 User Guide

This guide walks you through mounting your 3 OV9732 USB cameras on your 270° open-bottom LED ring light, connecting them to your Windows 10 PC, calibrating the 4-point dartboard overlay, and tracking real darts in **Flight Nights**.

---

## Step 1: Mount & Aim Your 3 Cameras on the 270° Ring Light

Because your ring light has an **open bottom (~4:30 to ~7:30)** and a **mounting bracket bar at 12 o'clock**, mount your 3 OV9732 USB cameras in one of these two near-120° triangulation layouts:

### Option A — Top Camera Left of Bar (Default)
- **Camera 1 (Top):** **~11:30** (`345°`) — Just left of the 12:00 bar, aligned over the **5** sector.
- **Camera 2 (Right):** **~3:40** (`110°`) — Lower-right arm of the ring, aligned over the **10** sector.
- **Camera 3 (Left):** **~7:50** (`235°`) — Lower-left arm of the ring, aligned over the **16** sector.

### Option B — Top Camera Right of Bar
- **Camera 1 (Top):** **~12:30** (`15°`) — Just right of the 12:00 bar, aligned over the **1** sector.
- **Camera 2 (Right):** **~4:10** (`125°`) — Lower-right arm of the ring, aligned over the **15** sector.
- **Camera 3 (Left):** **~8:20** (`250°`) — Lower-left arm of the ring, aligned over the **8** sector.

### Aiming & Lighting Checklist
1. Point all 3 camera lenses toward the **Bullseye** so that the **entire outer Double ring** is visible inside each camera's frame with a small margin around the outside.
2. Turn on the LED ring light so the dartboard face is evenly lit and free of harsh room shadows.
3. Make sure each camera bracket is tightened so the cameras do not wobble when darts hit the board.

---

## Step 2: Plug Cameras into Your Windows 10 PC

1. **Spread Across USB Ports:**
   - Plug the 3 USB camera cables directly into your Windows 10 PC motherboard USB ports (use blue **USB 3.0 SuperSpeed** ports and separate front/rear ports where possible rather than plugging all 3 into a single unpowered USB 2.0 hub).
2. **Release Cameras from WSL `usbipd` (Only if you ever used the old WSL script):**
   - If you previously ran `use-cameras-in-wsl.bat`, Windows may still have your USB ports bound to WSL. To ensure Windows 10 owns all 3 cameras natively, open **PowerShell as Administrator** once and run:
     ```powershell
     & "C:\Program Files\usbipd-win\usbipd.exe" unbind --all
     ```
3. **Check Windows 10 Camera Privacy Permissions:**
   - Open **Windows Settings → Privacy → Camera**.
   - Make sure **"Allow apps to access your camera"** and **"Allow desktop apps to access your camera"** are both turned **ON**.
4. **Disable Windows USB Selective Suspend (Recommended):**
   - Open **Control Panel → Power Options → Change plan settings → Change advanced power settings → USB settings → USB selective suspend setting** and set it to **Disabled** so Windows never puts the cameras to sleep mid-game.

---

## Step 3: Launch the Application

1. **First-Time Dependency Install:**
   - Double-click **`setup.bat`** in File Explorer (or run `.\setup.bat` in PowerShell). Wait for it to finish installing backend and frontend packages.
2. **Start the App:**
   - Double-click **`start.bat`** in File Explorer (or run `.\start.bat` in PowerShell).
   - This launches the **Smart Darts Backend** (`http://localhost:3001`) in a separate command window and starts the **Frontend UI** (`http://localhost:5173`).
3. **Open in Your Browser:**
   - Open **Google Chrome** or **Microsoft Edge** and go to:
     ```text
     http://localhost:5173
     ```
   - Press **`F11`** if you want fullscreen mode on your TV display.
   - When Chrome/Edge asks for permission to use your cameras, click **Allow**.

---

## Step 4: Assign & Calibrate Your 3 Cameras

Click the **`Camera Calibration`** tab in the top navigation bar:

### 1. Select Your Ring Layout
- At the top of the page, click **Option A: Left of Bar (toward 5)** or **Option B: Right of Bar (toward 1)** to match where you mounted Camera 1.

### 2. Verify Your 3 Live Camera Feeds (`Box 1`, `Box 2`, `Box 3`)
- Confirm you see live video feeds in **CAMERA 1 (Fixed Box #1)**, **CAMERA 2 (Fixed Box #2)**, and **CAMERA 3 (Fixed Box #3)**.
- **If a camera is in the wrong box** (for example, your Top camera is appearing in Box 2):
  - Click the **Sliders icon** at the bottom of the camera card (or click **Dev Button (PIN 0161)** in the top bar to open the Developer Debug screen) and select which physical USB camera belongs to **Cam 1 (Top)**, **Cam 2 (Right)**, and **Cam 3 (Left)**.
- **If only 1 or 2 cameras turn on:**
  - Your 3 cameras may be sharing a single USB 2.0 controller. Switch to **Live Score Display → Vision Settings** and select **480p Safe Mode (Single USB Hub)** so all 3 cameras stream simultaneously without bandwidth drops.

### 3. Click the 4 Calibration Reference Points on Each Camera
For **Camera 1**:
1. Click **`Clear 4 Pts`** at the bottom of the Camera 1 box.
2. Click the **outer edge of the Double ring** at the 4 sector wire intersections in **clockwise order** (the amber prompt bar above the video tells you which intersection to click next):
   - **Point `#1 (20 / 1)`:** Outer Double wire intersection between **20 and 1**
   - **Point `#2 (6 / 10)`:** Outer Double wire intersection between **6 and 10**
   - **Point `#3 (3 / 19)`:** Outer Double wire intersection between **3 and 19**
   - **Point `#4 (11 / 14)`:** Outer Double wire intersection between **11 and 14**
3. **Fine-Tune the Ring Overlay:**
   - As soon as all 4 points are placed, the **calibrated dartboard ring overlay** is projected onto your camera feed:
     - **Green lines:** Outer/Inner Double ring & 20 sector wires
     - **Blue lines:** Outer/Inner Triple ring
     - **Amber circle:** Outer Bull (25)
     - **Red circle:** Inner Bullseye (50)
   - Drag any of the 4 numbered points (`#1`–`#4`) slightly until the green and blue rings sit directly on top of your physical dartboard wires.
   - *(Note: Even if a camera is mounted sideways or upside-down on the ring light, clicking `#1 20/1`, `#2 6/10`, `#3 3/19`, `#4 11/14` in order automatically rotates and warps the overlay to match!)*

### 4. Repeat for Camera 2 & Camera 3, Then Save
- Place and fine-tune the 4 points on **Camera 2** and **Camera 3**.
- Click the green **`Save All Cameras (1, 2, 3)`** button at the top right.
- Your 4-point homography calibration and USB camera assignments are saved permanently to `config/calibration.json`.

---

## Step 5: Throw & Track Real Darts

Switch to the **`Live Score Display`** tab:

### 1. Capture the Clean Empty Board Reference
- Make sure **no darts** are in the dartboard and nobody is standing right in front of the board.
- Click **`Recalibrate Empty Board`** at the top right of the Turn display (or the refresh icon inside the `OpenCV-Darts Scorer` badge in the top bar).
- Check the **OpenCV-Darts 3-Camera Vision Monitor** panel:
  - Status should read **`Armed (Empty Board Reference Captured)`**
  - Camera counter should read **`3/3 USB Cameras Active`**
  - Mode button should read **`Vision: ARMED`**

### 2. Throw Dart 1, Dart 2, and Dart 3
- **Throw Dart 1:**
  - As your dart flies in and sticks in the board, the Vision Monitor status transitions:
    `Motion Detected...` → `Settling Frame...` → `Dart Triangulated (3/3 Cams)`
  - A green dot marks the detected dart tip on each mini camera preview, the hit segment pulses on the interactive SVG dartboard, and the **DART 1** card displays the score (e.g., `T20 +60`).
- **Throw Dart 2 & Dart 3:**
  - After each dart is scored, the vision engine updates its baseline snapshot so **Dart 2** only detects the second dart and **Dart 3** only detects the third dart.

### 3. Pull Your Darts (Automatic Turn Advance)
- Walk up to the board and pull all 3 darts out.
- When you step back and the board is empty again, the vision engine sees that the board matches the clean empty-board reference and **automatically advances to the next turn** (`Board Cleared — Next Turn`).
- You can also click **`Next Turn / Clear`** or **`Undo Last Dart`** manually at any time.

---

## Step 6: Fine-Tuning & Troubleshooting

Click **`Vision Settings`** inside the **OpenCV-Darts 3-Camera Vision Monitor** bar on the Live Score Display to adjust detection for your room setup:

| Symptom | How to Fix |
| :--- | :--- |
| **A thrown dart isn't being detected** | Lower the **Detection Sensitivity Threshold** slider slightly (e.g., from `26` down to `18–20`) so thinner dart points/barrels register more easily. |
| **False detections from shadows or room light changes** | Raise the **Detection Sensitivity Threshold** slider slightly (e.g., to `30–35`), then click **`Recalibrate Empty Board`** with no darts in the board. |
| **Score is off by one segment or ring** | Open **Camera Calibration** and check all 3 camera overlays. Drag points `#1 (20/1)`, `#2 (6/10)`, `#3 (3/19)`, `#4 (11/14)` so the green Double ring and yellow cardinal wires line up tightly with the physical board wires, then click **Save All Cameras**. |
| **Only 1 or 2 USB cameras start streaming** | Open **Vision Settings** and click **`480p Safe Mode (Single USB Hub)`**, or move one USB camera cable to a different USB port/root hub on your Windows 10 PC. |
| **Need to inspect raw USB camera feeds** | Click **`Dev Button (PIN 0161)`** in the top bar and enter **`0161`** to view all connected Windows 10 DirectShow webcams and bind each one to Cam 1, Cam 2, or Cam 3. |
