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
