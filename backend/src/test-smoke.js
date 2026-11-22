const assert = require('assert');
const { parseDartPayload } = require('./dartParser');
const { loadCalibration, saveCalibration, resetCalibrationPoints } = require('./calibrationStore');
const { inspectCameras } = require('./cameraManager');
const {
  buildForwardHomography,
  buildInverseHomography,
  scoreFromBoardCoordinates,
  triangulateMultiCameraDetections,
  OpenCVDartsScorer
} = require('./opencvDartsScorer');

async function runTests() {
  console.log('1. Testing dartParser...');
  const t20 = parseDartPayload({ segment: 20, multiplier: 3, x: 0.01, y: -0.60 }, 'vision');
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

  const miss = parseDartPayload({ segment: 0, multiplier: 0 }, 'vision');
  assert.strictEqual(miss.label, 'MISS');
  assert.strictEqual(miss.score, 0);

  // Test coordinate-only parsing
  const coordOnlyT20 = parseDartPayload({ x: 0.0, y: -0.60 }, 'vision');
  assert.strictEqual(coordOnlyT20.label, 'T20');
  assert.strictEqual(coordOnlyT20.score, 60);

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

  console.log('3. Testing OpenCV-Darts 4-point Homography & 3-Camera Triangulation Scorer...');
  const cam1Fwd = buildForwardHomography(cal.cameras.cam1.points);
  const cam1Inv = buildInverseHomography(cal.cameras.cam1.points);
  const cam2Fwd = buildForwardHomography(cal.cameras.cam2.points);
  const cam3Fwd = buildForwardHomography(cal.cameras.cam3.points);

  // Target: Triple 20 at canonical board position (0.0, -0.60)
  const targetBoard = { x: 0.0, y: -0.60 };
  const imgPt1 = cam1Fwd(targetBoard.x, targetBoard.y);
  const roundTrip1 = cam1Inv(imgPt1.x, imgPt1.y);
  assert(Math.abs(roundTrip1.x - targetBoard.x) < 1e-4, 'Inverse homography X roundtrip accurate');
  assert(Math.abs(roundTrip1.y - targetBoard.y) < 1e-4, 'Inverse homography Y roundtrip accurate');

  const imgPt2 = cam2Fwd(targetBoard.x, targetBoard.y);
  const imgPt3 = cam3Fwd(targetBoard.x, targetBoard.y);

  const triangulated = triangulateMultiCameraDetections(
    [
      { cameraId: 'cam1', imageTip: imgPt1, confidence: 0.94 },
      { cameraId: 'cam2', imageTip: imgPt2, confidence: 0.91 },
      { cameraId: 'cam3', imageTip: imgPt3, confidence: 0.93 }
    ],
    cal
  );
  assert(triangulated, 'Should triangulate 3 camera detections');
  assert.strictEqual(triangulated.label, 'T20');
  assert.strictEqual(triangulated.score, 60);
  assert.strictEqual(triangulated.method, '3-camera-triangulation');
  assert.strictEqual(triangulated.camerasUsed.length, 3);

  const bullScore = scoreFromBoardCoordinates(0.01, -0.01);
  assert.strictEqual(bullScore.label, 'BULL');
  assert.strictEqual(bullScore.score, 50);

  const scorer = new OpenCVDartsScorer();
  const engineScored = scorer.scoreDetection(
    {
      detections: [
        { cameraId: 'cam1', imageTip: imgPt1, confidence: 0.92 },
        { cameraId: 'cam2', imageTip: imgPt2, confidence: 0.90 }
      ]
    },
    cal
  );
  assert.strictEqual(engineScored.label, 'T20');
  assert.strictEqual(engineScored.method, '2-camera-triangulation');

  console.log('4. Testing Express API & Socket.IO server startup and routes...');
  const { server } = require('./server');
  await new Promise((resolve) => server.listen(0, resolve));
  const apiPort = server.address().port;
  const baseUrl = `http://localhost:${apiPort}`;

  const healthRes = await fetch(`${baseUrl}/api/health`);
  const health = await healthRes.json();
  assert.strictEqual(health.ok, true);
  assert.strictEqual(health.scorerEngine.ready, true);

  // Test clear & 3-camera vision detection endpoint (/api/vision/detect)
  await fetch(`${baseUrl}/api/log/clear`, { method: 'POST' });
  const visionDetectRes = await fetch(`${baseUrl}/api/vision/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      detections: [
        { cameraId: 'cam1', imageTip: imgPt1, confidence: 0.95 },
        { cameraId: 'cam2', imageTip: imgPt2, confidence: 0.93 },
        { cameraId: 'cam3', imageTip: imgPt3, confidence: 0.94 }
      ]
    })
  });
  const visionDetectData = await visionDetectRes.json();
  assert.strictEqual(visionDetectData.ok, true);
  assert.strictEqual(visionDetectData.dart.label, 'T20');
  assert.strictEqual(visionDetectData.dart.source, 'vision');

  // Simulate 2 more darts (S20, T20 => Total 140)
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

  await new Promise((resolve) => server.close(resolve));

  console.log('All backend smoke, OpenCV-Darts triangulation, and E2E API tests passed!');
}

runTests().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
