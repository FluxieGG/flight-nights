const assert = require('assert');
const http = require('http');
const { WebSocketServer } = require('ws');
const { parseDartPayload } = require('./dartParser');
const { loadCalibration, saveCalibration, resetCalibrationPoints } = require('./calibrationStore');
const { inspectCameras } = require('./cameraManager');
const { OpenDartboardClient } = require('./openDartboardClient');

async function runTests() {
  console.log('1. Testing dartParser...');
  const t20 = parseDartPayload({ segment: 20, multiplier: 3, x: 0.01, y: -0.60 }, 'opendartboard');
  assert.strictEqual(t20.label, 'T20');
  assert.strictEqual(t20.score, 60);
  assert.strictEqual(t20.segment, 20);
  assert.strictEqual(t20.multiplier, 3);

  const bull = parseDartPayload({ segment: 25, multiplier: 2 }, 'simulated');
  assert.strictEqual(bull.label, 'BULL');
  assert.strictEqual(bull.score, 50);

  const outerBull = parseDartPayload({ segment: 25, multiplier: 1 }, 'simulated');
  assert.strictEqual(outerBull.label, '25');
  assert.strictEqual(outerBull.score, 25);

  const d16 = parseDartPayload('D16', 'simulated');
  assert.strictEqual(d16.label, 'D16');
  assert.strictEqual(d16.score, 32);

  const miss = parseDartPayload({ segment: 0, multiplier: 0 }, 'opendartboard');
  assert.strictEqual(miss.label, 'MISS');
  assert.strictEqual(miss.score, 0);

  console.log('2. Testing calibrationStore & cameraManager...');
  const resetLeft5 = resetCalibrationPoints(null, 'default', 'ring270_left5');
  assert.strictEqual(resetLeft5.ringLayout.id, 'ring270_left5');
  assert.strictEqual(resetLeft5.cameras.cam1.mountAngleDeg, 345);
  assert.strictEqual(resetLeft5.cameras.cam2.mountAngleDeg, 110);
  assert.strictEqual(resetLeft5.cameras.cam3.mountAngleDeg, 235);
  assert.strictEqual(resetLeft5.cameras.cam1.points.length, 4);

  const diagLeft5 = inspectCameras(resetLeft5);
  assert.strictEqual(diagLeft5.cameras.length, 3);
  assert.strictEqual(diagLeft5.triangulation.clearsOpenBottom, true);
  assert.strictEqual(diagLeft5.triangulation.clearsTopBar, true);
  assert.strictEqual(diagLeft5.triangulation.optimalTriangulation, true);

  const resetRight1 = resetCalibrationPoints(null, 'default', 'ring270_right1');
  assert.strictEqual(resetRight1.ringLayout.id, 'ring270_right1');
  assert.strictEqual(resetRight1.cameras.cam1.mountAngleDeg, 15);
  assert.strictEqual(resetRight1.cameras.cam2.mountAngleDeg, 125);
  assert.strictEqual(resetRight1.cameras.cam3.mountAngleDeg, 250);

  const diagRight1 = inspectCameras(resetRight1);
  assert.strictEqual(diagRight1.triangulation.clearsOpenBottom, true);
  assert.strictEqual(diagRight1.triangulation.clearsTopBar, true);
  assert.strictEqual(diagRight1.triangulation.optimalTriangulation, true);

  // Restore default ring270_left5 layout
  const resetDefault = resetCalibrationPoints(null, 'default', 'ring270_left5');
  const cal = loadCalibration();
  assert(cal.cameras.cam1 && cal.cameras.cam2 && cal.cameras.cam3);
  assert.strictEqual(cal.cameras.cam1.points.length, 4);

  const saved = saveCalibration(cal);
  assert(saved.updatedAt);

  const camDiag = inspectCameras(resetDefault);
  assert.strictEqual(camDiag.cameras.length, 3);

  console.log('3. Testing OpenDartboardClient WebSocket connection & auto-parse...');
  const mockServer = http.createServer();
  const wss = new WebSocketServer({ server: mockServer });

  await new Promise((resolve) => mockServer.listen(0, resolve));
  const mockPort = mockServer.address().port;

  let receivedDartMsg = null;
  let receivedCalSync = null;

  wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
      receivedCalSync = JSON.parse(msg.toString());
    });
    ws.send(JSON.stringify({ segment: 19, multiplier: 3, x: -0.18, y: 0.57 }));
  });

  const client = new OpenDartboardClient({
    url: `ws://localhost:${mockPort}`,
    reconnectIntervalMs: 500
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for mock OpenDartboard connection')), 4000);
    client.on('message', (raw) => {
      receivedDartMsg = parseDartPayload(raw, 'opendartboard');
      client.sendCalibration(resetDefault);
      setTimeout(() => {
        clearTimeout(timer);
        resolve();
      }, 100);
    });
    client.start();
  });

  assert(receivedDartMsg, 'Should have received dart message from mock OpenDartboard server');
  assert.strictEqual(receivedDartMsg.label, 'T19');
  assert.strictEqual(receivedDartMsg.score, 57);
  assert(receivedCalSync && receivedCalSync.type === 'calibration_update', 'Should have synced calibration over WS');

  client.stop();
  wss.close();
  mockServer.close();

  console.log('4. Testing Express API & Socket.IO server startup and routes...');
  const { server, odbClient } = require('./server');
  await new Promise((resolve) => server.listen(0, resolve));
  const apiPort = server.address().port;
  const baseUrl = `http://localhost:${apiPort}`;

  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  assert.strictEqual(health.ok, true);

  // Simulate 3 darts (T20, S20, T20 = 140)
  await fetch(`${baseUrl}/api/log/clear`, { method: 'POST' });
  await fetch(`${baseUrl}/api/dart/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment: 20, multiplier: 3 })
  });
  await fetch(`${baseUrl}/api/dart/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment: 20, multiplier: 1 })
  });
  const thirdDartRes = await fetch(`${baseUrl}/api/dart/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment: 20, multiplier: 3 })
  });
  const thirdDartData = await thirdDartRes.json();
  assert.strictEqual(thirdDartData.state.currentTurn.length, 3);
  assert.strictEqual(thirdDartData.state.currentTurnTotal, 140);
  assert.strictEqual(thirdDartData.state.accuracyLog.length, 3);

  // Test Undo Last Dart
  const undoRes = await fetch(`${baseUrl}/api/turn/undo`, { method: 'POST' });
  const undoData = await undoRes.json();
  assert.strictEqual(undoData.state.currentTurn.length, 2);
  assert.strictEqual(undoData.state.currentTurnTotal, 80);

  // Test Next Turn / Clear
  const nextRes = await fetch(`${baseUrl}/api/turn/next`, { method: 'POST' });
  const nextData = await nextRes.json();
  assert.strictEqual(nextData.state.currentTurn.length, 0);
  assert.strictEqual(nextData.state.turnHistory.length, 1);

  // Test Camera Diagnostics & Calibration Save
  const camRes = await fetch(`${baseUrl}/api/cameras/test`, { method: 'POST' });
  const camData = await camRes.json();
  assert.strictEqual(camData.cameras.length, 3);

  const calRes = await fetch(`${baseUrl}/api/calibration`);
  const calData = await calRes.json();
  assert(calData.calibration.cameras.cam1);

  // Reset session state cleanly so app starts fresh
  await fetch(`${baseUrl}/api/log/clear`, { method: 'POST' });

  odbClient.stop();
  await new Promise((resolve) => server.close(resolve));

  console.log('All backend smoke and E2E API tests passed!');
}

runTests().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
