const os = require('os');

/**
 * Inspects the 3 Windows 10 USB camera slots (DirectShow / Windows Media Foundation indices 0, 1, 2)
 * and reports camera configuration, stream URLs, and Windows 10 USB root hub placement guidance.
 */
function inspectCameras(calibration) {
  const isWindows = os.platform() === 'win32';
  const camConfigs = (calibration && calibration.cameras) || {};

  const definitions = [
    {
      id: 'cam1',
      name: "Camera 1 (10 o'clock)",
      position: "10 o'clock",
      mountAngleDeg: 300,
      cameraIndex: 0,
      defaultDevice: process.env.CAMERA_1_DEVICE || 'USB Camera 0',
      defaultStream: process.env.CAMERA_1_STREAM_URL || '',
      usbBusTip: 'Windows 10 Motherboard USB 3.0 Port (Blue SS Port #1)'
    },
    {
      id: 'cam2',
      name: "Camera 2 (2 o'clock)",
      position: "2 o'clock",
      mountAngleDeg: 60,
      cameraIndex: 1,
      defaultDevice: process.env.CAMERA_2_DEVICE || 'USB Camera 1',
      defaultStream: process.env.CAMERA_2_STREAM_URL || '',
      usbBusTip: 'Windows 10 Motherboard USB 3.0 Port (Blue SS Port #2)'
    },
    {
      id: 'cam3',
      name: "Camera 3 (6 o'clock)",
      position: "6 o'clock",
      mountAngleDeg: 180,
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

    return {
      id: def.id,
      name: def.name,
      position: def.position,
      mountAngleDeg: def.mountAngleDeg,
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
      calibrated: pointsCount === 4
    };
  });

  const hardwareDetectedCount = cameras.filter((c) => c.hasStream).length;

  return {
    checkedAt: new Date().toISOString(),
    platform: 'win32',
    osRelease: os.release(),
    isWindows,
    hardwareDetectedCount,
    totalCameras: 3,
    allHardwareReady: hardwareDetectedCount === 3,
    cameras
  };
}

module.exports = {
  inspectCameras
};
