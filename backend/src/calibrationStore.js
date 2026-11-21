const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '../../config/calibration.json');

const DEFAULT_CALIBRATION = {
  updatedAt: new Date().toISOString(),
  boardReferencePoints: [
    { id: 'p1', label: '20 / 1 Double Intersection (Top)', angleDeg: 9, normalizedBoard: { x: 0.5266, y: 0.3318 } },
    { id: 'p2', label: '6 / 10 Double Intersection (Right)', angleDeg: 99, normalizedBoard: { x: 0.6682, y: 0.5266 } },
    { id: 'p3', label: '3 / 19 Double Intersection (Bottom)', angleDeg: 189, normalizedBoard: { x: 0.4734, y: 0.6682 } },
    { id: 'p4', label: '11 / 14 Double Intersection (Left)', angleDeg: 279, normalizedBoard: { x: 0.3318, y: 0.4734 } }
  ],
  cameras: {
    cam1: {
      id: 'cam1',
      name: "Camera 1 (10 o'clock)",
      position: "10 o'clock",
      devicePath: process.env.CAMERA_1_DEVICE || 'USB Camera 0',
      streamUrl: process.env.CAMERA_1_STREAM_URL || '',
      calibrated: true,
      showOverlay: true,
      points: [
        { x: 0.525, y: 0.165, label: '20/1' },
        { x: 0.835, y: 0.525, label: '6/10' },
        { x: 0.475, y: 0.835, label: '3/19' },
        { x: 0.165, y: 0.475, label: '11/14' }
      ]
    },
    cam2: {
      id: 'cam2',
      name: "Camera 2 (2 o'clock)",
      position: "2 o'clock",
      devicePath: process.env.CAMERA_2_DEVICE || 'USB Camera 1',
      streamUrl: process.env.CAMERA_2_STREAM_URL || '',
      calibrated: true,
      showOverlay: true,
      points: [
        { x: 0.530, y: 0.170, label: '20/1' },
        { x: 0.830, y: 0.530, label: '6/10' },
        { x: 0.470, y: 0.830, label: '3/19' },
        { x: 0.170, y: 0.470, label: '11/14' }
      ]
    },
    cam3: {
      id: 'cam3',
      name: "Camera 3 (6 o'clock)",
      position: "6 o'clock",
      devicePath: process.env.CAMERA_3_DEVICE || 'USB Camera 2',
      streamUrl: process.env.CAMERA_3_STREAM_URL || '',
      calibrated: true,
      showOverlay: true,
      points: [
        { x: 0.522, y: 0.168, label: '20/1' },
        { x: 0.832, y: 0.522, label: '6/10' },
        { x: 0.478, y: 0.832, label: '3/19' },
        { x: 0.168, y: 0.478, label: '11/14' }
      ]
    }
  }
};

function normalizeLegacyDeviceNames(camerasObj) {
  const normalized = { ...camerasObj };
  const defaults = ['USB Camera 0', 'USB Camera 1', 'USB Camera 2'];
  ['cam1', 'cam2', 'cam3'].forEach((key, idx) => {
    if (normalized[key] && String(normalized[key].devicePath || '').startsWith('/dev/')) {
      normalized[key].devicePath = defaults[idx];
    }
  });
  return normalized;
}

function loadCalibration() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        ...DEFAULT_CALIBRATION,
        ...parsed,
        cameras: normalizeLegacyDeviceNames({
          ...DEFAULT_CALIBRATION.cameras,
          ...(parsed.cameras || {})
        })
      };
    }
  } catch (err) {
    console.warn('[CalibrationStore] Failed to read calibration.json, using default:', err.message);
  }
  saveCalibration(DEFAULT_CALIBRATION);
  return JSON.parse(JSON.stringify(DEFAULT_CALIBRATION));
}

function saveCalibration(newConfig) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const merged = {
      ...DEFAULT_CALIBRATION,
      ...newConfig,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('[CalibrationStore] Error saving calibration.json:', err.message);
    throw err;
  }
}

function resetCalibrationPoints(cameraId = null, preset = 'empty') {
  const current = loadCalibration();
  const targetCameras = cameraId && current.cameras[cameraId] ? [cameraId] : Object.keys(current.cameras);

  for (const camKey of targetCameras) {
    if (preset === 'default') {
      current.cameras[camKey].points = JSON.parse(JSON.stringify(DEFAULT_CALIBRATION.cameras[camKey].points));
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
  loadCalibration,
  saveCalibration,
  resetCalibrationPoints
};
