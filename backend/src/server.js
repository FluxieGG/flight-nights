const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');

const { parseDartPayload } = require('./dartParser');
const { loadCalibration, saveCalibration, saveSingleCamera, resetCalibrationPoints, CONFIG_PATH } = require('./calibrationStore');
const { inspectCameras } = require('./cameraManager');
const { OpenDartboardClient } = require('./openDartboardClient');

const PORT = Number(process.env.PORT) || 3001;
const OPENDARTBOARD_WS_URL = process.env.OPENDARTBOARD_WS_URL || 'ws://localhost:13520';
const OPENDARTBOARD_RECONNECT_MS = Number(process.env.OPENDARTBOARD_RECONNECT_MS) || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Zero-Database In-Memory Session State
const MAX_ACCURACY_LOG = 20;
const MAX_TURN_HISTORY = 15;

let calibrationState = loadCalibration();

const sessionState = {
  turnNumber: 1,
  currentTurn: [], // up to 3 darts
  turnHistory: [], // completed turns
  accuracyLog: [], // last 20 detected darts with raw payload and timestamp
  lastDetectedDart: null
};

// OpenDartboard WebSocket Client
const odbClient = new OpenDartboardClient({
  url: OPENDARTBOARD_WS_URL,
  reconnectIntervalMs: OPENDARTBOARD_RECONNECT_MS
});

function calculateTurnTotal(darts) {
  return darts.reduce((sum, dart) => sum + (dart.score || 0), 0);
}

function getFullState() {
  return {
    turnNumber: sessionState.turnNumber,
    currentTurn: sessionState.currentTurn,
    currentTurnTotal: calculateTurnTotal(sessionState.currentTurn),
    turnHistory: sessionState.turnHistory,
    accuracyLog: sessionState.accuracyLog,
    lastDetectedDart: sessionState.lastDetectedDart,
    openDartboard: odbClient.getStatus(),
    calibration: calibrationState,
    calibrationPath: CONFIG_PATH,
    cameraDiagnostics: inspectCameras(calibrationState)
  };
}

function archiveCurrentTurn() {
  if (sessionState.currentTurn.length === 0) return;

  const archived = {
    id: `turn-${sessionState.turnNumber}-${Date.now()}`,
    turnNumber: sessionState.turnNumber,
    darts: [...sessionState.currentTurn],
    total: calculateTurnTotal(sessionState.currentTurn),
    completedAt: new Date().toISOString()
  };

  sessionState.turnHistory = [archived, ...sessionState.turnHistory].slice(0, MAX_TURN_HISTORY);
  sessionState.currentTurn = [];
  sessionState.turnNumber += 1;
}

function recordDartHit(rawPayload, source = 'opendartboard') {
  const dart = parseDartPayload(rawPayload, source);
  if (!dart) {
    return null;
  }

  // If 3 darts are already in the tray, automatically archive the completed turn and start the next turn
  if (sessionState.currentTurn.length >= 3) {
    archiveCurrentTurn();
  }

  const dartWithSlot = {
    ...dart,
    turnNumber: sessionState.turnNumber,
    dartIndex: sessionState.currentTurn.length + 1
  };

  sessionState.currentTurn.push(dartWithSlot);
  sessionState.lastDetectedDart = dartWithSlot;
  sessionState.accuracyLog = [dartWithSlot, ...sessionState.accuracyLog].slice(0, MAX_ACCURACY_LOG);

  const fullState = getFullState();
  io.emit('dart:detected', {
    dart: dartWithSlot,
    state: fullState
  });

  return dartWithSlot;
}

function undoLastDart() {
  if (sessionState.currentTurn.length > 0) {
    const removed = sessionState.currentTurn.pop();
    sessionState.accuracyLog = sessionState.accuracyLog.filter((d) => d.id !== removed.id);
    sessionState.lastDetectedDart =
      sessionState.currentTurn[sessionState.currentTurn.length - 1] ||
      sessionState.accuracyLog[0] ||
      null;
  } else if (sessionState.turnHistory.length > 0) {
    // Restore previous turn and remove its last dart
    const prevTurn = sessionState.turnHistory.shift();
    sessionState.turnNumber = prevTurn.turnNumber;
    sessionState.currentTurn = prevTurn.darts;
    const removed = sessionState.currentTurn.pop();
    if (removed) {
      sessionState.accuracyLog = sessionState.accuracyLog.filter((d) => d.id !== removed.id);
    }
    sessionState.lastDetectedDart =
      sessionState.currentTurn[sessionState.currentTurn.length - 1] ||
      sessionState.accuracyLog[0] ||
      null;
  }

  const fullState = getFullState();
  io.emit('state:update', fullState);
  return fullState;
}

function nextTurnOrClear() {
  if (sessionState.currentTurn.length > 0) {
    archiveCurrentTurn();
  }
  sessionState.lastDetectedDart = null;
  const fullState = getFullState();
  io.emit('state:update', fullState);
  return fullState;
}

function clearAccuracyLog() {
  sessionState.accuracyLog = [];
  sessionState.turnHistory = [];
  sessionState.currentTurn = [];
  sessionState.turnNumber = 1;
  sessionState.lastDetectedDart = null;
  const fullState = getFullState();
  io.emit('state:update', fullState);
  return fullState;
}

// Listen to OpenDartboard daemon events
odbClient.on('status', (statusObj) => {
  io.emit('opendartboard:status', statusObj);
});

odbClient.on('message', (rawMessage) => {
  recordDartHit(rawMessage, 'opendartboard');
});

// REST API Routes
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'smart-darts-mvp-backend',
    openDartboard: odbClient.getStatus(),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/api/state', (_req, res) => {
  res.json(getFullState());
});

app.post('/api/dart/simulate', (req, res) => {
  const payload = req.body || {};
  const dart = recordDartHit(payload, 'simulated');
  if (!dart) {
    return res.status(400).json({ error: 'Invalid dart payload', received: payload });
  }
  return res.json({ ok: true, dart, state: getFullState() });
});

app.post('/api/turn/undo', (_req, res) => {
  const state = undoLastDart();
  res.json({ ok: true, state });
});

app.post('/api/turn/next', (_req, res) => {
  const state = nextTurnOrClear();
  res.json({ ok: true, state });
});

app.post('/api/log/clear', (_req, res) => {
  const state = clearAccuracyLog();
  res.json({ ok: true, state });
});

app.get('/api/calibration', (_req, res) => {
  calibrationState = loadCalibration();
  res.json({
    calibration: calibrationState,
    path: CONFIG_PATH
  });
});

app.post('/api/calibration', (req, res) => {
  try {
    const incoming = req.body || {};
    calibrationState = saveCalibration(incoming);
    const syncResult = odbClient.sendCalibration(calibrationState);
    const fullState = getFullState();
    io.emit('calibration:updated', {
      calibration: calibrationState,
      syncResult,
      state: fullState
    });
    res.json({
      ok: true,
      calibration: calibrationState,
      syncResult,
      state: fullState
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/calibration/camera/:id', (req, res) => {
  try {
    const cameraId = req.params.id;
    const cameraData = req.body || {};
    calibrationState = saveSingleCamera(cameraId, cameraData);
    const syncResult = odbClient.sendCalibration(calibrationState);
    const fullState = getFullState();
    io.emit('calibration:updated', {
      calibration: calibrationState,
      savedCameraId: cameraId,
      syncResult,
      state: fullState
    });
    res.json({
      ok: true,
      cameraId,
      calibration: calibrationState,
      syncResult,
      state: fullState
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/calibration/reset', (req, res) => {
  try {
    const { cameraId = null, preset = 'empty', layoutId = null } = req.body || {};
    calibrationState = resetCalibrationPoints(cameraId, preset, layoutId);
    const syncResult = odbClient.sendCalibration(calibrationState);
    const fullState = getFullState();
    io.emit('calibration:updated', {
      calibration: calibrationState,
      syncResult,
      state: fullState
    });
    res.json({
      ok: true,
      calibration: calibrationState,
      syncResult,
      state: fullState
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cameras/status', (_req, res) => {
  const diagnostics = inspectCameras(calibrationState);
  res.json(diagnostics);
});

app.post('/api/cameras/test', (_req, res) => {
  const diagnostics = inspectCameras(calibrationState);
  io.emit('cameras:diagnostics', diagnostics);
  res.json(diagnostics);
});

app.post('/api/opendartboard/reconnect', (req, res) => {
  const { url } = req.body || {};
  const status = odbClient.reconnectNow(url);
  res.json({ ok: true, status });
});

// Socket.IO Real-Time Bridge
io.on('connection', (socket) => {
  socket.emit('state:init', getFullState());

  socket.on('dart:simulate', (payload, ack) => {
    const dart = recordDartHit(payload, 'simulated');
    if (typeof ack === 'function') {
      ack({ ok: Boolean(dart), dart });
    }
  });

  socket.on('turn:undo', (_payload, ack) => {
    const state = undoLastDart();
    if (typeof ack === 'function') ack({ ok: true, state });
  });

  socket.on('turn:next', (_payload, ack) => {
    const state = nextTurnOrClear();
    if (typeof ack === 'function') ack({ ok: true, state });
  });

  socket.on('log:clear', (_payload, ack) => {
    const state = clearAccuracyLog();
    if (typeof ack === 'function') ack({ ok: true, state });
  });

  socket.on('calibration:save', (newCal, ack) => {
    try {
      calibrationState = saveCalibration(newCal);
      const syncResult = odbClient.sendCalibration(calibrationState);
      const fullState = getFullState();
      io.emit('calibration:updated', {
        calibration: calibrationState,
        syncResult,
        state: fullState
      });
      if (typeof ack === 'function') {
        ack({ ok: true, calibration: calibrationState, syncResult });
      }
    } catch (err) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: err.message });
      }
    }
  });

  socket.on('calibration:save_camera', ({ cameraId, cameraData } = {}, ack) => {
    try {
      calibrationState = saveSingleCamera(cameraId, cameraData);
      const syncResult = odbClient.sendCalibration(calibrationState);
      const fullState = getFullState();
      io.emit('calibration:updated', {
        calibration: calibrationState,
        savedCameraId: cameraId,
        syncResult,
        state: fullState
      });
      if (typeof ack === 'function') {
        ack({ ok: true, cameraId, calibration: calibrationState, syncResult });
      }
    } catch (err) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: err.message });
      }
    }
  });

  socket.on('calibration:reset', ({ cameraId = null, preset = 'empty', layoutId = null } = {}, ack) => {
    try {
      calibrationState = resetCalibrationPoints(cameraId, preset, layoutId);
      const syncResult = odbClient.sendCalibration(calibrationState);
      const fullState = getFullState();
      io.emit('calibration:updated', {
        calibration: calibrationState,
        syncResult,
        state: fullState
      });
      if (typeof ack === 'function') {
        ack({ ok: true, calibration: calibrationState, syncResult });
      }
    } catch (err) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: err.message });
      }
    }
  });

  socket.on('cameras:test', (_payload, ack) => {
    const diagnostics = inspectCameras(calibrationState);
    io.emit('cameras:diagnostics', diagnostics);
    if (typeof ack === 'function') ack({ ok: true, diagnostics });
  });

  socket.on('opendartboard:reconnect', ({ url } = {}, ack) => {
    const status = odbClient.reconnectNow(url);
    if (typeof ack === 'function') ack({ ok: true, status });
  });
});

function startServer() {
  odbClient.start();
  server.listen(PORT, () => {
    console.log(`[Smart Darts Backend] Server listening on http://localhost:${PORT}`);
    console.log(`[Smart Darts Backend] OpenDartboard WebSocket target: ${OPENDARTBOARD_WS_URL} (auto-reconnect: ${OPENDARTBOARD_RECONNECT_MS}ms)`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  odbClient,
  startServer
};
