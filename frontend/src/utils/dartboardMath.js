// Standard clock-order dartboard numbers starting at 12 o'clock (20)
export const BOARD_SECTORS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
];

// Normalized radii where 1.0 = outer edge of Double ring (170mm standard)
export const BOARD_RADII = {
  INNER_BULL: 0.045,   // slightly enlarged for TV readability
  OUTER_BULL: 0.110,
  TRIPLE_INNER: 0.565,
  TRIPLE_OUTER: 0.635,
  DOUBLE_INNER: 0.930,
  DOUBLE_OUTER: 1.000,
  NUMBER_RING: 1.135,
  BOARD_EDGE: 1.240
};

// Physical constraints for a 270° open-bottom ring light with a top mounting bar at 12 o'clock
export const OPEN_BOTTOM_GAP = { startDeg: 135, endDeg: 225 }; // ~4:30 to ~7:30 (no bottom ring)
export const TOP_BAR_ZONE = { startDeg: 354, endDeg: 6 };      // 12 o'clock bar directly over 20

export const RING_LAYOUT_PRESETS = {
  ring270_left5: {
    id: 'ring270_left5',
    ringType: '270-open-bottom',
    topBarAt12: true,
    topCameraSide: 'left-5',
    shortLabel: 'Top-Left (toward 5)',
    label: '270° Open-Bottom Ring · Top Left of Bar (toward 5)',
    summary: 'Cam 1 at ~11:30 (toward 5) · Cam 2 at ~3:40 (over 10) · Cam 3 at ~7:50 (over 16)',
    cameras: {
      cam1: { name: 'Camera 1', position: '11:30 (toward 5)', mountAngleDeg: 345, color: '#10b981' },
      cam2: { name: 'Camera 2', position: '3:40 (over 10)', mountAngleDeg: 110, color: '#38bdf8' },
      cam3: { name: 'Camera 3', position: '7:50 (over 16)', mountAngleDeg: 235, color: '#f59e0b' }
    }
  },
  ring270_right1: {
    id: 'ring270_right1',
    ringType: '270-open-bottom',
    topBarAt12: true,
    topCameraSide: 'right-1',
    shortLabel: 'Top-Right (toward 1)',
    label: '270° Open-Bottom Ring · Top Right of Bar (toward 1)',
    summary: 'Cam 1 at ~12:30 (toward 1) · Cam 2 at ~4:10 (over 15) · Cam 3 at ~8:20 (over 8)',
    cameras: {
      cam1: { name: 'Camera 1', position: '12:30 (toward 1)', mountAngleDeg: 15, color: '#10b981' },
      cam2: { name: 'Camera 2', position: '4:10 (over 15)', mountAngleDeg: 125, color: '#38bdf8' },
      cam3: { name: 'Camera 3', position: '8:20 (over 8)', mountAngleDeg: 250, color: '#f59e0b' }
    }
  }
};

// The 4 canonical calibration reference points on the outer Double ring:
// 1. 20/1 intersection = +9 deg from 12 o'clock
// 2. 6/10 intersection = +99 deg from 12 o'clock
// 3. 3/19 intersection = +189 deg from 12 o'clock
// 4. 11/14 intersection = +279 deg from 12 o'clock
export const CALIBRATION_REFERENCE_TARGETS = [
  {
    index: 0,
    shortLabel: '20 / 1',
    fullLabel: 'Point 1: 20 / 1 Double-Ring Intersection (Top)',
    angleDeg: 9,
    color: '#10b981' // emerald
  },
  {
    index: 1,
    shortLabel: '6 / 10',
    fullLabel: 'Point 2: 6 / 10 Double-Ring Intersection (Right)',
    angleDeg: 99,
    color: '#38bdf8' // sky
  },
  {
    index: 2,
    shortLabel: '3 / 19',
    fullLabel: 'Point 3: 3 / 19 Double-Ring Intersection (Bottom)',
    angleDeg: 189,
    color: '#f59e0b' // amber
  },
  {
    index: 3,
    shortLabel: '11 / 14',
    fullLabel: 'Point 4: 11 / 14 Double-Ring Intersection (Left)',
    angleDeg: 279,
    color: '#f43f5e' // rose
  }
];

export function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

export function isAngleInOpenBottom(deg) {
  const a = normalizeDeg(deg);
  return a > OPEN_BOTTOM_GAP.startDeg && a < OPEN_BOTTOM_GAP.endDeg;
}

export function isAngleInTopBar(deg) {
  const a = normalizeDeg(deg);
  return a >= TOP_BAR_ZONE.startDeg || a <= TOP_BAR_ZONE.endDeg;
}

export function angleToNearestSector(deg) {
  const a = normalizeDeg(deg);
  const idx = Math.round(a / 18) % 20;
  return BOARD_SECTORS[idx];
}

export function angleToClockLabel(deg) {
  const a = normalizeDeg(deg);
  const totalMinutes = Math.round((a / 360) * 12 * 60) % 720;
  const rawHour = Math.floor(totalMinutes / 60);
  const hour = rawHour === 0 ? 12 : rawHour;
  const minute = Math.round((totalMinutes % 60) / 5) * 5;
  if (minute === 60) {
    const nextHour = hour === 12 ? 1 : hour + 1;
    return `${nextHour}:00`;
  }
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

export function computeTriangulationMetrics(angles) {
  const normalized = angles.map((a) => normalizeDeg(a));
  const sorted = [...normalized].sort((a, b) => a - b);
  if (sorted.length !== 3) {
    return { gapsDeg: [], minGapDeg: 0, maxGapDeg: 0, clearsOpenBottom: false, clearsTopBar: false, isOptimal: false };
  }
  const gapsDeg = [
    Math.round(sorted[1] - sorted[0]),
    Math.round(sorted[2] - sorted[1]),
    Math.round(360 - sorted[2] + sorted[0])
  ];
  const minGapDeg = Math.min(...gapsDeg);
  const maxGapDeg = Math.max(...gapsDeg);
  const clearsOpenBottom = normalized.every((a) => !isAngleInOpenBottom(a));
  const clearsTopBar = normalized.every((a) => !isAngleInTopBar(a));
  return {
    gapsDeg,
    minGapDeg,
    maxGapDeg,
    clearsOpenBottom,
    clearsTopBar,
    isOptimal: minGapDeg >= 95 && maxGapDeg <= 145 && clearsOpenBottom && clearsTopBar
  };
}

/**
 * Projects the 4 canonical outer-double-ring intersections (20/1, 6/10, 3/19, 11/14)
 * from a 3D camera mounted on the ring light at `mountAngleDeg` (0 = 12 o'clock, clockwise)
 * onto a normalized 4:3 camera image [0..1] x [0..1].
 */
export function computePerspectivePresetPoints(mountAngleDeg = 345) {
  const theta = (normalizeDeg(mountAngleDeg) * Math.PI) / 180;
  const Rc = 1.35;
  const Zc = 2.6;
  const fy = 0.88;
  const fx = fy / (4 / 3);

  const Cx = Rc * Math.sin(theta);
  const Cy = -Rc * Math.cos(theta);
  const Cz = Zc;

  const fLen = Math.hypot(Cx, Cy, Cz);
  const f = { x: -Cx / fLen, y: -Cy / fLen, z: -Cz / fLen };

  const rx = -f.z;
  const ry = 0;
  const rz = f.x;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  const r = { x: rx / rLen, y: ry / rLen, z: rz / rLen };

  const d = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x
  };

  return CALIBRATION_REFERENCE_TARGETS.map((target) => {
    const rad = ((target.angleDeg - 90) * Math.PI) / 180;
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
      label: target.shortLabel.replace(/\s+/g, '')
    };
  });
}

/**
 * Converts polar angle (0 deg = 12 o'clock, clockwise) and radius to SVG (x, y)
 */
export function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

/**
 * Creates an SVG circular arc path from startAngleDeg to endAngleDeg clockwise (0 = 12 o'clock).
 */
export function createArcPath(cx, cy, radius, startAngleDeg, endAngleDeg) {
  const start = polarToCartesian(cx, cy, radius, startAngleDeg);
  const end = polarToCartesian(cx, cy, radius, endAngleDeg);
  const sweep = normalizeDeg(endAngleDeg - startAngleDeg);
  const largeArcFlag = sweep > 180 ? '1' : '0';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * Generates an SVG annular sector (donut wedge) path between innerRadius and outerRadius
 * from startAngleDeg to endAngleDeg (clockwise, 0 deg = 12 o'clock).
 */
export function createSectorPath(cx, cy, innerRadius, outerRadius, startAngleDeg, endAngleDeg) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngleDeg);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngleDeg);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngleDeg);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngleDeg);

  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

  return [
    'M', outerStart.x.toFixed(2), outerStart.y.toFixed(2),
    'A', outerRadius.toFixed(2), outerRadius.toFixed(2), 0, largeArcFlag, 1, outerEnd.x.toFixed(2), outerEnd.y.toFixed(2),
    'L', innerEnd.x.toFixed(2), innerEnd.y.toFixed(2),
    'A', innerRadius.toFixed(2), innerRadius.toFixed(2), 0, largeArcFlag, 0, innerStart.x.toFixed(2), innerStart.y.toFixed(2),
    'Z'
  ].join(' ');
}

/**
 * Solves an 8x8 linear system A * h = b via Gaussian elimination with partial pivoting
 * to find the 3x3 planar homography matrix H mapping canonical board coordinates (bx, by)
 * to normalized camera image coordinates (ix, iy).
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
 * Given 4 user-clicked image points [{x, y}, ...] in normalized [0..1] camera space,
 * computes a projective Homography transform function project(boardX, boardY) -> {x, y}
 * where (boardX, boardY) is in canonical dartboard space (radius 1.0 = outer double ring).
 */
export function buildBoardHomography(imagePoints) {
  if (!Array.isArray(imagePoints) || imagePoints.length !== 4) {
    return null;
  }

  // Canonical board coordinates for the 4 reference points (on outer double ring r = 1.0)
  const src = CALIBRATION_REFERENCE_TARGETS.map((target) => {
    const rad = ((target.angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: Math.cos(rad),
      y: Math.sin(rad)
    };
  });

  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = imagePoints[i].x;
    const dy = imagePoints[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }

  const h = solveLinearSystem8x8(A, b);
  if (!h) return null;

  const [h00, h01, h02, h10, h11, h12, h20, h21] = h;

  return function projectBoardPoint(bx, by) {
    const denom = h20 * bx + h21 * by + 1.0;
    if (Math.abs(denom) < 1e-7) {
      return { x: 0.5, y: 0.5 };
    }
    return {
      x: (h00 * bx + h01 * by + h02) / denom,
      y: (h10 * bx + h11 * by + h12) / denom
    };
  };
}

/**
 * Generates an SVG polygon/polyline path for a circle of radius `r` in canonical board space
 * projected through the 4-point perspective homography onto a camera viewBox of size W x H.
 */
export function createProjectedRingPath(projectFn, radius, width, height, steps = 72) {
  if (!projectFn) return '';
  const commands = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const bx = Math.cos(angle) * radius;
    const by = Math.sin(angle) * radius;
    const pt = projectFn(bx, by);
    const px = (pt.x * width).toFixed(1);
    const py = (pt.y * height).toFixed(1);
    commands.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
  }
  commands.push('Z');
  return commands.join(' ');
}

/**
 * Generates an SVG open arc path for a partial ring (e.g. 270° open-bottom LED ring light)
 * projected through the 4-point homography from startAngleDeg to endAngleDeg clockwise.
 */
export function createProjectedArcPath(projectFn, radius, startAngleDeg, endAngleDeg, width, height, steps = 60) {
  if (!projectFn) return '';
  const sweep = normalizeDeg(endAngleDeg - startAngleDeg);
  const commands = [];
  for (let i = 0; i <= steps; i++) {
    const deg = startAngleDeg + (i / steps) * sweep;
    const rad = ((deg - 90) * Math.PI) / 180;
    const bx = Math.cos(rad) * radius;
    const by = Math.sin(rad) * radius;
    const pt = projectFn(bx, by);
    const px = (pt.x * width).toFixed(1);
    const py = (pt.y * height).toFixed(1);
    commands.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
  }
  return commands.join(' ');
}
