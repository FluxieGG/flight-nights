import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BOARD_SECTORS,
  BOARD_RADII,
  buildInverseBoardHomography,
  project3DPointToCamera
} from './dartboardMath';

const PROC_W = 240;
const PROC_H = 180;
const SLOT_KEYS = ['cam1', 'cam2', 'cam3'];
const DEFAULT_ANGLES = { cam1: 345, cam2: 110, cam3: 235 };

/**
 * Converts RGBA imageData into a 3x3 box-smoothed luminance array (Float32Array of size W * H).
 */
function extractSmoothedLuminance(rgba, width, height) {
  const raw = new Float32Array(width * height);
  for (let i = 0, p = 0; i < raw.length; i++, p += 4) {
    // Perceptual luminance
    raw[i] = rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114;
  }

  const smoothed = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = row + x;
      smoothed[idx] =
        (raw[idx - width - 1] +
          raw[idx - width] +
          raw[idx - width + 1] +
          raw[idx - 1] +
          raw[idx] * 2 +
          raw[idx + 1] +
          raw[idx + width - 1] +
          raw[idx + width] +
          raw[idx + width + 1]) *
        0.1;
    }
  }
  return smoothed;
}

/**
 * Builds a boolean mask (Uint8Array of size W * H) of pixels that project inside
 * the dartboard surround (radius <= 1.12 in canonical board coordinates).
 */
function buildBoardRoiMask(invHomography, width, height) {
  const mask = new Uint8Array(width * height);
  if (!invHomography) {
    mask.fill(1);
    return mask;
  }
  for (let y = 2; y < height - 2; y++) {
    const v = y / height;
    const row = y * width;
    for (let x = 2; x < width - 2; x++) {
      const u = x / width;
      const pt = invHomography(u, v);
      if (pt.x * pt.x + pt.y * pt.y <= 1.15 * 1.15) {
        mask[row + x] = 1;
      }
    }
  }
  return mask;
}

/**
 * Extracts the primary connected foreground contour from a thresholded difference buffer,
 * projects its pixels into canonical board space via H^-1, performs 2D PCA along the
 * dart axis, and locates the dart tip (extremity closest to the camera's ring mount angle)
 * and dart tail/flight (extremity furthest from the camera mount).
 */
export function detectDartFromDiffBuffer({
  diffMask,
  diffWeights,
  width,
  height,
  invHomography,
  mountAngleDeg,
  minContourPixels = 14
}) {
  if (!invHomography) return null;

  const visited = new Uint8Array(width * height);
  let bestCluster = null;
  let bestClusterScore = 0;

  const queue = new Int32Array(width * height);

  for (let y = 2; y < height - 2; y++) {
    const row = y * width;
    for (let x = 2; x < width - 2; x++) {
      const startIdx = row + x;
      if (!diffMask[startIdx] || visited[startIdx]) continue;

      let head = 0;
      let tail = 0;
      queue[tail++] = startIdx;
      visited[startIdx] = 1;

      const pixels = [];
      let totalIntensity = 0;

      while (head < tail) {
        const curr = queue[head++];
        const cy = Math.floor(curr / width);
        const cx = curr - cy * width;
        const w = diffWeights[curr];
        pixels.push({ x: cx, y: cy, w });
        totalIntensity += w;

        // 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny <= 1 || ny >= height - 2) continue;
          const nRow = ny * width;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            if (nx <= 1 || nx >= width - 2) continue;
            const nIdx = nRow + nx;
            if (diffMask[nIdx] && !visited[nIdx]) {
              visited[nIdx] = 1;
              queue[tail++] = nIdx;
            }
          }
        }
      }

      if (pixels.length >= minContourPixels && pixels.length <= width * height * 0.18) {
        const clusterScore = totalIntensity * Math.sqrt(pixels.length);
        if (clusterScore > bestClusterScore) {
          bestClusterScore = clusterScore;
          bestCluster = pixels;
        }
      }
    }
  }

  if (!bestCluster || bestCluster.length < minContourPixels) {
    return null;
  }

  // Project contour pixels to canonical board space and compute weighted centroid
  const projected = [];
  let sumW = 0;
  let meanBx = 0;
  let meanBy = 0;

  for (const px of bestCluster) {
    const u = (px.x + 0.5) / width;
    const v = (px.y + 0.5) / height;
    const bPt = invHomography(u, v);
    const w = px.w;
    projected.push({
      u,
      v,
      bx: bPt.x,
      by: bPt.y,
      w
    });
    meanBx += bPt.x * w;
    meanBy += bPt.y * w;
    sumW += w;
  }

  if (sumW <= 0) return null;
  meanBx /= sumW;
  meanBy /= sumW;

  // 2x2 weighted covariance matrix in canonical board space for Principal Component Analysis (PCA)
  let covXX = 0;
  let covYY = 0;
  let covXY = 0;
  for (const pt of projected) {
    const dx = pt.bx - meanBx;
    const dy = pt.by - meanBy;
    covXX += pt.w * dx * dx;
    covYY += pt.w * dy * dy;
    covXY += pt.w * dx * dy;
  }
  covXX /= sumW;
  covYY /= sumW;
  covXY /= sumW;

  // Principal eigenvector of 2x2 symmetric covariance matrix
  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const lambda1 = trace / 2 + disc;
  const lambda2 = Math.max(1e-6, trace / 2 - disc);

  let axisX = 1;
  let axisY = 0;
  if (Math.abs(covXY) > 1e-6) {
    axisX = lambda1 - covYY;
    axisY = covXY;
  } else if (covYY > covXX) {
    axisX = 0;
    axisY = 1;
  }
  const axisLen = Math.hypot(axisX, axisY) || 1;
  axisX /= axisLen;
  axisY /= axisLen;

  // Camera ring mount position in canonical board space: C = (Rc * sin(theta), -Rc * cos(theta))
  // As derived from 3D perspective projection Q(s) - T = (s / (Cz - s)) * (T - C_xy),
  // the dart tip (z = 0) is the contour endpoint closest to C_xy, while the flight (z > 0) extends away from C_xy.
  const thetaRad = ((mountAngleDeg || 0) * Math.PI) / 180.0;
  const camX = 1.35 * Math.sin(thetaRad);
  const camY = -1.35 * Math.cos(thetaRad);

  const toBoardCenterX = meanBx - camX;
  const toBoardCenterY = meanBy - camY;
  // Orient principal axis vector so positive t points away from the camera mount (from Tip -> Flight)
  if (axisX * toBoardCenterX + axisY * toBoardCenterY < 0) {
    axisX = -axisX;
    axisY = -axisY;
  }

  // Sort contour points along the oriented principal axis (minimum projection = Tip, maximum = Flight/Tail)
  const sortedByAxis = [...projected].sort((a, b) => {
    const ta = (a.bx - meanBx) * axisX + (a.by - meanBy) * axisY;
    const tb = (b.bx - meanBx) * axisX + (b.by - meanBy) * axisY;
    return ta - tb;
  });

  // Robust 5th-percentile average for Tip (avoids single-pixel noise) and 92nd-percentile for Tail
  const tipCount = Math.max(1, Math.min(6, Math.floor(sortedByAxis.length * 0.08)));
  let tipU = 0;
  let tipV = 0;
  let tipBx = 0;
  let tipBy = 0;
  for (let i = 0; i < tipCount; i++) {
    tipU += sortedByAxis[i].u;
    tipV += sortedByAxis[i].v;
    tipBx += sortedByAxis[i].bx;
    tipBy += sortedByAxis[i].by;
  }
  tipU /= tipCount;
  tipV /= tipCount;
  tipBx /= tipCount;
  tipBy /= tipCount;

  let tailU = 0;
  let tailV = 0;
  let tailBx = 0;
  let tailBy = 0;
  for (let i = sortedByAxis.length - tipCount; i < sortedByAxis.length; i++) {
    tailU += sortedByAxis[i].u;
    tailV += sortedByAxis[i].v;
    tailBx += sortedByAxis[i].bx;
    tailBy += sortedByAxis[i].by;
  }
  tailU /= tipCount;
  tailV /= tipCount;
  tailBx /= tipCount;
  tailBy /= tipCount;

  const elongation = Math.min(10, Math.sqrt(lambda1 / lambda2));
  const confidence = Number(
    Math.max(0.45, Math.min(0.98, 0.55 + Math.min(0.25, bestCluster.length / 180) + Math.min(0.18, (elongation - 1) * 0.08))).toFixed(2)
  );

  return {
    imageTip: { x: Number(tipU.toFixed(4)), y: Number(tipV.toFixed(4)) },
    imageTail: { x: Number(tailU.toFixed(4)), y: Number(tailV.toFixed(4)) },
    boardTip: { x: Number(tipBx.toFixed(4)), y: Number(tipBy.toFixed(4)) },
    boardTail: { x: Number(tailBx.toFixed(4)), y: Number(tailBy.toFixed(4)) },
    pixelCount: bestCluster.length,
    elongation: Number(elongation.toFixed(2)),
    confidence
  };
}

/**
 * Persistent Windows 10 Multi-Camera Stream Manager & OpenCV-Darts Real-Time Vision Hook.
 * Keeps camera streams open across tab changes and runs real-time frame-differencing &
 * 4-point inverse-homography dart tip detection across all connected physical USB cameras.
 */
export function useVisionScorer({
  calibration,
  currentTurnLength = 0,
  onVisionDetect,
  onBoardCleared,
  onCameraRuntimeStatus,
  onAssignCameraDevice
}) {
  const [windowsVideoDevices, setWindowsVideoDevices] = useState([]);
  const [cameraStreams, setCameraStreams] = useState({ cam1: null, cam2: null, cam3: null });
  const [cameraStatusMap, setCameraStatusMap] = useState({
    cam1: { active: false, resolution: null, error: null, diffScore: 0, lastTip: null, hasReference: false },
    cam2: { active: false, resolution: null, error: null, diffScore: 0, lastTip: null, hasReference: false },
    cam3: { active: false, resolution: null, error: null, diffScore: 0, lastTip: null, hasReference: false }
  });
  const [visionArmed, setVisionArmed] = useState(true);
  const [sensitivity, setSensitivity] = useState(
    calibration?.visionSettings?.sensitivity ?? 26
  );
  const [autoClearOnPull, setAutoClearOnPull] = useState(
    calibration?.visionSettings?.autoClearOnPull !== false
  );
  const [resolutionMode, setResolutionMode] = useState(
    calibration?.visionSettings?.resolutionMode || '720p'
  );
  const [visionStateLabel, setVisionStateLabel] = useState('Ready');
  const [fps, setFps] = useState(0);

  // Offscreen video & canvas elements for continuous vision processing even when on Live Score Display
  const hiddenVideosRef = useRef({});
  const hiddenCanvasesRef = useRef({});
  const activeStreamsRef = useRef({ cam1: null, cam2: null, cam3: null });
  const openedDeviceIdsRef = useRef({ cam1: '', cam2: '', cam3: '' });

  // Per-camera frame buffers for background subtraction & motion settlement
  const visionBuffersRef = useRef({
    cam1: { emptyFrame: null, baselineFrame: null, prevFrame: null, roiMask: null, pointsHash: '' },
    cam2: { emptyFrame: null, baselineFrame: null, prevFrame: null, roiMask: null, pointsHash: '' },
    cam3: { emptyFrame: null, baselineFrame: null, prevFrame: null, roiMask: null, pointsHash: '' }
  });

  const motionStateRef = useRef({
    phase: 'ARMED', // 'ARMED' | 'IN_MOTION' | 'SETTLING'
    settleCount: 0,
    lastDetectionTime: 0,
    lastClearTime: 0,
    frameCount: 0,
    lastFpsTime: performance.now()
  });

  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;

  const currentTurnLengthRef = useRef(currentTurnLength);
  currentTurnLengthRef.current = currentTurnLength;

  const visionArmedRef = useRef(visionArmed);
  visionArmedRef.current = visionArmed;

  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  const autoClearRef = useRef(autoClearOnPull);
  autoClearRef.current = autoClearOnPull;

  // Enumerate Windows 10 DirectShow / MediaFoundation USB cameras cleanly
  const scanWindowsCameras = useCallback(async (requestPermissionIfNeeded = true) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevs = devices.filter((d) => d.kind === 'videoinput');

      // If devices are present without deviceId/label (permission not yet granted), request a brief probe stream
      const needsPermission =
        requestPermissionIfNeeded &&
        (videoDevs.length === 0 || videoDevs.every((d) => !d.deviceId || !d.label));

      if (needsPermission && navigator.mediaDevices.getUserMedia) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          probe.getTracks().forEach((t) => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevs = devices.filter((d) => d.kind === 'videoinput');
        } catch {
          // No physical camera connected or permission denied
        }
      }

      const cleanDevices = videoDevs.filter((d) => Boolean(d.deviceId));
      setWindowsVideoDevices(cleanDevices);
      return cleanDevices;
    } catch {
      setWindowsVideoDevices([]);
      return [];
    }
  }, []);

  // Listen for hot-plugged USB cameras on Windows 10
  useEffect(() => {
    scanWindowsCameras(true);
    const handleDeviceChange = () => {
      scanWindowsCameras(false);
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [scanWindowsCameras]);

  // Resolve distinct physical deviceId for each slot (cam1, cam2, cam3)
  const resolveSlotDeviceIds = useCallback((videoDevs, cal) => {
    const result = { cam1: '', cam2: '', cam3: '' };
    if (!Array.isArray(videoDevs) || videoDevs.length === 0) {
      return result;
    }

    const usedIds = new Set();
    const cams = cal?.cameras || {};

    // First pass: honor explicitly saved deviceId if that camera is currently plugged in
    for (const slotKey of SLOT_KEYS) {
      const savedId = cams[slotKey]?.deviceId;
      if (savedId && videoDevs.some((d) => d.deviceId === savedId)) {
        result[slotKey] = savedId;
        usedIds.add(savedId);
      }
    }

    // Second pass: assign remaining physical USB cameras in order (0 -> cam1, 1 -> cam2, 2 -> cam3)
    for (const slotKey of SLOT_KEYS) {
      if (result[slotKey]) continue;
      const available = videoDevs.find((d) => !usedIds.has(d.deviceId));
      if (available) {
        result[slotKey] = available.deviceId;
        usedIds.add(available.deviceId);
      }
    }

    return result;
  }, []);

  // Open or update persistent MediaStreams for cam1, cam2, cam3 sequentially (prevents Windows USB hub contention)
  useEffect(() => {
    let isCancelled = false;

    async function syncCameraStreams() {
      const targetIds = resolveSlotDeviceIds(windowsVideoDevices, calibration);

      for (const slotKey of SLOT_KEYS) {
        if (isCancelled) return;
        const targetDeviceId = targetIds[slotKey];
        const currentDeviceId = openedDeviceIdsRef.current[slotKey];
        const currentStream = activeStreamsRef.current[slotKey];

        // If stream is already active for this deviceId, keep it running
        if (
          targetDeviceId &&
          targetDeviceId === currentDeviceId &&
          currentStream &&
          currentStream.active
        ) {
          continue;
        }

        // Stop previous stream for this slot if device changed or unplugged
        if (currentStream) {
          currentStream.getTracks().forEach((t) => t.stop());
          activeStreamsRef.current[slotKey] = null;
          openedDeviceIdsRef.current[slotKey] = '';
        }

        if (!targetDeviceId) {
          setCameraStatusMap((prev) => ({
            ...prev,
            [slotKey]: {
              ...prev[slotKey],
              active: false,
              resolution: null,
              error: windowsVideoDevices.length === 0 ? 'No physical USB camera detected' : 'Unassigned'
            }
          }));
          continue;
        }

        // Open stream with automatic fallback from 720p to 480p if USB controller bandwidth is tight
        const prefWidth = resolutionMode === '480p' ? 640 : 1280;
        const prefHeight = resolutionMode === '480p' ? 480 : 720;

        let stream = null;
        let openError = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: prefWidth },
              height: { ideal: prefHeight },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: false
          });
        } catch (err720) {
          try {
            // Fallback to 640x480 @ 15fps for multi-camera USB 2.0 hub compatibility
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: targetDeviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15, max: 20 }
              },
              audio: false
            });
          } catch (err480) {
            openError = err480?.message || err720?.message || 'USB camera busy or bandwidth limit reached';
          }
        }

        if (isCancelled) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (stream) {
          activeStreamsRef.current[slotKey] = stream;
          openedDeviceIdsRef.current[slotKey] = targetDeviceId;

          // Attach to hidden processing video element
          let videoEl = hiddenVideosRef.current[slotKey];
          if (!videoEl) {
            videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.autoplay = true;
            hiddenVideosRef.current[slotKey] = videoEl;
          }
          videoEl.srcObject = stream;
          videoEl.play().catch(() => {});

          const trackSettings = stream.getVideoTracks()[0]?.getSettings?.() || {};
          const resLabel =
            trackSettings.width && trackSettings.height
              ? `${trackSettings.width}x${trackSettings.height}`
              : `${prefWidth}x${prefHeight}`;

          // Reset frame buffers so a clean empty-board reference is captured immediately
          visionBuffersRef.current[slotKey].emptyFrame = null;
          visionBuffersRef.current[slotKey].baselineFrame = null;
          visionBuffersRef.current[slotKey].prevFrame = null;

          setCameraStatusMap((prev) => ({
            ...prev,
            [slotKey]: {
              ...prev[slotKey],
              active: true,
              resolution: resLabel,
              error: null
            }
          }));
        } else {
          setCameraStatusMap((prev) => ({
            ...prev,
            [slotKey]: {
              ...prev[slotKey],
              active: false,
              resolution: null,
              error: openError
            }
          }));
        }
      }

      if (!isCancelled) {
        setCameraStreams({ ...activeStreamsRef.current });
      }
    }

    syncCameraStreams();

    return () => {
      isCancelled = true;
    };
  }, [windowsVideoDevices, calibration?.cameras?.cam1?.deviceId, calibration?.cameras?.cam2?.deviceId, calibration?.cameras?.cam3?.deviceId, resolutionMode, resolveSlotDeviceIds]);

  // Cleanup all streams only when entire App unmounts
  useEffect(() => {
    return () => {
      for (const slotKey of SLOT_KEYS) {
        const s = activeStreamsRef.current[slotKey];
        if (s) {
          s.getTracks().forEach((t) => t.stop());
        }
      }
    };
  }, []);

  // Capture / Reset Empty Board Reference Frame across all active cameras
  const captureEmptyBoardReference = useCallback(() => {
    for (const slotKey of SLOT_KEYS) {
      const videoEl = hiddenVideosRef.current[slotKey];
      const stream = activeStreamsRef.current[slotKey];
      if (!videoEl || !stream || !stream.active || videoEl.readyState < 2) continue;

      let canvas = hiddenCanvasesRef.current[slotKey];
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = PROC_W;
        canvas.height = PROC_H;
        hiddenCanvasesRef.current[slotKey] = canvas;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(videoEl, 0, 0, PROC_W, PROC_H);
      const imgData = ctx.getImageData(0, 0, PROC_W, PROC_H).data;
      const lum = extractSmoothedLuminance(imgData, PROC_W, PROC_H);

      visionBuffersRef.current[slotKey].emptyFrame = new Float32Array(lum);
      visionBuffersRef.current[slotKey].baselineFrame = new Float32Array(lum);
      visionBuffersRef.current[slotKey].prevFrame = new Float32Array(lum);

      setCameraStatusMap((prev) => ({
        ...prev,
        [slotKey]: {
          ...prev[slotKey],
          hasReference: true,
          lastTip: null,
          diffScore: 0
        }
      }));
    }
    motionStateRef.current.phase = 'ARMED';
    motionStateRef.current.settleCount = 0;
    setVisionStateLabel('Armed (Empty Board Reference Captured)');
  }, []);

  // Real-time Multi-Camera Vision Processing Loop (~11 FPS)
  useEffect(() => {
    const intervalId = setInterval(() => {
      const cal = calibrationRef.current;
      if (!cal || !cal.cameras) return;

      const now = performance.now();
      motionStateRef.current.frameCount += 1;
      if (now - motionStateRef.current.lastFpsTime >= 1000) {
        const currentFps = Math.round(
          (motionStateRef.current.frameCount * 1000) / (now - motionStateRef.current.lastFpsTime)
        );
        setFps(currentFps);
        motionStateRef.current.frameCount = 0;
        motionStateRef.current.lastFpsTime = now;

        const activeCount = SLOT_KEYS.filter(
          (k) => activeStreamsRef.current[k] && activeStreamsRef.current[k].active
        ).length;
        if (onCameraRuntimeStatus) {
          onCameraRuntimeStatus({
            activeCamerasCount: activeCount,
            fps: currentFps,
            armed: visionArmedRef.current
          });
        }
      }

      if (!visionArmedRef.current) {
        setVisionStateLabel('Paused');
        return;
      }

      const activeSlots = [];
      const currentFrames = {};
      const invHomographies = {};
      let maxMotionRatio = 0;
      let totalChangedVsBaseline = 0;
      let totalChangedVsEmpty = 0;

      const pixelThreshold = Math.max(12, Math.min(65, Number(sensitivityRef.current) || 26));

      for (const slotKey of SLOT_KEYS) {
        const stream = activeStreamsRef.current[slotKey];
        const videoEl = hiddenVideosRef.current[slotKey];
        const camCfg = cal.cameras[slotKey];
        if (!stream || !stream.active || !videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
          continue;
        }
        if (!Array.isArray(camCfg?.points) || camCfg.points.length !== 4) {
          continue;
        }

        let canvas = hiddenCanvasesRef.current[slotKey];
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = PROC_W;
          canvas.height = PROC_H;
          hiddenCanvasesRef.current[slotKey] = canvas;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(videoEl, 0, 0, PROC_W, PROC_H);
        const rgba = ctx.getImageData(0, 0, PROC_W, PROC_H).data;
        const currLum = extractSmoothedLuminance(rgba, PROC_W, PROC_H);

        const buf = visionBuffersRef.current[slotKey];
        const ptsHash = JSON.stringify(camCfg.points);
        const invH = buildInverseBoardHomography(camCfg.points);
        invHomographies[slotKey] = invH;

        if (!buf.roiMask || buf.pointsHash !== ptsHash) {
          buf.roiMask = buildBoardRoiMask(invH, PROC_W, PROC_H);
          buf.pointsHash = ptsHash;
        }

        // Auto-initialize reference frame once camera stream stabilizes
        if (!buf.baselineFrame || !buf.emptyFrame || !buf.prevFrame) {
          buf.emptyFrame = new Float32Array(currLum);
          buf.baselineFrame = new Float32Array(currLum);
          buf.prevFrame = new Float32Array(currLum);
          setCameraStatusMap((prev) => ({
            ...prev,
            [slotKey]: { ...prev[slotKey], hasReference: true }
          }));
          continue;
        }

        activeSlots.push(slotKey);
        currentFrames[slotKey] = currLum;

        // Measure frame-to-frame motion and difference against baseline & empty board inside ROI
        let motionPixels = 0;
        let baselineDiffPixels = 0;
        let emptyDiffPixels = 0;
        let roiPixels = 0;

        for (let i = 0; i < currLum.length; i++) {
          if (!buf.roiMask[i]) continue;
          roiPixels++;
          if (Math.abs(currLum[i] - buf.prevFrame[i]) > pixelThreshold * 0.75) {
            motionPixels++;
          }
          if (Math.abs(currLum[i] - buf.baselineFrame[i]) > pixelThreshold) {
            baselineDiffPixels++;
          }
          if (Math.abs(currLum[i] - buf.emptyFrame[i]) > pixelThreshold) {
            emptyDiffPixels++;
          }
        }

        buf.prevFrame.set(currLum);

        const motionRatio = roiPixels > 0 ? motionPixels / roiPixels : 0;
        if (motionRatio > maxMotionRatio) {
          maxMotionRatio = motionRatio;
        }
        totalChangedVsBaseline += baselineDiffPixels;
        totalChangedVsEmpty += emptyDiffPixels;

        setCameraStatusMap((prev) => ({
          ...prev,
          [slotKey]: {
            ...prev[slotKey],
            diffScore: baselineDiffPixels
          }
        }));
      }

      if (activeSlots.length === 0) {
        setVisionStateLabel('Waiting for USB Cameras');
        return;
      }

      const ms = motionStateRef.current;

      // Motion state machine: detect when a dart/hand enters the frame, then wait for it to settle
      if (maxMotionRatio > 0.0035) {
        ms.phase = 'IN_MOTION';
        ms.settleCount = 0;
        setVisionStateLabel('Motion Detected...');
        return;
      }

      if (ms.phase === 'IN_MOTION') {
        ms.phase = 'SETTLING';
        ms.settleCount = 1;
        setVisionStateLabel('Settling Frame...');
        return;
      }

      if (ms.phase === 'SETTLING') {
        ms.settleCount += 1;
        const requiredSettle = cal?.visionSettings?.settleFrames ?? 3;
        if (ms.settleCount < requiredSettle) {
          return;
        }

        // Frame has settled after motion! Evaluate whether darts were pulled OR a new dart landed
        ms.phase = 'ARMED';
        ms.settleCount = 0;

        // 1. Check if darts were pulled from the board (board returned to matching emptyFrame)
        const avgEmptyDiff = totalChangedVsEmpty / activeSlots.length;
        const avgBaselineDiff = totalChangedVsBaseline / activeSlots.length;
        if (
          autoClearRef.current &&
          currentTurnLengthRef.current > 0 &&
          avgEmptyDiff < 14 &&
          avgBaselineDiff > 22 &&
          now - ms.lastClearTime > 1500
        ) {
          ms.lastClearTime = now;
          for (const slotKey of activeSlots) {
            const currLum = currentFrames[slotKey];
            visionBuffersRef.current[slotKey].emptyFrame.set(currLum);
            visionBuffersRef.current[slotKey].baselineFrame.set(currLum);
          }
          setVisionStateLabel('Board Cleared — Next Turn');
          if (onBoardCleared) {
            onBoardCleared();
          }
          return;
        }

        // 2. Check if a new dart landed on the board (cooldown 650ms between throws)
        if (now - ms.lastDetectionTime < 650) {
          return;
        }

        const perCameraDetections = [];
        const minContourPixels = cal?.visionSettings?.minContourPixels ?? 14;

        for (const slotKey of activeSlots) {
          const currLum = currentFrames[slotKey];
          const buf = visionBuffersRef.current[slotKey];
          const camCfg = cal.cameras[slotKey];
          const invH = invHomographies[slotKey];

          const diffMask = new Uint8Array(PROC_W * PROC_H);
          const diffWeights = new Float32Array(PROC_W * PROC_H);

          for (let i = 0; i < currLum.length; i++) {
            if (!buf.roiMask[i]) continue;
            const d = Math.abs(currLum[i] - buf.baselineFrame[i]);
            if (d > pixelThreshold) {
              diffMask[i] = 1;
              diffWeights[i] = d;
            }
          }

          const mountAngleDeg =
            typeof camCfg.mountAngleDeg === 'number'
              ? camCfg.mountAngleDeg
              : DEFAULT_ANGLES[slotKey];

          const detected = detectDartFromDiffBuffer({
            diffMask,
            diffWeights,
            width: PROC_W,
            height: PROC_H,
            invHomography: invH,
            mountAngleDeg,
            minContourPixels
          });

          if (detected && Math.hypot(detected.boardTip.x, detected.boardTip.y) <= 1.22) {
            perCameraDetections.push({
              cameraId: slotKey,
              mountAngleDeg,
              ...detected
            });

            setCameraStatusMap((prev) => ({
              ...prev,
              [slotKey]: {
                ...prev[slotKey],
                lastTip: detected.imageTip
              }
            }));
          }
        }

        if (perCameraDetections.length > 0) {
          ms.lastDetectionTime = now;
          // Update baselineFrame on all active cameras to include the newly landed dart
          for (const slotKey of activeSlots) {
            visionBuffersRef.current[slotKey].baselineFrame.set(currentFrames[slotKey]);
          }
          setVisionStateLabel(
            `Dart Triangulated (${perCameraDetections.length}/${activeSlots.length} Cam${
              perCameraDetections.length > 1 ? 's' : ''
            })`
          );
          if (onVisionDetect) {
            onVisionDetect({
              detections: perCameraDetections
            });
          }
        } else {
          setVisionStateLabel('Armed & Monitoring');
        }
      }
    }, 90);

    return () => clearInterval(intervalId);
  }, [onVisionDetect, onBoardCleared, onCameraRuntimeStatus]);

  /**
   * End-to-End Synthetic 3-Camera Computer Vision Test:
   * Renders a synthetic 3D dart (tip at z=0, flight sticking out to z=0.38) onto 3 offscreen
   * camera buffers using each camera's mountAngleDeg perspective projection, runs the actual
   * pixel-differencing, connected-component contour extraction, PCA axis orientation, and
   * 4-point inverse homography tip detection across all 3 cameras, and sends the 3-camera
   * detections to the backend triangulation scorer!
   */
  const runSyntheticVisionTest = useCallback(
    (segment = 20, multiplier = 3) => {
      const cal = calibrationRef.current;
      if (!cal || !cal.cameras) return;

      // Compute canonical board coordinate (bx, by) for target segment & multiplier
      let targetBx = 0;
      let targetBy = 0;
      if (segment === 25) {
        const r = multiplier === 2 ? 0.015 : 0.075;
        targetBx = 0;
        targetBy = -r;
      } else if (segment === 0 || multiplier === 0) {
        targetBx = 0;
        targetBy = -1.08;
      } else {
        const idx = BOARD_SECTORS.indexOf(segment);
        const angleDeg = (idx >= 0 ? idx : 0) * 18;
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        const r =
          multiplier === 3
            ? (BOARD_RADII.TRIPLE_INNER + BOARD_RADII.TRIPLE_OUTER) * 0.5
            : multiplier === 2
            ? (BOARD_RADII.DOUBLE_INNER + BOARD_RADII.DOUBLE_OUTER) * 0.5
            : 0.78;
        targetBx = Math.cos(rad) * r;
        targetBy = Math.sin(rad) * r;
      }

      const detections = [];
      for (const slotKey of SLOT_KEYS) {
        const camCfg = cal.cameras[slotKey];
        const mountAngleDeg =
          typeof camCfg?.mountAngleDeg === 'number'
            ? camCfg.mountAngleDeg
            : DEFAULT_ANGLES[slotKey];
        const pts =
          Array.isArray(camCfg?.points) && camCfg.points.length === 4
            ? camCfg.points
            : null;
        if (!pts) continue;

        const invH = buildInverseBoardHomography(pts);
        if (!invH) continue;

        // Project the 3D dart tip (z = 0) and 3D dart flight (z = 0.35 sticking out of board) into this camera
        const tipImg = project3DPointToCamera(targetBx, targetBy, 0, mountAngleDeg);
        const tailImg = project3DPointToCamera(targetBx, targetBy, 0.35, mountAngleDeg);

        // Rasterize the synthetic dart onto a PROC_W x PROC_H difference buffer
        const diffMask = new Uint8Array(PROC_W * PROC_H);
        const diffWeights = new Float32Array(PROC_W * PROC_H);

        const steps = 28;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const u = tipImg.x + (tailImg.x - tipImg.x) * t;
          const v = tipImg.y + (tailImg.y - tipImg.y) * t;
          const cx = Math.round(u * PROC_W);
          const cy = Math.round(v * PROC_H);
          const halfThickness = t > 0.65 ? 2 : 1; // flight is wider than tip

          for (let dy = -halfThickness; dy <= halfThickness; dy++) {
            for (let dx = -halfThickness; dx <= halfThickness; dx++) {
              const px = cx + dx;
              const py = cy + dy;
              if (px >= 2 && px < PROC_W - 2 && py >= 2 && py < PROC_H - 2) {
                const idx = py * PROC_W + px;
                diffMask[idx] = 1;
                diffWeights[idx] = 85;
              }
            }
          }
        }

        const detected = detectDartFromDiffBuffer({
          diffMask,
          diffWeights,
          width: PROC_W,
          height: PROC_H,
          invHomography: invH,
          mountAngleDeg,
          minContourPixels: 10
        });

        if (detected) {
          detections.push({
            cameraId: slotKey,
            mountAngleDeg,
            ...detected
          });
        }
      }

      if (detections.length > 0 && onVisionDetect) {
        onVisionDetect({
          synthetic: true,
          detections
        });
      }
    },
    [onVisionDetect]
  );

  const assignDeviceToSlot = useCallback(
    async (slotKey, deviceId) => {
      const dev = windowsVideoDevices.find((d) => d.deviceId === deviceId);
      const deviceLabel = dev?.label || `Windows USB Camera (${slotKey.toUpperCase()})`;
      if (onAssignCameraDevice) {
        await onAssignCameraDevice(slotKey, deviceId, deviceLabel);
      }
    },
    [windowsVideoDevices, onAssignCameraDevice]
  );

  return {
    windowsVideoDevices,
    cameraStreams,
    cameraStatusMap,
    visionArmed,
    setVisionArmed,
    sensitivity,
    setSensitivity,
    autoClearOnPull,
    setAutoClearOnPull,
    resolutionMode,
    setResolutionMode,
    visionStateLabel,
    fps,
    scanWindowsCameras,
    captureEmptyBoardReference,
    runSyntheticVisionTest,
    assignDeviceToSlot
  };
}
