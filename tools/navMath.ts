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
