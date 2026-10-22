// Calibration and checks on navigation equipment, as in Handbook on Navigation (2019) chapter 8, with the speed-log formulas of
// BR 45(3) para 0427 (4.9 and 4.10). Pure; `node tools/shipChecks.check.ts`.

const deg = (r: number) => (r * 180) / Math.PI;

// ---- radar ------------------------------------------------------------------------------------------------------------------
/** Range index error: true (charted) range less radar range. Add it to a radar range to get the true range. */
export const rangeIndexError = (trueRange: number, radarRange: number) => trueRange - radarRange;
/** Two-mark method: passing between two objects, the error is half the difference between the charted distance and the two ranges added. */
export const twoMarkIndexError = (chartedBetween: number, range1: number, range2: number) => (chartedBetween - (range1 + range2)) / 2;
/** Bearing error: the reference (visual) bearing less the radar bearing, to be added to radar bearings. Gyro error must be allowed for first. */
export const radarBearingError = (referenceBearing: number, radarBearing: number) => ((referenceBearing - radarBearing + 540) % 360) - 180;

// ---- speed log ----------------------------------------------------------------------------------------------------------------
/** Ground speed over a measured distance (BR 45(3) 4.8): knots from n miles and seconds. */
export const groundSpeed = (distanceNm: number, seconds: number) => (distanceNm * 3600) / seconds;

export interface Run { ground: number; log: number }       // ground speed over the run, and the mean log (water) speed, knots
export interface LogResult {
  /** C, the percentage speed log correction: add this percentage of the log reading to get the true water speed */
  percent: number;
  /** mean speeds (knots) and the error log - ground in knots and as a percentage of the log speed (Handbook para 12) */
  meanGround: number; meanLog: number; errorKn: number; errorPercent: number;
  method: 'two-run' | 'four-run';
}

/** Two runs: C = 100 (V1 + V2) / (L1 + L2) - 1) (formula 4.9). Four runs, tide changing: weights 1, 3, 3, 1 (formula 4.10). */
export function logCorrection(runs: Run[]): LogResult | null {
  if (runs.length !== 2 && runs.length !== 4) return null;
  const w = runs.length === 2 ? [1, 1] : [1, 3, 3, 1];
  const v = runs.reduce((s, r, i) => s + w[i] * r.ground, 0), l = runs.reduce((s, r, i) => s + w[i] * r.log, 0);
  if (!(l > 0)) return null;
  const sum = w.reduce((a, b) => a + b, 0);
  const meanGround = v / sum, meanLog = l / sum;
  return { percent: 100 * (v / l - 1), meanGround, meanLog, errorKn: meanLog - meanGround, errorPercent: (100 * (meanLog - meanGround)) / meanLog, method: runs.length === 2 ? 'two-run' : 'four-run' };
}
/** True water speed from a log reading and the percentage correction. */
export const correctedSpeed = (reading: number, percent: number) => reading * (1 + percent / 100);

// ---- lubber's line --------------------------------------------------------------------------------------------------------------
/** Toe-in angle E of a repeater off the centre line by `offset`, with the Jackstaff `ahead` of it along the ship (same units). */
export const toeInAngle = (offset: number, ahead: number) => deg(Math.atan2(offset, ahead));
/** The bearing the Jackstaff should read from a wing repeater: the ship's head plus E for a port-side repeater, minus E for starboard. */
export const jackstaffReads = (head: number, e: number, side: 'Port' | 'Starboard') => (((head + (side === 'Port' ? e : -e)) % 360) + 360) % 360;

// ---- echo sounder -------------------------------------------------------------------------------------------------------------------
/** Handbook para 31: the report interval in metres of change, by depth (and in any case at least once a minute). */
export const soundingReportStep = (depth: number) => (depth < 20 ? 1 : depth <= 40 ? 5 : 10);
/** Echo sounder error against a hand lead line: lead depth less echo sounder depth, allowing for the transducer offset (both to the same datum). */
export const echoError = (leadDepth: number, echoDepth: number) => leadDepth - echoDepth;


// ---- the saved records: each turns the values typed on its form into a result and a one-line summary --------------------------------
export type Values = Record<string, string>;
const num = (s: string | undefined): number | null => { if (s === undefined || s.trim() === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const sg = (v: number, d: number) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

export const RADAR_METHODS = ['Alongside, charted range', 'Radar calibration chart', 'Two-mark', 'Three-mark (cocked hat)', 'HSA', 'Two-ship', 'Three-ship', 'Weapon radar'] as const;
export type RadarMethod = (typeof RADAR_METHODS)[number];

/** What to enter for each method (BR 45(1)(2) para 1521). */
export const radarMethodHelp = (m: string): string => ({
  'Alongside, charted range': 'Alongside, give the charted range of a radar-conspicuous object and the radar range of it.',
  'Radar calibration chart': 'Fix the ship (HSA or DGPS) on a large-scale calibration chart; give the true range of the mark from the chart and the radar range taken at the Fix.',
  'Two-mark': 'Passing directly between two marks: the charted distance between them, and the radar ranges to each taken together. Index error = (charted - (a + b)) / 2.',
  'Three-mark (cocked hat)': 'Three charted marks around the ship: their positions in the same unit (east and north from any origin) and the radar range of each. The index error is the radius of the circle tangent to the three range arcs.',
  'HSA': 'Running on a transit with a third mark abeam: pairs of true range (from the HSA table) and radar range; the differences are averaged.',
  'Two-ship': 'Ships in line abreast, double echo showing: range B (consort to the double echo) is the true range; range A is the radar range to the consort.',
  'Three-ship': 'Three ships in line abreast: the true range your pair has been given by the others, and your radar range to the same ship.',
  'Weapon radar': 'The weapon (fire-control) radar range of a common object is the reference; give it and the navigational radar range.',
} as Record<string, string>)[m] ?? '';

/** Radar range index error: the amount to add to radar ranges to get true ranges, in the unit the ranges were given in. */
export function radarIndexError(v: Values): number | null {
  const m = v.method as RadarMethod;
  const t = num(v.true), r = num(v.radar);
  switch (m) {
    case 'Two-mark': { const ab = num(v.ab), a = num(v.a), b = num(v.b); return ab !== null && a !== null && b !== null ? twoMarkIndexError(ab, a, b) : null; }
    case 'Three-mark (cocked hat)': {
      const o = [1, 2, 3].map(i => ({ x: num(v[`x${i}`]), y: num(v[`y${i}`]), r: num(v[`r${i}`]) }));
      return o.every(p => p.x !== null && p.y !== null && p.r !== null) ? cockedHat(o as { x: number; y: number; r: number }[]) : null;
    }
    case 'HSA': {
      const d = [1, 2, 3, 4].map(i => [num(v[`ht${i}`]), num(v[`hr${i}`])]).filter(p => p[0] !== null && p[1] !== null).map(p => (p[0] as number) - (p[1] as number));
      return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
    }
    default: return t !== null && r !== null ? rangeIndexError(t, r) : null;
  }
}

/**
 * Three-mark method: the point P and the error e with |P - Oi| = ri + e for all three marks, i.e. the circle of radius e tangent to the three range arcs.
 * Gauss-Newton from the centroid. Null when the marks are in a line (no unique answer) or it does not settle.
 */
export function cockedHat(o: { x: number; y: number; r: number }[]): number | null {
  let px = o.reduce((s, p) => s + p.x, 0) / 3, py = o.reduce((s, p) => s + p.y, 0) / 3, e = 0;
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  for (let it = 0; it < 60; it++) {
    const res: number[] = [], J: number[][] = [];
    for (const p of o) {
      const dx = px - p.x, dy = py - p.y, d = Math.hypot(dx, dy) || 1e-12;
      res.push(d - (p.r + e)); J.push([dx / d, dy / d, -1]);
    }
    const D = det(J);
    if (Math.abs(D) < 1e-9) return null;
    const col = (k: number) => J.map((row, i) => row.map((x, j) => (j === k ? -res[i] : x)));
    const dpx = det(col(0)) / D, dpy = det(col(1)) / D, de = det(col(2)) / D;
    px += dpx; py += dpy; e += de;
    if (Math.hypot(dpx, dpy, de) < 1e-12) return e;
  }
  return Number.isFinite(e) ? e : null;
}

export function radarIndexSummary(v: Values): string {
  const e = radarIndexError(v);
  const where = [v.radar_name, v.scale && `${v.scale} scale`].filter(Boolean).join(', ');
  if (e === null) return `${v.method}${where ? ` (${where})` : ''}`;
  const unit = v.unit || 'yards', d = unit === 'nm' ? 3 : 1;
  return `${v.method}${where ? `, ${where}` : ''}: index error ${sg(e, d)} ${unit === 'yards' ? 'yd' : unit} (${e >= 0 ? 'add to' : 'subtract from'} radar ranges)`;
}

export function radarBearingSummary(v: Values): string {
  const a = num(v.visual), b = num(v.radar);
  if (a === null || b === null) return v.radar_name ?? '';
  const err = radarBearingError(a, b);
  return `${v.radar_name ? v.radar_name + ': ' : ''}visual ${String(Math.round(a)).padStart(3, '0')}°, radar ${String(Math.round(b)).padStart(3, '0')}°, bearing error ${sg(err, 1)}°`;
}

export function speedLogResult(v: Values) {
  const dist = num(v.dist) ?? 1, n = v.runs === '4' ? 4 : 2;
  const runs = Array.from({ length: n }, (_, i) => { const t = num(v[`t${i + 1}`]), l = num(v[`l${i + 1}`]); return t !== null && t > 0 && l !== null && l > 0 ? { ground: groundSpeed(dist, t), log: l } : null; });
  return runs.every(r => r) ? logCorrection(runs as Run[]) : null;
}
export function speedLogSummary(v: Values): string {
  const r = speedLogResult(v);
  const at = v.speed ? `${v.speed} kn: ` : '';
  return r ? `${at}log correction ${sg(r.percent, 1)} % (${r.method}), log error ${sg(r.errorKn, 2)} kn` : `${at}speed log runs`;
}

/** Lubber's line: by toe-in angle (a repeater off the centre line) or by direct comparison with the Jackstaff. */
export function lubberResult(v: Values): { toeIn: number | null; expected: number | null; error: number } | null {
  if (v.method === 'Direct comparison') {
    const l = num(v.lubber), j = num(v.jack);
    return l !== null && j !== null ? { toeIn: null, expected: j, error: ((l - j + 540) % 360) - 180 } : null;
  }
  const off = num(v.offset), ahead = num(v.ahead), head = num(v.head), read = num(v.read);
  if (off === null || ahead === null || !(ahead > 0) || head === null || read === null) return null;
  const e = toeInAngle(off, ahead), side = v.side === 'Starboard' ? 'Starboard' : 'Port', expected = jackstaffReads(head, e, side);
  return { toeIn: e, expected, error: ((read - expected + 540) % 360) - 180 };
}
export function lubberSummary(v: Values): string {
  const r = lubberResult(v), who = v.repeater ? `${v.repeater}: ` : '';
  if (!r) return `${who}${v.method ?? ''}`.trim();
  return `${who}${r.toeIn !== null ? `toe-in ${r.toeIn.toFixed(2)}°, ` : ''}${Math.abs(r.error) < 0.05 ? 'aligned' : `error ${sg(r.error, 1)}°`}`;
}

export function echoSummary(v: Values): string {
  const ref = num(v.ref), echo = num(v.echo);
  if (ref === null || echo === null) return v.method ?? '';
  return `${v.method}${v.sounder ? `, ${v.sounder}` : ''}: reference ${ref} m, sounder ${echo} m, error ${sg(echoError(ref, echo), 2)} m`;
}
