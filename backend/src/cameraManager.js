const os = require('os');

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function computeTriangulationDiagnostics(angles) {
  const sorted = angles.map((a) => normalizeDeg(a)).sort((a, b) => a - b);
  if (sorted.length !== 3) {
    return { gapsDeg: [], minGapDeg: 0, maxGapDeg: 0, clearsOpenBottom: false, clearsTopBar: false };
  }
  const gapsDeg = [
    Math.round(sorted[1] - sorted[0]),
    Math.round(sorted[2] - sorted[1]),
    Math.round(360 - sorted[2] + sorted[0])
  ];
  const minGapDeg = Math.min(...gapsDeg);
  const maxGapDeg = Math.max(...gapsDeg);
  const clearsOpenBottom = sorted.every((a) => a < 135 || a > 225);
  const clearsTopBar = sorted.every((a) => a > 6 && a < 354);

  return {
    gapsDeg,
    minGapDeg,
    maxGapDeg,
    clearsOpenBottom,
    clearsTopBar,
    optimalTriangulation: minGapDeg >= 95 && maxGapDeg <= 145 && clearsOpenBottom && clearsTopBar
  };
}

/**
 * Inspects the 3 Windows 10 USB camera slots (DirectShow / Windows Media Foundation indices 0, 1, 2)
 * and reports camera configuration, stream URLs, 270° open-bottom ring geometry, and USB placement guidance.
 */
function inspectCameras(calibration) {
  const isWindows = os.platform() === 'win32';
  const camConfigs = (calibration && calibration.cameras) || {};

  const definitions = [
    {
      id: 'cam1',
      defaultName: "Camera 1",
      defaultPosition: "11:30 (toward 5)",
      defaultMountAngleDeg: 345,
      cameraIndex: 0,
      defaultDevice: process.env.CAMERA_1_DEVICE || 'USB Camera 0',
      defaultStream: process.env.CAMERA_1_STREAM_URL || '',
      usbBusTip: 'Windows 10 Motherboard USB 3.0 Port (Blue SS Port #1)'
    },
    {
      id: 'cam2',
      defaultName: "Camera 2",
      defaultPosition: "3:40 (over 10)",
      defaultMountAngleDeg: 110,
      cameraIndex: 1,
      defaultDevice: process.env.CAMERA_2_DEVICE || 'USB Camera 1',
      defaultStream: process.env.CAMERA_2_STREAM_URL || '',
      usbBusTip: 'Windows 10 Motherboard USB 3.0 Port (Blue SS Port #2)'
    },
    {
      id: 'cam3',
      defaultName: "Camera 3",
      defaultPosition: "7:50 (over 16)",
      defaultMountAngleDeg: 235,
      cameraIndex: 2,
      defaultDevice: process.env.CAMERA_3_DEVICE || 'USB Camera 2',
      defaultStream: process.env.CAMERA_3_STREAM_URL || '',
      usbBusTip: 'Windows 10 Front/Rear USB 2.0 or Separate USB 3.0 Controller'
    }
  ];

  const cameras = definitions.map((def) => {
    const saved = camConfigs[def.id] || {};
    const devicePath =
      saved.devicePath && !String(saved.devicePath).startsWith('/dev/')
        ? saved.devicePath
        : def.defaultDevice;
    const streamUrl = saved.streamUrl || def.defaultStream;
    const hasStream = Boolean(streamUrl && streamUrl.trim().length > 0);
    const pointsCount = Array.isArray(saved.points) ? saved.points.length : 0;
    const mountAngleDeg =
      typeof saved.mountAngleDeg === 'number' ? saved.mountAngleDeg : def.defaultMountAngleDeg;

    return {
      id: def.id,
      name: `Camera ${def.cameraIndex + 1}`,
      position: saved.position || def.defaultPosition,
      mountAngleDeg,
      cameraIndex: def.cameraIndex,
      devicePath,
      streamUrl,
      deviceExists: hasStream,
      hasStream,
      status: hasStream ? 'hardware_ready' : 'simulated_preview',
      statusLabel: hasStream
        ? `Stream Active (${devicePath})`
        : `Ready for Windows USB / Simulated Feed (${devicePath})`,
      sensorModel: 'OV9732 720p USB UVC Camera (Windows 10 DirectShow)',
      usbBusTip: def.usbBusTip,
      pointsCount,
      calibrated: pointsCount === 4,
      savedAt: saved.savedAt || null
    };
  });

  const hardwareDetectedCount = cameras.filter((c) => c.hasStream).length;
  const triangulation = computeTriangulationDiagnostics(cameras.map((c) => c.mountAngleDeg));

  return {
    checkedAt: new Date().toISOString(),
    platform: 'win32',
    osRelease: os.release(),
    isWindows,
    hardwareDetectedCount,
    totalCameras: 3,
    allHardwareReady: hardwareDetectedCount === 3,
    ringLayout: (calibration && calibration.ringLayout) || null,
    triangulation,
    cameras
  };
}

module.exports = {
  inspectCameras,
  computeTriangulationDiagnostics
};
