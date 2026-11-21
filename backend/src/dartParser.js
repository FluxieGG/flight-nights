const BOARD_SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Standard normalized radii relative to outside of Double ring = 1.0 (170mm)
const RADII = {
  INNER_BULL: 0.037,   // 6.35mm / 170mm
  OUTER_BULL: 0.094,   // 15.9mm / 170mm
  INNER_SINGLE: 0.365, // midpoint of inner single
  TRIPLE_INNER: 0.582, // 99mm / 170mm
  TRIPLE_MID: 0.606,   // midpoint of triple ring
  TRIPLE_OUTER: 0.629, // 107mm / 170mm
  OUTER_SINGLE: 0.790, // midpoint of outer single
  DOUBLE_INNER: 0.953, // 162mm / 170mm
  DOUBLE_MID: 0.976,   // midpoint of double ring
  DOUBLE_OUTER: 1.000, // 170mm / 170mm
  MISS_RADIUS: 1.090
};

/**
 * Computes normalized (x, y) coordinates in [-1.15, 1.15] for a given segment and multiplier
 * if the vision engine payload did not include explicit coordinates.
 * (0, 0) is center of bullseye, (0, -1) is 12 o'clock (top of 20).
 */
function computeCoordinatesForDart(segment, multiplier) {
  if (segment === 0 || multiplier === 0) {
    const randomAngleDeg = Math.random() * 360;
    const rad = ((randomAngleDeg - 90) * Math.PI) / 180;
    return {
      x: Number((Math.cos(rad) * RADII.MISS_RADIUS).toFixed(4)),
      y: Number((Math.sin(rad) * RADII.MISS_RADIUS).toFixed(4))
    };
  }

  if (segment === 25) {
    const r = multiplier === 2 ? RADII.INNER_BULL * 0.45 : (RADII.INNER_BULL + RADII.OUTER_BULL) * 0.5;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Number((Math.cos(angle) * r).toFixed(4)),
      y: Number((Math.sin(angle) * r).toFixed(4))
    };
  }

  const sectorIndex = BOARD_SECTORS.indexOf(segment);
  const baseAngleDeg = sectorIndex >= 0 ? sectorIndex * 18 : 0;
  // Slight natural jitter within the segment (-2.5 to +2.5 deg)
  const jitterDeg = (Math.random() - 0.5) * 4;
  const angleRad = ((baseAngleDeg + jitterDeg - 90) * Math.PI) / 180;

  let radius = RADII.OUTER_SINGLE;
  if (multiplier === 3) {
    radius = RADII.TRIPLE_MID;
  } else if (multiplier === 2) {
    radius = RADII.DOUBLE_MID;
  } else {
    radius = RADII.OUTER_SINGLE;
  }

  return {
    x: Number((Math.cos(angleRad) * radius).toFixed(4)),
    y: Number((Math.sin(angleRad) * radius).toFixed(4))
  };
}

/**
 * Parses notation strings like "T20", "D16", "S5", "BULL", "DBULL", "OBULL", "25", "MISS"
 */
function parseShorthandNotation(notation) {
  if (typeof notation !== 'string') return null;
  const clean = notation.trim().toUpperCase();

  if (clean === 'MISS' || clean === 'M' || clean === '0' || clean === 'OUT') {
    return { segment: 0, multiplier: 0 };
  }
  if (clean === 'BULL' || clean === 'DBULL' || clean === 'D25' || clean === '50' || clean === 'BULLSEYE') {
    return { segment: 25, multiplier: 2 };
  }
  if (clean === 'OBULL' || clean === 'S25' || clean === '25' || clean === 'OUTERBULL') {
    return { segment: 25, multiplier: 1 };
  }

  const match = clean.match(/^([SDT])(\d{1,2})$/);
  if (match) {
    const prefix = match[1];
    const seg = parseInt(match[2], 10);
    const mult = prefix === 'T' ? 3 : prefix === 'D' ? 2 : 1;
    if ((seg >= 1 && seg <= 20) || (seg === 25 && mult <= 2)) {
      return { segment: seg, multiplier: mult };
    }
  }

  const numOnly = parseInt(clean, 10);
  if (!Number.isNaN(numOnly) && numOnly >= 1 && numOnly <= 20) {
    return { segment: numOnly, multiplier: 1 };
  }

  return null;
}

/**
 * Formats a normalized segment + multiplier into TV-readable label & ring description.
 */
function formatDartLabel(segment, multiplier) {
  if (segment === 0 || multiplier === 0) {
    return { label: 'MISS', ringName: 'Miss', score: 0 };
  }
  if (segment === 25) {
    if (multiplier >= 2) {
      return { label: 'BULL', ringName: 'Inner Bull (50)', score: 50 };
    }
    return { label: '25', ringName: 'Outer Bull (25)', score: 25 };
  }

  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S';
  const ringName = multiplier === 3 ? 'Triple' : multiplier === 2 ? 'Double' : 'Single';
  return {
    label: `${prefix}${segment}`,
    ringName: `${ringName} ${segment}`,
    score: segment * multiplier
  };
}

/**
 * Normalizes any incoming dart payload from OpenDartboard or Simulated Test Mode.
 */
function parseDartPayload(rawPayload, source = 'opendartboard') {
  let payload = rawPayload;
  if (typeof rawPayload === 'string') {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      const parsedStr = parseShorthandNotation(rawPayload);
      if (parsedStr) {
        payload = { ...parsedStr, notation: rawPayload };
      } else {
        return null;
      }
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  // Filter out non-dart control messages (e.g. heartbeat / ping / calibration_ack)
  if (payload.type && ['heartbeat', 'ping', 'pong', 'status', 'calibration_ack', 'hello'].includes(String(payload.type).toLowerCase())) {
    return null;
  }

  // Handle nested data object if OpenDartboard wraps in { event: "dart", data: { ... } }
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;

  let segment = null;
  let multiplier = null;

  // Check shorthand notation fields first if explicit segment isn't numeric
  const shorthandCandidate = data.notation || data.bed || data.dart || data.label || data.code;
  if (typeof shorthandCandidate === 'string') {
    const parsed = parseShorthandNotation(shorthandCandidate);
    if (parsed) {
      segment = parsed.segment;
      multiplier = parsed.multiplier;
    }
  }

  // Numeric segment / sector / number
  const rawSeg = data.segment ?? data.sector ?? data.number ?? data.base;
  if (rawSeg !== undefined && rawSeg !== null) {
    if (typeof rawSeg === 'string' && Number.isNaN(Number(rawSeg))) {
      const parsed = parseShorthandNotation(rawSeg);
      if (parsed) {
        segment = parsed.segment;
        multiplier = parsed.multiplier;
      }
    } else {
      segment = Number(rawSeg);
    }
  }

  // Numeric multiplier / ring / mult
  const rawMult = data.multiplier ?? data.mult ?? data.ring;
  if (rawMult !== undefined && rawMult !== null) {
    if (typeof rawMult === 'number' || !Number.isNaN(Number(rawMult))) {
      multiplier = Number(rawMult);
    } else if (typeof rawMult === 'string') {
      const mStr = rawMult.toUpperCase();
      if (mStr.startsWith('T')) multiplier = 3;
      else if (mStr.startsWith('D')) multiplier = 2;
      else if (mStr.startsWith('S')) multiplier = 1;
      else if (mStr.startsWith('M') || mStr === 'OUT') multiplier = 0;
    }
  }

  // Validate segment & multiplier
  if (segment === null || Number.isNaN(segment)) {
    return null;
  }

  if (segment === 50) {
    segment = 25;
    multiplier = 2;
  }

  if (multiplier === null || Number.isNaN(multiplier)) {
    multiplier = segment === 0 ? 0 : 1;
  }

  // Clamp/normalize valid dartboard values
  if (segment === 0 || multiplier === 0) {
    segment = 0;
    multiplier = 0;
  } else if (segment === 25) {
    multiplier = multiplier >= 2 ? 2 : 1;
  } else if (segment >= 1 && segment <= 20) {
    multiplier = Math.max(1, Math.min(3, Math.round(multiplier)));
  } else {
    return null;
  }

  const { label, ringName, score } = formatDartLabel(segment, multiplier);

  // Extract or compute normalized coordinates
  let x = typeof data.x === 'number' && !Number.isNaN(data.x) ? Number(data.x.toFixed(4)) : null;
  let y = typeof data.y === 'number' && !Number.isNaN(data.y) ? Number(data.y.toFixed(4)) : null;
  if (x === null || y === null) {
    const coords = computeCoordinatesForDart(segment, multiplier);
    x = coords.x;
    y = coords.y;
  }

  return {
    id: `dart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    segment,
    multiplier,
    score,
    label,
    ringName,
    x,
    y,
    source,
    timestamp: new Date().toISOString(),
    raw: typeof rawPayload === 'object' ? rawPayload : { raw: rawPayload }
  };
}

module.exports = {
  BOARD_SECTORS,
  RADII,
  parseDartPayload,
  formatDartLabel,
  computeCoordinatesForDart
};
