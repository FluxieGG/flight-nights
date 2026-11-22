import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import TopNavBar from './components/TopNavBar';
import LiveScoreView from './components/LiveScoreView';
import CalibrationView from './components/CalibrationView';
import SetupWizardModal from './components/SetupWizardModal';
import DebugView from './components/DebugView';
import DevPinModal from './components/DevPinModal';
import { useVisionScorer } from './utils/visionEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'calibration' | 'debug'
  const [simulateMode, setSimulateMode] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDevUnlocked, setIsDevUnlocked] = useState(false);
  const [isDevPinModalOpen, setIsDevPinModalOpen] = useState(false);

  const [appState, setAppState] = useState({
    turnNumber: 1,
    currentTurn: [],
    currentTurnTotal: 0,
    turnHistory: [],
    accuracyLog: [],
    lastDetectedDart: null,
    scorerEngine: {
      engineName: 'OpenCV-Darts Triangulation Engine',
      algorithm: '4-Point Homography + 3-Camera Ray Triangulation',
      status: 'ready',
      ready: true,
      connected: true,
      armed: true,
      activeCamerasCount: 0,
      calibratedCamerasCount: 3,
      fps: 0
    },
    calibration: null,
    cameraDiagnostics: null
  });

  const [highlightedDart, setHighlightedDart] = useState(null);
  const highlightTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const triggerDartHighlight = useCallback((dart) => {
    setHighlightedDart(dart);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedDart(null);
    }, 2400);
  }, []);

  useEffect(() => {
    fetch('/api/state')
      .then((res) => res.json())
      .then((data) => {
        setAppState((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {
        // Socket.IO will sync once backend is reachable
      });

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('state:init', (fullState) => {
      setAppState((prev) => ({ ...prev, ...fullState }));
    });

    socket.on('state:update', (fullState) => {
      setAppState((prev) => ({ ...prev, ...fullState }));
      setHighlightedDart(fullState.lastDetectedDart || null);
    });

    socket.on('dart:detected', ({ dart, state }) => {
      setAppState((prev) => ({ ...prev, ...state }));
      triggerDartHighlight(dart);
    });

    socket.on('scorer:status', (statusObj) => {
      setAppState((prev) => ({
        ...prev,
        scorerEngine: statusObj
      }));
    });

    socket.on('calibration:updated', ({ calibration, state }) => {
      setAppState((prev) => ({
        ...prev,
        ...(state || {}),
        calibration
      }));
    });

    socket.on('cameras:diagnostics', (diagnostics) => {
      setAppState((prev) => ({
        ...prev,
        cameraDiagnostics: diagnostics
      }));
    });

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      socket.disconnect();
    };
  }, [triggerDartHighlight]);

  // Handlers
  const handleSimulateDart = useCallback(
    async (payload) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('dart:simulate', payload);
        return;
      }
      const res = await fetch('/api/dart/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setAppState((prev) => ({ ...prev, ...data.state }));
        triggerDartHighlight(data.dart);
      }
    },
    [triggerDartHighlight]
  );

  const handleVisionDetect = useCallback(
    async (payload) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('vision:detect', payload);
        return;
      }
      const res = await fetch('/api/vision/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setAppState((prev) => ({ ...prev, ...data.state }));
        triggerDartHighlight(data.dart);
      }
    },
    [triggerDartHighlight]
  );

  const handleCameraRuntimeStatus = useCallback((runtimeStatus) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('vision:camera_status', runtimeStatus);
    }
  }, []);

  const handleUndoLastDart = useCallback(async () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('turn:undo');
      return;
    }
    const res = await fetch('/api/turn/undo', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setAppState((prev) => ({ ...prev, ...data.state }));
    }
  }, []);

  const handleNextTurn = useCallback(async () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('turn:next');
      return;
    }
    const res = await fetch('/api/turn/next', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setAppState((prev) => ({ ...prev, ...data.state }));
      setHighlightedDart(null);
    }
  }, []);

  const handleClearAllLogs = useCallback(async () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('log:clear');
      return;
    }
    const res = await fetch('/api/log/clear', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setAppState((prev) => ({ ...prev, ...data.state }));
      setHighlightedDart(null);
    }
  }, []);

  const handleSaveCalibration = useCallback(async (newCalibration) => {
    const res = await fetch('/api/calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCalibration)
    });
    const data = await res.json();
    if (data.state) {
      setAppState((prev) => ({ ...prev, ...data.state }));
    }
    return data;
  }, []);

  const handleSaveSingleCamera = useCallback(async (cameraId, cameraData) => {
    const res = await fetch(`/api/calibration/camera/${cameraId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cameraData)
    });
    const data = await res.json();
    if (data.state) {
      setAppState((prev) => ({ ...prev, ...data.state }));
    }
    return data;
  }, []);

  const handleAssignCameraDevice = useCallback(
    async (slotKey, deviceId, deviceLabel) => {
      const existingCam = appState.calibration?.cameras?.[slotKey] || {};
      return handleSaveSingleCamera(slotKey, {
        ...existingCam,
        deviceId,
        deviceLabel,
        devicePath: deviceLabel || existingCam.devicePath || `USB Camera`
      });
    },
    [appState.calibration, handleSaveSingleCamera]
  );

  const handleResetCalibration = useCallback(
    async (cameraId = null, preset = 'empty', layoutId = null) => {
      const res = await fetch('/api/calibration/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId, preset, layoutId })
      });
      const data = await res.json();
      if (data.state) {
        setAppState((prev) => ({ ...prev, ...data.state }));
      }
      return data;
    },
    []
  );

  const handleTestCameras = useCallback(async () => {
    const res = await fetch('/api/cameras/test', { method: 'POST' });
    const diagnostics = await res.json();
    setAppState((prev) => ({ ...prev, cameraDiagnostics: diagnostics }));
    return diagnostics;
  }, []);

  // Persistent Windows 10 Multi-Camera Vision Pipeline (stays active across all tabs)
  const vision = useVisionScorer({
    calibration: appState.calibration,
    currentTurnLength: appState.currentTurn.length,
    onVisionDetect: handleVisionDetect,
    onBoardCleared: handleNextTurn,
    onCameraRuntimeStatus: handleCameraRuntimeStatus,
    onAssignCameraDevice: handleAssignCameraDevice
  });

  const handleOpenDevPinModal = () => {
    if (isDevUnlocked) {
      setActiveTab('debug');
    } else {
      setIsDevPinModalOpen(true);
    }
  };

  const handleDevPinSuccess = () => {
    setIsDevUnlocked(true);
    setActiveTab('debug');
  };

  const handleLockDevMode = () => {
    setIsDevUnlocked(false);
    setActiveTab('live');
  };

  const calibratedCamerasCount = appState.calibration?.cameras
    ? Object.values(appState.calibration.cameras).filter(
        (c) => Array.isArray(c.points) && c.points.length === 4
      ).length
    : 3;

  const activeUsbCamerasCount = Object.values(vision.cameraStatusMap).filter(
    (s) => s.active
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <TopNavBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        scorerStatus={appState.scorerEngine}
        activeUsbCamerasCount={activeUsbCamerasCount}
        visionArmed={vision.visionArmed}
        onToggleVisionArmed={() => vision.setVisionArmed((v) => !v)}
        onCaptureEmptyBoard={vision.captureEmptyBoardReference}
        simulateMode={simulateMode}
        onToggleSimulateMode={() => setSimulateMode((v) => !v)}
        onOpenHelpWizard={() => setIsHelpOpen(true)}
        calibratedCamerasCount={calibratedCamerasCount}
        isDevUnlocked={isDevUnlocked}
        onOpenDevPinModal={handleOpenDevPinModal}
        onLockDevMode={handleLockDevMode}
      />

      <main className="flex-1">
        {activeTab === 'live' ? (
          <LiveScoreView
            turnNumber={appState.turnNumber}
            currentTurn={appState.currentTurn}
            currentTurnTotal={appState.currentTurnTotal}
            turnHistory={appState.turnHistory}
            accuracyLog={appState.accuracyLog}
            highlightedDart={highlightedDart}
            simulateMode={simulateMode}
            onSimulateDart={handleSimulateDart}
            onUndoLastDart={handleUndoLastDart}
            onNextTurn={() => {
              handleNextTurn();
              vision.captureEmptyBoardReference();
            }}
            onClearAllLogs={() => {
              handleClearAllLogs();
              vision.captureEmptyBoardReference();
            }}
            onOpenDevPinModal={handleOpenDevPinModal}
            isDevUnlocked={isDevUnlocked}
            vision={vision}
            calibration={appState.calibration}
            onSwitchToCalibration={() => setActiveTab('calibration')}
          />
        ) : activeTab === 'calibration' ? (
          <CalibrationView
            calibration={appState.calibration}
            cameraDiagnostics={appState.cameraDiagnostics}
            onSaveCalibration={handleSaveCalibration}
            onSaveSingleCamera={handleSaveSingleCamera}
            onResetCalibration={handleResetCalibration}
            onTestCameras={handleTestCameras}
            vision={vision}
          />
        ) : (
          <DebugView
            calibration={appState.calibration}
            cameraDiagnostics={appState.cameraDiagnostics}
            scorerStatus={appState.scorerEngine}
            onExitDevMode={handleLockDevMode}
            onSwitchToCalibration={() => setActiveTab('calibration')}
            onTestCameras={handleTestCameras}
            vision={vision}
          />
        )}
      </main>

      <SetupWizardModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        scorerStatus={appState.scorerEngine}
        activeUsbCamerasCount={activeUsbCamerasCount}
        cameraDiagnostics={appState.cameraDiagnostics}
        onTestCameras={async () => {
          await vision.scanWindowsCameras(true);
          return handleTestCameras();
        }}
        onSwitchToCalibration={() => setActiveTab('calibration')}
        onSwitchToLiveAndTestDart={(payload) => {
          setActiveTab('live');
          vision.runSyntheticVisionTest(payload.segment, payload.multiplier);
        }}
      />

      <DevPinModal
        isOpen={isDevPinModalOpen}
        onClose={() => setIsDevPinModalOpen(false)}
        onSuccess={handleDevPinSuccess}
      />
    </div>
  );
}
