/**
 * OpenCV-Darts & Darts_Project Multi-Camera Homography + Triangulation Scoring Engine
 *
 * Replaces the legacy Linux/Raspberry Pi OpenDartboard daemon with a native, zero-daemon
 * multi-camera computer vision scoring engine based on the open-source algorithms from:
 *   - vassdoki/opencv-darts & DartCaller/darts-recognition (3-camera epipolar ray triangulation)
 *   - LarsG21/Darts_Project & wmcnally/deep-darts (4-point planar homography & polar board mapping)
 *
 * Works out-of-the-box on Windows 10 with 1, 2, or 3 physical USB cameras (e.g., OV9732).
 */

const BOARD_SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Canonical reference points on the outer edge of the Double ring (radius = 1.0)
// Clockwise from 12 o'clock (0 deg = center of 20):
//   1. 20/1 wire = 9 deg
//   2. 6/10 wire = 99 deg
//   3. 3/19 wire = 189 deg
//   4. 11/14 wire = 279 deg
const CALIBRATION_REFERENCE_ANGLES_DEG = [9, 99, 189, 279];

// Normalized board radii (1.0 = outer edge of Double ring = 170mm regulation WDF)
// Matches the visual calibration overlay rings in dartboardMath.js so visual calibration is 1:1.
const SCORING_RADII = {
  INNER_BULL: 0.045,   // Inner Bull (50 pts)
  OUTER_BULL: 0.110,   // Outer Bull (25 pts)
  TRIPLE_INNER: 0.565, // Inner edge of Triple ring
  TRIPLE_OUTER: 0.635, // Outer edge of Triple ring
  DOUBLE_INNER: 0.930, // Inner edge of Double ring
  DOUBLE_OUTER: 1.000  // Outer edge of Double ring
};

/**
 * Solves an 8x8 linear system A * h = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem8x8(A, b) {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = row;
      }
    }

    if (maxVal < 1e-10) {
      return null;
    }

    if (pivotRow !== col) {
      const temp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = temp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j];
        }
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Computes canonical board coordinates (bx, by) for the 4 calibration reference points
 * on the outer Double ring (radius = 1.0).
 */
function getCanonicalReferencePoints() {
  return CALIBRATION_REFERENCE_ANGLES_DEG.map((angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: Math.cos(rad),
      y: Math.sin(rad)
    };
  });
}

/**
 * Builds a forward planar homography function: projectBoardToImage(bx, by) -> { x, y }
 * mapping canonical dartboard coordinates [-1..1] to normalized camera image coordinates [0..1].
 */
function buildForwardHomography(imagePoints) {
  if (!Array.isArray(imagePoints) || imagePoints.length !== 4) {
    return null;
  }

  const src = getCanonicalReferencePoints();
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = Number(imagePoints[i].x);
    const dy = Number(imagePoints[i].y);
    if (Number.isNaN(dx) || Number.isNaN(dy)) return null;

    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solveLinearSystem8x8(A, b);
  if (!h) return null;

  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;
  return function projectBoardToImage(bx, by) {
    const denom = h20 * bx + h21 * by + 1.0;
    if (Math.abs(denom) < 1e-7) return { x: 0.5, y: 0.5 };
    return {
      x: (h00 * bx + h01 * by + h02) / denom,
      y: (h10 * bx + h11 * by + h12) / denom
    };
  };
}

/**
 * Builds an inverse planar homography function: projectImageToBoard(u, v) -> { x, y }
 * mapping normalized camera image coordinates [0..1] to canonical dartboard coordinates [-1.25..1.25].
 */
function buildInverseHomography(imagePoints) {
  if (!Array.isArray(imagePoints) || imagePoints.length !== 4) {
    return null;
  }

  const dst = getCanonicalReferencePoints();
  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const sx = Number(imagePoints[i].x);
    const sy = Number(imagePoints[i].y);
    if (Number.isNaN(sx) || Number.isNaN(sy)) return null;
    const dx = dst[i].x;
    const dy = dst[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solveLinearSystem8x8(A, b);
  if (!h) return null;

  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;
  return function projectImageToBoard(u, v) {
    const denom = h20 * u + h21 * v + 1.0;
    if (Math.abs(denom) < 1e-7) return { x: 0, y: 0 };
    return {
      x: (h00 * u + h01 * v + h02) / denom,
      y: (h10 * u + h11 * v + h12) / denom
    };
  };
}

/**
 * Converts canonical board coordinates (x, y) into WDF dartboard segment, multiplier, score, and label.
 * (0, 0) = center of bullseye, (0, -1) = 12 o'clock outer double wire (top of 20).
 */
function scoreFromBoardCoordinates(x, y, radii = SCORING_RADII) {
  const bx = Number(x);
  const by = Number(y);
  if (Number.isNaN(bx) || Number.isNaN(by)) {
    return null;
  }

  const radius = Math.hypot(bx, by);
  // Clockwise angle in degrees where 0 deg = 12 o'clock (top of 20)
  const rawAngleDeg = (Math.atan2(by, bx) * 180) / Math.PI + 90;
  const angleDeg = ((rawAngleDeg % 360) + 360) % 360;

  let segment = 0;
  let multiplier = 0;

  if (radius <= radii.INNER_BULL) {
    segment = 25;
    multiplier = 2;
  } else if (radius <= radii.OUTER_BULL) {
    segment = 25;
    multiplier = 1;
  } else if (radius > radii.DOUBLE_OUTER) {
    segment = 0;
    multiplier = 0;
  } else {
    const sectorIndex = Math.floor(((angleDeg + 9) % 360) / 18) % 20;
    segment = BOARD_SECTORS[sectorIndex];

    if (radius >= radii.DOUBLE_INNER && radius <= radii.DOUBLE_OUTER) {
      multiplier = 2;
    } else if (radius >= radii.TRIPLE_INNER && radius <= radii.TRIPLE_OUTER) {
      multiplier = 3;
    } else {
      multiplier = 1;
    }
  }

  let label = 'MISS';
  let ringName = 'Miss';
  let score = 0;

  if (segment === 25) {
    if (multiplier === 2) {
      label = 'BULL';
      ringName = 'Inner Bull (50)';
      score = 50;
    } else {
      label = '25';
      ringName = 'Outer Bull (25)';
      score = 25;
    }
  } else if (segment >= 1 && segment <= 20 && multiplier >= 1) {
    const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S';
    const rName = multiplier === 3 ? 'Triple' : multiplier === 2 ? 'Double' : 'Single';
    label = `${prefix}${segment}`;
    ringName = `${rName} ${segment}`;
    score = segment * multiplier;
  }

  return {
    segment,
    multiplier,
    score,
    label,
    ringName,
    x: Number(bx.toFixed(4)),
    y: Number(by.toFixed(4)),
    radius: Number(radius.toFixed(4)),
    angleDeg: Number(angleDeg.toFixed(2))
  };
}

/**
 * Computes the intersection point of two 2D lines:
 *   Line 1: P1 + t * D1
 *   Line 2: P2 + s * D2
 * Returns null if lines are nearly parallel.
 */
function intersectRays2D(p1, d1, p2, d2) {
  const cross = d1.x * d2.y - d1.y * d2.x;
  const sinAngle = Math.abs(cross);
  if (sinAngle < 0.2) {
    return null;
  }
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / cross;
  return {
    x: p1.x + t * d1.x,
    y: p1.y + t * d1.y,
    sinAngle
  };
}

/**
 * Multi-Camera Triangulation & Homography Fusion (vassdoki/opencv-darts + Darts_Project algorithm):
 *
 * Accepts 1 to 3 per-camera dart detections:
 *   detections: [
 *     {
 *       cameraId: 'cam1' | 'cam2' | 'cam3',
 *       imageTip: { x: 0..1, y: 0..1 },   // optional normalized camera pixel coordinates
 *       imageTail: { x: 0..1, y: 0..1 },  // optional dart flight/shaft end in camera coordinates
 *       boardTip: { x: -1..1, y: -1..1 }, // optional pre-projected board coordinates
 *       boardTail: { x: -1..1, y: -1..1 },
 *       confidence: 0.1..1.0
 *     }
 *   ]
 * Uses `calibration.cameras` to project image coordinates through each camera's 4-point inverse
 * homography H_i^-1, constructs epipolar sightlines from each camera's ring mount position,
 * performs outlier-resistant multi-camera triangulation, and maps the fused board coordinate to a score.
 */
function triangulateMultiCameraDetections(detections, calibration) {
  if (!Array.isArray(detections) || detections.length === 0) {
    return null;
  }

  const camConfigs = (calibration && calibration.cameras) || {};
  const defaultAngles = { cam1: 345, cam2: 110, cam3: 235 };
  const ringRadius = 1.35;

  const observations = [];

  for (const det of detections) {
    if (!det || typeof det !== 'object') continue;
    const camId = det.cameraId || 'cam1';
    const camCfg = camConfigs[camId] || {};
    const mountAngleDeg =
      typeof det.mountAngleDeg === 'number'
        ? det.mountAngleDeg
        : typeof camCfg.mountAngleDeg === 'number'
        ? camCfg.mountAngleDeg
        : defaultAngles[camId] || 0;

    const invH = Array.isArray(camCfg.points) && camCfg.points.length === 4
      ? buildInverseHomography(camCfg.points)
      : null;

    let boardTip = null;
    if (det.boardTip && typeof det.boardTip.x === 'number' && typeof det.boardTip.y === 'number') {
      boardTip = { x: det.boardTip.x, y: det.boardTip.y };
    } else if (det.imageTip && typeof det.imageTip.x === 'number' && typeof det.imageTip.y === 'number' && invH) {
      boardTip = invH(det.imageTip.x, det.imageTip.y);
    }

    if (!boardTip || Number.isNaN(boardTip.x) || Number.isNaN(boardTip.y)) {
      continue;
    }

    let boardTail = null;
    if (det.boardTail && typeof det.boardTail.x === 'number' && typeof det.boardTail.y === 'number') {
      boardTail = { x: det.boardTail.x, y: det.boardTail.y };
    } else if (det.imageTail && typeof det.imageTail.x === 'number' && typeof det.imageTail.y === 'number' && invH) {
      boardTail = invH(det.imageTail.x, det.imageTail.y);
    }

    // Physical camera xy position on the LED ring in canonical board space
    const thetaRad = (mountAngleDeg * Math.PI) / 180.0;
    const camPos = {
      x: ringRadius * Math.sin(thetaRad),
      y: -ringRadius * Math.cos(thetaRad)
    };

    // Sightline / principal axis unit vector in canonical board space
    // As proved by 3D perspective geometry Q(s) - T = (s / (Cz - s)) * (T - C_xy),
    // the projected dart contour lies along the line from C_xy through T (and toward boardTail).
    let dirVec = null;
    if (boardTail) {
      const vx = boardTail.x - boardTip.x;
      const vy = boardTail.y - boardTip.y;
      const len = Math.hypot(vx, vy);
      if (len > 0.02) {
        dirVec = { x: vx / len, y: vy / len };
      }
    }
    if (!dirVec) {
      const vx = boardTip.x - camPos.x;
      const vy = boardTip.y - camPos.y;
      const len = Math.hypot(vx, vy) || 1;
      dirVec = { x: vx / len, y: vy / len };
    }

    const confidence = Math.max(0.1, Math.min(1.0, Number(det.confidence) || 0.85));

    observations.push({
      cameraId: camId,
      mountAngleDeg,
      camPos,
      boardTip,
      boardTail,
      dirVec,
      confidence
    });
  }

  if (observations.length === 0) {
    return null;
  }

  // Outlier adjustment when 3 cameras report and 1 camera is significantly discordant (e.g. flight occlusion)
  const weights = observations.map((obs) => obs.confidence);
  if (observations.length === 3) {
    const d01 = Math.hypot(
      observations[0].boardTip.x - observations[1].boardTip.x,
      observations[0].boardTip.y - observations[1].boardTip.y
    );
    const d12 = Math.hypot(
      observations[1].boardTip.x - observations[2].boardTip.x,
      observations[1].boardTip.y - observations[2].boardTip.y
    );
    const d02 = Math.hypot(
      observations[0].boardTip.x - observations[2].boardTip.x,
      observations[0].boardTip.y - observations[2].boardTip.y
    );

    const outlierThreshold = 0.22;
    if (d01 < outlierThreshold && d02 > outlierThreshold && d12 > outlierThreshold) {
      weights[2] *= 0.15; // cam3 is outlier
    } else if (d02 < outlierThreshold && d01 > outlierThreshold && d12 > outlierThreshold) {
      weights[1] *= 0.15; // cam2 is outlier
    } else if (d12 < outlierThreshold && d01 > outlierThreshold && d02 > outlierThreshold) {
      weights[0] *= 0.15; // cam1 is outlier
    }
  }

  // 1. Homography tip consensus centroid
  let sumW = 0;
  let homographyX = 0;
  let homographyY = 0;
  for (let i = 0; i < observations.length; i++) {
    const w = weights[i];
    homographyX += observations[i].boardTip.x * w;
    homographyY += observations[i].boardTip.y * w;
    sumW += w;
  }
  homographyX /= sumW || 1;
  homographyY /= sumW || 1;

  // 2. Pairwise multi-camera ray triangulation intersections
  let rayX = 0;
  let rayY = 0;
  let rayWeightSum = 0;

  if (observations.length >= 2) {
    for (let i = 0; i < observations.length; i++) {
      for (let j = i + 1; j < observations.length; j++) {
        const hit = intersectRays2D(
          observations[i].boardTip,
          observations[i].dirVec,
          observations[j].boardTip,
          observations[j].dirVec
        );
        if (hit && Math.hypot(hit.x, hit.y) <= 1.45) {
          // If the intersection is reasonably close to the homography tips, blend it in
          const distFromHomography = Math.hypot(hit.x - homographyX, hit.y - homographyY);
          if (distFromHomography < 0.25) {
            const pairW = weights[i] * weights[j] * hit.sinAngle;
            rayX += hit.x * pairW;
            rayY += hit.y * pairW;
            rayWeightSum += pairW;
          }
        }
      }
    }
  }

  // Blend homography tip consensus (70%) with multi-camera ray intersection (30%) when available
  let finalX = homographyX;
  let finalY = homographyY;
  if (rayWeightSum > 0) {
    const triangX = rayX / rayWeightSum;
    const triangY = rayY / rayWeightSum;
    finalX = homographyX * 0.7 + triangX * 0.3;
    finalY = homographyY * 0.7 + triangY * 0.3;
  }

  // Compute spread / agreement confidence across cameras
  let avgSpread = 0;
  if (observations.length >= 2) {
    let spreadSum = 0;
    for (let i = 0; i < observations.length; i++) {
      spreadSum += Math.hypot(
        observations[i].boardTip.x - finalX,
        observations[i].boardTip.y - finalY
      );
    }
    avgSpread = spreadSum / observations.length;
  }

  const baseConfidence = sumW / observations.length;
  const multiCamBonus = observations.length === 3 ? 0.12 : observations.length === 2 ? 0.06 : 0;
  const spreadPenalty = Math.min(0.35, avgSpread * 0.8);
  const finalConfidence = Number(
    Math.max(0.15, Math.min(0.99, baseConfidence + multiCamBonus - spreadPenalty)).toFixed(2)
  );

  const method =
    observations.length >= 3
      ? '3-camera-triangulation'
      : observations.length === 2
      ? '2-camera-triangulation'
      : '1-camera-homography';

  const scored = scoreFromBoardCoordinates(finalX, finalY);
  if (!scored) return null;

  return {
    ...scored,
    confidence: finalConfidence,
    method,
    camerasUsed: observations.map((o) => o.cameraId),
    triangulationSpread: Number(avgSpread.toFixed(4)),
    perCamera: observations.map((o) => ({
      cameraId: o.cameraId,
      boardTip: {
        x: Number(o.boardTip.x.toFixed(4)),
        y: Number(o.boardTip.y.toFixed(4))
      },
      confidence: Number(o.confidence.toFixed(2))
    }))
  };
}

class OpenCVDartsScorer {
  constructor() {
    this.engineName = 'OpenCV-Darts Triangulation Engine';
    this.algorithm = '4-Point Homography + 3-Camera Ray Triangulation (opencv-darts / Darts_Project)';
    this.status = 'ready'; // 'active' | 'ready' | 'calibrating'
    this.activeCamerasCount = 0;
    this.calibratedCamerasCount = 3;
    this.fps = 0;
    this.armed = true;
    this.detectionsCount = 0;
    this.lastDetectionAt = null;
    this.lastMethod = '3-camera-triangulation';
  }

  updateFromCalibration(calibration) {
    if (calibration && calibration.cameras) {
      this.calibratedCamerasCount = Object.values(calibration.cameras).filter(
        (c) => Array.isArray(c.points) && c.points.length === 4
      ).length;
    }
    return this.getStatus();
  }

  updateCameraRuntimeStatus({ activeCamerasCount, fps, armed } = {}) {
    if (typeof activeCamerasCount === 'number') {
      this.activeCamerasCount = activeCamerasCount;
    }
    if (typeof fps === 'number') {
      this.fps = Math.round(fps);
    }
    if (typeof armed === 'boolean') {
      this.armed = armed;
    }
    this.status = this.activeCamerasCount > 0 && this.armed ? 'active' : 'ready';
    return this.getStatus();
  }

  scoreDetection(payload, calibration) {
    if (!payload || typeof payload !== 'object') return null;

    let result = null;
    if (Array.isArray(payload.detections) && payload.detections.length > 0) {
      result = triangulateMultiCameraDetections(payload.detections, calibration);
    } else if (typeof payload.x === 'number' && typeof payload.y === 'number') {
      const scored = scoreFromBoardCoordinates(payload.x, payload.y);
      if (scored) {
        result = {
          ...scored,
          confidence: Number(payload.confidence) || 0.95,
          method: payload.method || 'board-homography',
          camerasUsed: payload.camerasUsed || ['cam1', 'cam2', 'cam3'],
          triangulationSpread: 0,
          perCamera: payload.perCamera || []
        };
      }
    }

    if (result) {
      this.detectionsCount += 1;
      this.lastDetectionAt = new Date().toISOString();
      this.lastMethod = result.method;
    }

    return result;
  }

  getStatus() {
    return {
      engineName: this.engineName,
      algorithm: this.algorithm,
      status: this.status,
      ready: true,
      connected: true,
      armed: this.armed,
      activeCamerasCount: this.activeCamerasCount,
      calibratedCamerasCount: this.calibratedCamerasCount,
      fps: this.fps,
      detectionsCount: this.detectionsCount,
      lastDetectionAt: this.lastDetectionAt,
      lastMethod: this.lastMethod
    };
  }
}

module.exports = {
  BOARD_SECTORS,
  SCORING_RADII,
  CALIBRATION_REFERENCE_ANGLES_DEG,
  buildForwardHomography,
  buildInverseHomography,
  scoreFromBoardCoordinates,
  triangulateMultiCameraDetections,
  OpenCVDartsScorer
};
