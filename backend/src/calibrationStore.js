const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../config/calibration.json');

const REFERENCE_ANGLES_DEG = [
  { angleDeg: 9, label: '20/1' },
  { angleDeg: 99, label: '6/10' },
  { angleDeg: 189, label: '3/19' },
  { angleDeg: 279, label: '11/14' }
];

/**
 * Projects the 4 canonical outer-double-ring intersections (20/1, 6/10, 3/19, 11/14)
 * from a 3D camera mounted on the ring light at `mountAngleDeg` (0 = 12 o'clock, clockwise)
 * onto a normalized 4:3 camera image [0..1] x [0..1].
 */
function computePerspectivePresetPoints(mountAngleDeg = 345) {
  const theta = (mountAngleDeg * Math.PI) / 180;
  const Rc = 1.35; // Ring mount radius relative to outer double ring (1.0)
  const Zc = 2.6;  // Camera stand-off distance in front of the dartboard plane
  const fy = 0.88;
  const fx = fy / (4 / 3);

  const Cx = Rc * Math.sin(theta);
  const Cy = -Rc * Math.cos(theta);
  const Cz = Zc;

  // Forward unit vector pointing from camera to bullseye (0, 0, 0)
  const fLen = Math.hypot(Cx, Cy, Cz);
  const f = { x: -Cx / fLen, y: -Cy / fLen, z: -Cz / fLen };

  // Image right vector: normalize(f x d_ref), where d_ref = (0, 1, 0)
  const rx = -f.z;
  const ry = 0;
  const rz = f.x;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  const r = { x: rx / rLen, y: ry / rLen, z: rz / rLen };

  // Image down vector: r x f
  const d = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x
  };

  return REFERENCE_ANGLES_DEG.map(({ angleDeg, label }) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const bx = Math.cos(rad);
    const by = Math.sin(rad);

    const vx = bx - Cx;
    const vy = by - Cy;
    const vz = 0 - Cz;

    const xCam = vx * r.x + vy * r.y + vz * r.z;
    const yCam = vx * d.x + vy * d.y + vz * d.z;
    const zCam = Math.max(0.2, vx * f.x + vy * f.y + vz * f.z);

    const u = Math.max(0.05, Math.min(0.95, 0.5 + fx * (xCam / zCam)));
    const v = Math.max(0.05, Math.min(0.95, 0.5 + fy * (yCam / zCam)));

    return {
      x: Number(u.toFixed(4)),
      y: Number(v.toFixed(4)),
      label
    };
  });
}

const RING_LAYOUT_PRESETS = {
  ring270_left5: {
    id: 'ring270_left5',
    ringType: '270-open-bottom',
    topBarAt12: true,
    topCameraSide: 'left-5',
    openBottomGapDeg: { start: 135, end: 225 },
    label: '270° Open-Bottom Ring · Top Left of Bar (toward 5)',
    cameras: {
      cam1: {
        name: 'Camera 1',
        position: '11:30 (toward 5)',
        mountAngleDeg: 345
      },
      cam2: {
        name: 'Camera 2',
        position: '3:40 (over 10)',
        mountAngleDeg: 110
      },
      cam3: {
        name: 'Camera 3',
        position: '7:50 (over 16)',
        mountAngleDeg: 235
      }
    }
  },
  ring270_right1: {
    id: 'ring270_right1',
    ringType: '270-open-bottom',
    topBarAt12: true,
    topCameraSide: 'right-1',
    openBottomGapDeg: { start: 135, end: 225 },
    label: '270° Open-Bottom Ring · Top Right of Bar (toward 1)',
    cameras: {
      cam1: {
        name: 'Camera 1',
        position: '12:30 (toward 1)',
        mountAngleDeg: 15
      },
      cam2: {
        name: 'Camera 2',
        position: '4:10 (over 15)',
        mountAngleDeg: 125
      },
      cam3: {
        name: 'Camera 3',
        position: '8:20 (over 8)',
        mountAngleDeg: 250
      }
    }
  }
};

const DEFAULT_VISION_SETTINGS = {
  sensitivity: 26,
  minContourPixels: 16,
  settleFrames: 3,
  autoClearOnPull: true,
  resolutionMode: '720p' // '720p' | '480p'
};

function buildCamerasForLayout(layoutId = 'ring270_left5', existingCameras = {}) {
  const preset = RING_LAYOUT_PRESETS[layoutId] || RING_LAYOUT_PRESETS.ring270_left5;
  const envDefaults = [
    { key: 'cam1', device: process.env.CAMERA_1_DEVICE || 'USB Camera 0', stream: process.env.CAMERA_1_STREAM_URL || '' },
    { key: 'cam2', device: process.env.CAMERA_2_DEVICE || 'USB Camera 1', stream: process.env.CAMERA_2_STREAM_URL || '' },
    { key: 'cam3', device: process.env.CAMERA_3_DEVICE || 'USB Camera 2', stream: process.env.CAMERA_3_STREAM_URL || '' }
  ];

  const cameras = {};
  for (const { key, device, stream } of envDefaults) {
    const camPreset = preset.cameras[key];
    const prev = existingCameras[key] || {};
    cameras[key] = {
      id: key,
      name: camPreset.name,
      position: camPreset.position,
      mountAngleDeg: camPreset.mountAngleDeg,
      devicePath: prev.devicePath && !String(prev.devicePath).startsWith('/dev/') ? prev.devicePath : device,
      deviceId: typeof prev.deviceId === 'string' ? prev.deviceId : '',
      deviceLabel: typeof prev.deviceLabel === 'string' ? prev.deviceLabel : '',
      streamUrl: typeof prev.streamUrl === 'string' ? prev.streamUrl : stream,
      calibrated: true,
      showOverlay: prev.showOverlay !== false,
      points: computePerspectivePresetPoints(camPreset.mountAngleDeg)
    };
  }
  return cameras;
}

const DEFAULT_LAYOUT_ID = 'ring270_left5';

const DEFAULT_CALIBRATION = {
  updatedAt: new Date().toISOString(),
  ringLayout: {
    id: RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID].id,
    ringType: RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID].ringType,
    topBarAt12: RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID].topBarAt12,
    topCameraSide: RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID].topCameraSide,
    openBottomGapDeg: RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID].openBottomGapDeg,
    label: RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID].label
  },
  visionSettings: { ...DEFAULT_VISION_SETTINGS },
  boardReferencePoints: [
    { id: 'p1', label: '20 / 1 Double Intersection (Top)', angleDeg: 9, normalizedBoard: { x: 0.5266, y: 0.3318 } },
    { id: 'p2', label: '6 / 10 Double Intersection (Right)', angleDeg: 99, normalizedBoard: { x: 0.6682, y: 0.5266 } },
    { id: 'p3', label: '3 / 19 Double Intersection (Bottom)', angleDeg: 189, normalizedBoard: { x: 0.4734, y: 0.6682 } },
    { id: 'p4', label: '11 / 14 Double Intersection (Left)', angleDeg: 279, normalizedBoard: { x: 0.3318, y: 0.4734 } }
  ],
  cameras: buildCamerasForLayout(DEFAULT_LAYOUT_ID)
};

function sanitizeCamerasObject(camerasObj) {
  const normalized = { ...camerasObj };
  const defaults = ['USB Camera 0', 'USB Camera 1', 'USB Camera 2'];
  const defaultAngles = [345, 110, 235];
  ['cam1', 'cam2', 'cam3'].forEach((key, idx) => {
    if (normalized[key]) {
      if (String(normalized[key].devicePath || '').startsWith('/dev/')) {
        normalized[key].devicePath = defaults[idx];
      }
      if (typeof normalized[key].mountAngleDeg !== 'number') {
        normalized[key].mountAngleDeg = defaultAngles[idx];
      }
      if (typeof normalized[key].deviceId !== 'string') {
        normalized[key].deviceId = '';
      }
      if (typeof normalized[key].deviceLabel !== 'string') {
        normalized[key].deviceLabel = '';
      }
    }
  });
  return normalized;
}

let memoryCalibrationCache = null;

function loadCalibration() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      const layoutId = (parsed.ringLayout && parsed.ringLayout.id) || DEFAULT_LAYOUT_ID;
      const preset = RING_LAYOUT_PRESETS[layoutId] || RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID];

      const loaded = {
        ...DEFAULT_CALIBRATION,
        ...parsed,
        ringLayout: {
          ...DEFAULT_CALIBRATION.ringLayout,
          ...(parsed.ringLayout || {}),
          label: preset.label
        },
        visionSettings: {
          ...DEFAULT_VISION_SETTINGS,
          ...(parsed.visionSettings || {})
        },
        cameras: sanitizeCamerasObject({
          ...DEFAULT_CALIBRATION.cameras,
          ...(parsed.cameras || {})
        })
      };
      if (!memoryCalibrationCache) {
        memoryCalibrationCache = loaded;
      }
      return memoryCalibrationCache;
    }
  } catch (err) {
    console.warn('[CalibrationStore] Failed to read calibration.json, using default:', err.message);
  }
  if (memoryCalibrationCache) {
    return memoryCalibrationCache;
  }
  return saveCalibration(DEFAULT_CALIBRATION);
}

function saveCalibration(newConfig) {
  const now = new Date().toISOString();
  let currentCameras = (memoryCalibrationCache && memoryCalibrationCache.cameras) || {};
  let currentVisionSettings = {
    ...DEFAULT_VISION_SETTINGS,
    ...((memoryCalibrationCache && memoryCalibrationCache.visionSettings) || {})
  };

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      currentCameras = { ...(existing.cameras || {}), ...currentCameras };
      currentVisionSettings = {
        ...DEFAULT_VISION_SETTINGS,
        ...(existing.visionSettings || {}),
        ...currentVisionSettings
      };
    } catch {
      // ignore read error
    }
  }

  const incomingCameras = (newConfig && newConfig.cameras) || {};
  const mergedCameras = sanitizeCamerasObject({ ...currentCameras, ...incomingCameras });

  ['cam1', 'cam2', 'cam3'].forEach((id, idx) => {
    const num = idx + 1;
    if (mergedCameras[id]) {
      mergedCameras[id] = {
        ...(currentCameras[id] || {}),
        ...(incomingCameras[id] || {}),
        name: `Camera ${num}`
      };
      const points = mergedCameras[id].points;
      const isCalibrated = Array.isArray(points) && points.length === 4;
      mergedCameras[id].calibrated = isCalibrated;
      if (isCalibrated && !mergedCameras[id].savedAt) {
        mergedCameras[id].savedAt = now;
      }
    }
  });

  const layoutId =
    (newConfig && newConfig.ringLayout && newConfig.ringLayout.id) || DEFAULT_LAYOUT_ID;
  const preset = RING_LAYOUT_PRESETS[layoutId] || RING_LAYOUT_PRESETS[DEFAULT_LAYOUT_ID];

  const merged = {
    ...DEFAULT_CALIBRATION,
    ...newConfig,
    cameras: mergedCameras,
    ringLayout: {
      ...DEFAULT_CALIBRATION.ringLayout,
      ...((newConfig && newConfig.ringLayout) || {}),
      label: preset.label
    },
    visionSettings: {
      ...currentVisionSettings,
      ...((newConfig && newConfig.visionSettings) || {})
    },
    updatedAt: now
  };

  memoryCalibrationCache = merged;

  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CalibrationStore] Warning: kept calibration in memory (disk write skipped):', err.message);
  }

  return merged;
}

function saveSingleCamera(cameraId, cameraData) {
  const current = loadCalibration();
  const now = new Date().toISOString();
  const camNum = cameraId === 'cam1' ? 1 : cameraId === 'cam2' ? 2 : 3;

  if (!current.cameras) {
    current.cameras = {};
  }

  const existingCam = current.cameras[cameraId] || {};
  const points = (cameraData && cameraData.points) || existingCam.points || [];
  const isCalibrated = Array.isArray(points) && points.length === 4;

  current.cameras[cameraId] = {
    ...existingCam,
    ...cameraData,
    id: cameraId,
    name: `Camera ${camNum}`,
    points,
    calibrated: isCalibrated,
    savedAt: now
  };

  return saveCalibration(current);
}

function resetCalibrationPoints(cameraId = null, preset = 'empty', layoutId = null) {
  const current = loadCalibration();

  if (layoutId && RING_LAYOUT_PRESETS[layoutId]) {
    const layoutDef = RING_LAYOUT_PRESETS[layoutId];
    current.ringLayout = {
      id: layoutDef.id,
      ringType: layoutDef.ringType,
      topBarAt12: layoutDef.topBarAt12,
      topCameraSide: layoutDef.topCameraSide,
      openBottomGapDeg: layoutDef.openBottomGapDeg,
      label: layoutDef.label
    };
    current.cameras = buildCamerasForLayout(layoutId, current.cameras);
    if (preset === 'empty') {
      for (const camKey of Object.keys(current.cameras)) {
        current.cameras[camKey].points = [];
        current.cameras[camKey].calibrated = false;
      }
    }
    return saveCalibration(current);
  }

  const targetCameras = cameraId && current.cameras[cameraId] ? [cameraId] : Object.keys(current.cameras);

  for (const camKey of targetCameras) {
    if (preset === 'default') {
      const angle =
        typeof current.cameras[camKey].mountAngleDeg === 'number'
          ? current.cameras[camKey].mountAngleDeg
          : DEFAULT_CALIBRATION.cameras[camKey].mountAngleDeg;
      current.cameras[camKey].points = computePerspectivePresetPoints(angle);
      current.cameras[camKey].calibrated = true;
    } else {
      current.cameras[camKey].points = [];
      current.cameras[camKey].calibrated = false;
    }
  }

  return saveCalibration(current);
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_CALIBRATION,
  DEFAULT_VISION_SETTINGS,
  RING_LAYOUT_PRESETS,
  computePerspectivePresetPoints,
  loadCalibration,
  saveCalibration,
  saveSingleCamera,
  resetCalibrationPoints
};
