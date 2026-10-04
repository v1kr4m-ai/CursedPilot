// Pure navigation maths for the Navigator's Tools. No React, no I/O, so it can be checked with
// `node tools/navMath.check.ts`. Angles are degrees, speeds knots, distances nautical miles unless a name says otherwise.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export const norm360 = (d: number) => ((d % 360) + 360) % 360;
export const reciprocal = (h: number) => norm360(h + 180);

/** Range-and-angle rule: angle subtended = distance / range, in degrees. */
export const radianAngle = (distance: number, range: number) => deg(distance / range);

// ---- Time / speed / distance -------------------------------------------------------------------

export interface TSD { distance: number | null; speed: number | null; minutes: number | null }

/** Solves whichever one of distance (nm), speed (kn), time (min) is missing. Needs exactly two of the three. */
export function solveTSD(v: TSD): { distance: number; speed: number; minutes: number; solved: keyof TSD } | null {
  const missing = (Object.keys(v) as (keyof TSD)[]).filter(k => v[k] === null || !Number.isFinite(v[k] as number));
  if (missing.length !== 1) return null;
  const { distance: d, speed: s, minutes: t } = v;
  switch (missing[0]) {
    case 'distance': return s! >= 0 && t! >= 0 ? { distance: s! * (t! / 60), speed: s!, minutes: t!, solved: 'distance' } : null;
    case 'speed': return t! > 0 && d! >= 0 ? { distance: d!, speed: d! / (t! / 60), minutes: t!, solved: 'speed' } : null;
    case 'minutes': return s! > 0 && d! >= 0 ? { distance: d!, speed: s!, minutes: (d! / s!) * 60, solved: 'minutes' } : null;
  }
}

// ---- Compass ---------------------------------------------------------------------------------

/** Variation and deviation are signed: East positive, West negative. */
export const compassToTrue = (compass: number, deviation: number, variation: number) => norm360(compass + deviation + variation);
export const trueToCompass = (trueCourse: number, deviation: number, variation: number) => norm360(trueCourse - variation - deviation);
/** Gyro error East positive (gyro reads low). */
export const trueFromGyro = (gyro: number, error: number) => norm360(gyro + error);
export const trueBearing = (heading: number, relative: number) => norm360(heading + relative);

// ---- CPA / TCPA -------------------------------------------------------------------------------

export interface CpaInput { ownCourse: number; ownSpeed: number; bearing: number; range: number; targetCourse: number; targetSpeed: number }
export interface CpaResult {
  cpa: number;                    // nm
  tcpaMinutes: number | null;     // null when the closest approach is now or already past
  status: 'closing' | 'opening' | 'steady';
  relativeCourse: number | null;  // null when there is no relative motion
  relativeSpeed: number;
  bearingAtCpa: number;
}

/** Closest point of approach from true bearing/range of the target and both vessels' courses and speeds. */
export function cpa(i: CpaInput): CpaResult {
  const p = { x: i.range * Math.sin(rad(i.bearing)), y: i.range * Math.cos(rad(i.bearing)) };
  const v = {
    x: i.targetSpeed * Math.sin(rad(i.targetCourse)) - i.ownSpeed * Math.sin(rad(i.ownCourse)),
    y: i.targetSpeed * Math.cos(rad(i.targetCourse)) - i.ownSpeed * Math.cos(rad(i.ownCourse)),
  };
  const vv = v.x * v.x + v.y * v.y;
  if (vv < 1e-9) return { cpa: i.range, tcpaMinutes: null, status: 'steady', relativeCourse: null, relativeSpeed: 0, bearingAtCpa: norm360(i.bearing) };
  const t = -(p.x * v.x + p.y * v.y) / vv;            // hours
  const relativeCourse = norm360(deg(Math.atan2(v.x, v.y)));
  const relativeSpeed = Math.sqrt(vv);
  if (t <= 0) return { cpa: i.range, tcpaMinutes: null, status: 'opening', relativeCourse, relativeSpeed, bearingAtCpa: norm360(i.bearing) };
  const q = { x: p.x + v.x * t, y: p.y + v.y * t };
  return { cpa: Math.hypot(q.x, q.y), tcpaMinutes: t * 60, status: 'closing', relativeCourse, relativeSpeed, bearingAtCpa: norm360(deg(Math.atan2(q.x, q.y))) };
}

// ---- Course to steer (tidal triangle) ---------------------------------------------------------

export type CtsResult = { cts: number; sog: number; allowance: number } | { error: string };

/** Course to steer to make good `track` through water at `speed` in a current setting towards `set` at `drift` kn. */
export function courseToSteer(track: number, speed: number, set: number, drift: number): CtsResult {
  if (speed <= 0) return { error: 'Ship speed must be above zero.' };
  const s = (-drift * Math.sin(rad(set - track))) / speed;
  if (Math.abs(s) > 1) return { error: 'Current is too strong to hold that track at this speed.' };
  const allowance = deg(Math.asin(s));
  const sog = speed * Math.cos(rad(allowance)) + drift * Math.cos(rad(set - track));
  if (sog <= 0) return { error: 'The ship would make no headway along that track.' };
  return { cts: norm360(track + allowance), sog, allowance };
}

// ---- Distance off, horizons -------------------------------------------------------------------

/** Distance off (nm) from a vertical sextant angle to an object of known height (m), ignoring curvature and refraction. */
export const distanceOffVSA = (objectHeightM: number, angleDeg: number) => objectHeightM / Math.tan(rad(angleDeg)) / 1852;
/** Visual horizon, nm, with normal refraction (2.08 x sqrt of height in metres). */
export const visualHorizon = (heightM: number) => 2.08 * Math.sqrt(heightM);
/** Radar horizon, nm (2.21 x sqrt of height in metres). */
export const radarHorizon = (heightM: number) => 2.21 * Math.sqrt(heightM);
/** Range at which an object of `objectM` can first be seen by an observer at `eyeM`. */
export const visibleRange = (eyeM: number, objectM: number) => visualHorizon(eyeM) + visualHorizon(objectM);
export const radarRange = (antennaM: number, targetM: number) => radarHorizon(antennaM) + radarHorizon(targetM);

// ---- Wheel-over -------------------------------------------------------------------------------

/**
 * Distance before the waypoint at which to put the wheel over, in the same unit as `advance`/`transfer`.
 * Approximation: advance and transfer are those at the heading change `turn`, and the ship is taken to be
 * on the new track by the end of the turn. The new track then passes through the ship's position at that
 * point, which meets the old track `advance - transfer / tan(turn)` beyond the wheel-over point.
 */
export function wheelOverDistance(advance: number, transfer: number, turn: number): number | null {
  const t = Math.abs(turn);
  if (!(t >= 1 && t < 180)) return null;
  return advance - transfer / Math.tan(rad(t));
}

// ---- Units -------------------------------------------------------------------------------------

export interface UnitGroup { name: string; units: Record<string, number> }   // factor to the group's base unit

export const UNIT_GROUPS: UnitGroup[] = [
  { name: 'Distance', units: { 'nautical mile': 1852, 'cable (0.1 nm)': 185.2, 'kilometre': 1000, 'metre': 1, 'yard': 0.9144, 'foot': 0.3048, 'fathom': 1.8288, 'statute mile': 1609.344 } },
  { name: 'Speed', units: { 'knot': 1852 / 3600, 'metre/second': 1, 'kilometre/hour': 1 / 3.6, 'mile/hour': 0.44704 } },
];

export const convertUnit = (value: number, from: string, to: string, group: UnitGroup) =>
  (value * group.units[from]) / group.units[to];

// ---- Angle on the bow (ATB) -------------------------------------------------------------------

export type BowSide = 'Port' | 'Starboard';
/** `side` is null when we are dead ahead of the target (0) or dead astern of it (180). */
export interface BowAngle { angle: number; side: BowSide | null }

const EPS = 1e-9;

/**
 * Angle on the bow: where we are, measured from the target's head, 0-180 to port or starboard.
 * `bearingToTarget` is the true bearing from us to the target; the line of sight from the target to us is the reciprocal.
 */
export function angleOnBow(bearingToTarget: number, targetCourse: number): BowAngle {
  const r = norm360(bearingToTarget + 180 - targetCourse);   // our bearing from the target, relative to its head, clockwise
  if (r < EPS || Math.abs(r - 360) < EPS) return { angle: 0, side: null };
  if (Math.abs(r - 180) < EPS) return { angle: 180, side: null };
  return r < 180 ? { angle: r, side: 'Starboard' } : { angle: 360 - r, side: 'Port' };
}

export const targetCourseFromBowAngle = (bearingToTarget: number, angle: number, side: BowSide | null) =>
  norm360(bearingToTarget + 180 - (side === 'Port' ? -angle : angle));

// ---- Coordinates -------------------------------------------------------------------------------

export interface Pt { x: number; y: number }

/** Flat local plane in nautical miles (x east, y north) about (lat0, lon0). Good for the few miles a fix covers. */
export const toLocalNm = (lat: number, lon: number, lat0: number, lon0: number): Pt =>
  ({ x: (lon - lon0) * 60 * Math.cos(rad(lat0)), y: (lat - lat0) * 60 });
export const fromLocalNm = (p: Pt, lat0: number, lon0: number) =>
  ({ lat: lat0 + p.y / 60, lon: lon0 + p.x / (60 * Math.cos(rad(lat0))) });

/**
 * Reads a latitude or longitude typed the way it appears on a chart: "51.475", "-1.2", "51 28.5 N",
 * "51\u00B028.5'N", "1 12 30 W". Hemisphere letters override the sign. Returns decimal degrees, or null.
 */
export function parseCoord(text: string, kind: 'lat' | 'lon'): number | null {
  const letters = text.toUpperCase().match(/[NSEW]/g) ?? [];
  if (letters.length > 1) return null;
  if (letters[0] && !(kind === 'lat' ? 'NS' : 'EW').includes(letters[0])) return null;
  const nums = text.match(/\d+(\.\d+)?/g) ?? [];
  if (nums.length < 1 || nums.length > 3) return null;
  const [d, m = 0, s = 0] = nums.map(Number);
  if (m >= 60 || s >= 60) return null;
  const deg = d + m / 60 + s / 3600;
  if (deg > (kind === 'lat' ? 90 : 180)) return null;
  const negative = /^\s*-/.test(text) || letters[0] === 'S' || letters[0] === 'W';
  return negative ? -deg : deg;
}

/** An angle typed as degrees ("26.57"), degrees and minutes ("26 34.2") or with seconds. Positive only. */
export function parseAngle(text: string): number | null {
  const nums = text.match(/\d+(\.\d+)?/g) ?? [];
  if (nums.length < 1 || nums.length > 3 || /-/.test(text)) return null;
  const [d, m = 0, s = 0] = nums.map(Number);
  return m >= 60 || s >= 60 ? null : d + m / 60 + s / 3600;
}

/** 51.475 -> 51\u00B028.50'N */
export function formatCoord(deg: number, kind: 'lat' | 'lon'): string {
  const hemi = kind === 'lat' ? (deg < 0 ? 'S' : 'N') : (deg < 0 ? 'W' : 'E');
  let d = Math.floor(Math.abs(deg));
  let m = Math.round((Math.abs(deg) - d) * 6000) / 100;
  if (m >= 60) { d += 1; m = 0; }
  return `${d}\u00B0${m.toFixed(2).padStart(5, '0')}'${hemi}`;
}

// ---- Horizontal sextant angle (HSA) -------------------------------------------------------------

/** Radius of the position circle through two objects `baseline` apart that subtend `angle` at the observer. */
export const positionCircleRadius = (baseline: number, angle: number) => baseline / (2 * Math.sin(rad(angle)));

/** Distance off the baseline (same unit) when the observer is on the perpendicular bisector of the two objects. */
export const distanceOffHSA = (baseline: number, angle: number): number | null =>
  angle > 0 && angle < 180 && baseline > 0 ? baseline / 2 / Math.tan(rad(angle / 2)) : null;

export type HsaFix =
  | { x: number; y: number; ranges: [number, number, number]; bearings: [number, number, number]; weak: boolean }
  | { error: string };

const bearingTo = (from: Pt, to: Pt) => norm360(deg(Math.atan2(to.x - from.x, to.y - from.y)));

/**
 * Position from two horizontal sextant angles between three objects, as seen from the observer with A on the
 * left, B in the middle and C on the right: `alpha` between A and B, `beta` between B and C. Each angle puts the
 * observer on a circle through its two objects; the circles meet at B and at the observer.
 * `weak` is set when the circles meet at a shallow angle, i.e. the observer is near the danger circle through A, B, C.
 */
export function hsaFix(A: Pt, B: Pt, C: Pt, alpha: number, beta: number): HsaFix {
  if (!(alpha > 0 && beta > 0 && alpha + beta < 180)) return { error: 'Each angle must be above 0\u00B0 and together below 180\u00B0.' };
  const len = (P: Pt, Q: Pt) => Math.hypot(Q.x - P.x, Q.y - P.y);
  if (len(A, B) < EPS || len(B, C) < EPS) return { error: 'The objects must be at three different positions.' };

  // The observer sees the pair left-to-right, so is on the right-hand side of the directed line from the left object to the right one.
  const circle = (P: Pt, Q: Pt, angle: number) => {
    const L = len(P, Q);
    const R = L / (2 * Math.sin(rad(angle)));
    const right = { x: (Q.y - P.y) / L, y: -(Q.x - P.x) / L };
    const offset = R * Math.cos(rad(angle));            // negative for angles over 90\u00B0: the centre is then on the far side
    return { O: { x: (P.x + Q.x) / 2 + right.x * offset, y: (P.y + Q.y) / 2 + right.y * offset }, R };
  };
  const c1 = circle(A, B, alpha), c2 = circle(B, C, beta);
  const d = { x: c2.O.x - c1.O.x, y: c2.O.y - c1.O.y };
  const L = Math.hypot(d.x, d.y);
  if (L < 1e-9 * Math.max(c1.R, c2.R)) return { error: 'The observer is on the danger circle through all three objects: the angles give no single position.' };

  // Second intersection of the circles = reflection of B in the line of centres.
  const u = { x: d.x / L, y: d.y / L };
  const t = (B.x - c1.O.x) * u.x + (B.y - c1.O.y) * u.y;
  const foot = { x: c1.O.x + u.x * t, y: c1.O.y + u.y * t };
  const P = { x: 2 * foot.x - B.x, y: 2 * foot.y - B.y };
  if (len(P, B) < 1e-6 * Math.max(c1.R, c2.R)) return { error: 'The circles only touch at the middle object: the angles give no usable position.' };

  const bA = bearingTo(P, A), bB = bearingTo(P, B), bC = bearingTo(P, C);
  const near = (x: number, y: number) => Math.abs(norm360(x - y + 180) - 180) < 0.05;
  if (!near(norm360(bB - bA), alpha) || !near(norm360(bC - bB), beta)) {
    return { error: "These angles don't fit these objects in this order. Check that A is on the left, B in the middle and C on the right as you look at them." };
  }
  // sine of the angle between the two circles where they cross
  const r1 = { x: P.x - c1.O.x, y: P.y - c1.O.y }, r2 = { x: P.x - c2.O.x, y: P.y - c2.O.y };
  const sinCross = Math.abs(r1.x * r2.y - r1.y * r2.x) / (Math.hypot(r1.x, r1.y) * Math.hypot(r2.x, r2.y));
  return { x: P.x, y: P.y, ranges: [len(P, A), len(P, B), len(P, C)], bearings: [bA, bB, bC], weak: sinCross < 0.3 };
}
