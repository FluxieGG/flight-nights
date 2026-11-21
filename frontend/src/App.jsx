import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import TopNavBar from './components/TopNavBar';
import LiveScoreView from './components/LiveScoreView';
import CalibrationView from './components/CalibrationView';
import SetupWizardModal from './components/SetupWizardModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'calibration'
  const [simulateMode, setSimulateMode] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [appState, setAppState] = useState({
    turnNumber: 1,
    currentTurn: [],
    currentTurnTotal: 0,
    turnHistory: [],
    accuracyLog: [],
    lastDetectedDart: null,
    openDartboard: {
      status: 'reconnecting',
      connected: false,
      url: 'ws://localhost:13520',
      reconnectIntervalMs: 3000
    },
    calibration: null,
    cameraDiagnostics: null
  });

  const [highlightedDart, setHighlightedDart] = useState(null);
  const highlightTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const triggerDartHighlight = (dart) => {
    setHighlightedDart(dart);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedDart(null);
    }, 2400);
  };

  useEffect(() => {
    // Initial HTTP state fetch
    fetch('/api/state')
      .then((res) => res.json())
      .then((data) => {
        setAppState((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {
        // Socket.IO will sync once backend is reachable
      });

    // Connect Socket.IO real-time bridge
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

    socket.on('opendartboard:status', (statusObj) => {
      setAppState((prev) => ({
        ...prev,
        openDartboard: statusObj
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
  }, []);

  // Handlers
  const handleSimulateDart = async (payload) => {
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
  };

  const handleUndoLastDart = async () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('turn:undo');
      return;
    }
    const res = await fetch('/api/turn/undo', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setAppState((prev) => ({ ...prev, ...data.state }));
    }
  };

  const handleNextTurn = async () => {
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
  };

  const handleClearAllLogs = async () => {
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
  };

  const handleSaveCalibration = async (newCalibration) => {
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
  };

  const handleResetCalibration = async (cameraId = null, preset = 'empty') => {
    const res = await fetch('/api/calibration/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId, preset })
    });
    const data = await res.json();
    if (data.state) {
      setAppState((prev) => ({ ...prev, ...data.state }));
    }
    return data;
  };

  const handleTestCameras = async () => {
    const res = await fetch('/api/cameras/test', { method: 'POST' });
    const diagnostics = await res.json();
    setAppState((prev) => ({ ...prev, cameraDiagnostics: diagnostics }));
    return diagnostics;
  };

  const handleReconnectOpenDartboard = async () => {
    await fetch('/api/opendartboard/reconnect', { method: 'POST' });
  };

  // Count how many cameras have all 4 calibration points placed
  const calibratedCamerasCount = appState.calibration?.cameras
    ? Object.values(appState.calibration.cameras).filter(
        (c) => Array.isArray(c.points) && c.points.length === 4
      ).length
    : 3;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <TopNavBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        openDartboardStatus={appState.openDartboard}
        onReconnectOpenDartboard={handleReconnectOpenDartboard}
        simulateMode={simulateMode}
        onToggleSimulateMode={() => setSimulateMode((v) => !v)}
        onOpenHelpWizard={() => setIsHelpOpen(true)}
        calibratedCamerasCount={calibratedCamerasCount}
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
            onNextTurn={handleNextTurn}
            onClearAllLogs={handleClearAllLogs}
          />
        ) : (
          <CalibrationView
            calibration={appState.calibration}
            cameraDiagnostics={appState.cameraDiagnostics}
            onSaveCalibration={handleSaveCalibration}
            onResetCalibration={handleResetCalibration}
            onTestCameras={handleTestCameras}
          />
        )}
      </main>

      <SetupWizardModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        openDartboardStatus={appState.openDartboard}
        onReconnectOpenDartboard={handleReconnectOpenDartboard}
        cameraDiagnostics={appState.cameraDiagnostics}
        onTestCameras={handleTestCameras}
        onSwitchToCalibration={() => setActiveTab('calibration')}
        onSwitchToLiveAndTestDart={(payload) => {
          setActiveTab('live');
          handleSimulateDart(payload);
        }}
      />
    </div>
  );
}
