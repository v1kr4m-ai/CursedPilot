// Pure sums for the phone's sensors: compass heading from the orientation angles, the average of several readings,
// and speed units. `node tools/sensors.check.ts` checks it.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Compass heading (degrees clockwise from north, 0-360) from the W3C orientation angles.
 * Phone lying flat or tilted less than 45 degrees: the way the top of the phone points (put the top towards the bow).
 * Phone held upright: the way the back camera looks.
 */
export function compassHeading(alpha: number, beta: number, gamma: number): number {
  if (Math.abs(beta) < 45) return (((360 - alpha) % 360) + 360) % 360;
  const cZ = Math.cos(rad(alpha)), sZ = Math.sin(rad(alpha)), cX = Math.cos(rad(beta)), sX = Math.sin(rad(beta)), sY = Math.sin(rad(gamma)), cY = Math.cos(rad(gamma));
  const vx = -cZ * sY - sZ * sX * cY, vy = -sZ * sY + cZ * sX * cY;
  return (deg(Math.atan2(vx, vy)) + 360) % 360;
}

/** Mean of directions (not a simple average: 359 and 1 average to 0) and how widely they scatter, both in degrees. */
export function circularMean(angles: number[]): { mean: number; spread: number } {
  if (!angles.length) return { mean: NaN, spread: NaN };
  const s = angles.reduce((a, x) => a + Math.sin(rad(x)), 0) / angles.length, c = angles.reduce((a, x) => a + Math.cos(rad(x)), 0) / angles.length;
  const r = Math.min(1, Math.hypot(s, c));
  return { mean: (deg(Math.atan2(s, c)) + 360) % 360, spread: deg(Math.sqrt(-2 * Math.log(Math.max(r, 1e-12)))) };
}

export const SPEED_UNITS = { kn: { label: 'kn', perKnot: 1 }, kmh: { label: 'km/h', perKnot: 1.852 }, ms: { label: 'm/s', perKnot: 0.514444 }, mph: { label: 'mph', perKnot: 1.150779 } } as const;
export type SpeedUnit = keyof typeof SPEED_UNITS;
export const SPEED_UNIT_KEYS = Object.keys(SPEED_UNITS) as SpeedUnit[];
export const isSpeedUnit = (s: string): s is SpeedUnit => s in SPEED_UNITS;
export const toKnots = (v: number, u: SpeedUnit) => v / SPEED_UNITS[u].perKnot;
export const fromKnots = (kn: number, u: SpeedUnit) => kn * SPEED_UNITS[u].perKnot;
/** metres per second (what the GPS reports) to knots */
export const msToKnots = (ms: number) => ms / 0.514444;

/** True bearing from a magnetic one: variation East is plus, West minus. */
export const trueFromMagnetic = (magnetic: number, variation: number) => (((magnetic + variation) % 360) + 360) % 360;

/** An object's bearing relative to the ship's head: 0-360 clockwise, and as an angle off the bow with the side it is on. */
export function relativeTo(trueBearing: number, shipHead: number): { rel360: number; off: number; side: 'Port' | 'Starboard' } {
  const rel = (((trueBearing - shipHead) % 360) + 360) % 360;
  return { rel360: rel, off: rel <= 180 ? rel : 360 - rel, side: rel <= 180 ? 'Starboard' : 'Port' };
}
