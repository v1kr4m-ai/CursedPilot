// Taking and changing station on a Guide: the course to steer, by the relative velocity triangle of BR 45(6) para 0423
// (Example 4-1), and the point to reduce speed with the Deceleration Distance of para 0424. Positions are those of own
// ship relative to the Guide, so a station is "bearing on the Guide's head and distance". Pure; `node tools/battenberg.check.ts`.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const norm = (d: number) => ((d % 360) + 360) % 360;

export interface Vec { x: number; y: number }          // x east, y north; any length unit (the result is in the same unit)
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const len = (a: Vec) => Math.hypot(a.x, a.y);

/** Own ship's position relative to the Guide, from the true bearing of own ship from the Guide and the distance. */
export const place = (trueBearing: number, distance: number): Vec => ({ x: distance * Math.sin(rad(trueBearing)), y: distance * Math.cos(rad(trueBearing)) });
export const bearingOf = (v: Vec) => norm(deg(Math.atan2(v.x, v.y)));
/** True bearing of a station given on the Guide's head: the Guide's course plus the angle off her bow (clockwise). */
export const stationBearing = (guideCourse: number, offBow: number) => norm(guideCourse + offBow);

export interface Solution {
  /** the course to steer, true */
  course: number;
  /** speed of own ship over the relative track, knots */
  relativeSpeed: number;
  /** direction own ship moves relative to the Guide */
  relativeCourse: number;
  /** hours from now to the new station along the relative track */
  hours: number;
}

export interface Problem {
  guideCourse: number; guideSpeed: number;     // true, knots
  stationingSpeed: number;                     // own speed while closing, knots
  from: Vec;                                   // own ship now, relative to the Guide, in n miles
  to: Vec;                                     // the ordered station, relative to the Guide, in n miles
}

/**
 * The courses that take own ship from `from` to `to` over the ground-relative track at the stationing speed.
 * Own velocity = Guide's velocity + relative velocity, and the relative velocity lies along from -> to. Up to two courses
 * (para 0423: "establish which of two possible positions is correct"); the quicker one comes first. Empty when the
 * stationing speed is too low to make that relative track good.
 */
export function solve(p: Problem): Solution[] {
  const d = { x: p.to.x - p.from.x, y: p.to.y - p.from.y }, dist = len(d);
  if (dist < 1e-9 || !(p.stationingSpeed > 0)) return [];
  const u = { x: d.x / dist, y: d.y / dist };
  const g = { x: p.guideSpeed * Math.sin(rad(p.guideCourse)), y: p.guideSpeed * Math.cos(rad(p.guideCourse)) };
  const b = dot(g, u), disc = b * b - (p.guideSpeed ** 2 - p.stationingSpeed ** 2);
  if (disc < 0) return [];
  const out: Solution[] = [];
  for (const k of [-b + Math.sqrt(disc), -b - Math.sqrt(disc)]) {
    if (!(k > 1e-9)) continue;
    if (out.some(s => Math.abs(s.relativeSpeed - k) < 1e-9)) continue;
    const v = { x: g.x + k * u.x, y: g.y + k * u.y };
    out.push({ course: bearingOf(v), relativeSpeed: k, relativeCourse: bearingOf(u), hours: dist / k });
  }
  return out.sort((a, b2) => b2.relativeSpeed - a.relativeSpeed);
}

export interface Slowing {
  /** yards (or the length unit of the inputs) the ship runs while she slows from the stationing speed to the Guide's */
  decelDistance: number;
  /** distance back along the relative track from the station at which to reduce, in n miles */
  backAlongTrack: number;
  /** true when the whole run is shorter than that: reduce at once, or close at a lower speed */
  immediately: boolean;
  /** own ship's position relative to the Guide at that moment, and the true bearing of the Guide from own ship there */
  at: Vec; guideBearsTrue: number; distance: number;
}

/**
 * Para 0424: the Deceleration Distance is (stationing speed - ordered speed) x loss of speed per knot. Along the relative
 * track it is scaled by (relative speed / own speed), and measured back from the station.
 */
export function slowing(p: Problem, s: Solution, lossPerKnotNm: number): Slowing | null {
  const orderedSpeed = p.guideSpeed;
  if (!(p.stationingSpeed > orderedSpeed) || !(lossPerKnotNm > 0)) return null;
  const decelDistance = (p.stationingSpeed - orderedSpeed) * lossPerKnotNm;
  const back = decelDistance * (s.relativeSpeed / p.stationingSpeed);
  const d = { x: p.to.x - p.from.x, y: p.to.y - p.from.y }, dist = len(d);
  const u = { x: d.x / dist, y: d.y / dist };
  const alongRun = Math.max(0, dist - back);
  const at = { x: p.from.x + u.x * alongRun, y: p.from.y + u.y * alongRun };
  return { decelDistance, backAlongTrack: back, immediately: back >= dist, at, guideBearsTrue: norm(bearingOf(at) + 180), distance: len(at) };
}

export interface Profile {
  /** hours from the start to being on station */
  totalHours: number;
  /** own ship's position relative to the Guide, n miles, and her speed along the relative track in knots, `hours` into the run */
  at(hours: number): { pos: Vec; relSpeed: number };
  /** the Guide's position after `hours` (she starts at the origin) */
  guideAt(hours: number): Vec;
}

/**
 * The run played in time. Own ship closes along the relative track at the relative speed k; at the point to reduce speed her
 * relative speed falls steadily to nothing over the deceleration distance, and she is on station when it reaches nothing.
 * With no deceleration figure she runs at k and stops on the station.
 */
export function profile(p: Problem, s: Solution, slow: Slowing | null): Profile {
  const d = { x: p.to.x - p.from.x, y: p.to.y - p.from.y }, dist = len(d);
  const u = dist > 0 ? { x: d.x / dist, y: d.y / dist } : { x: 0, y: 0 };
  const k = s.relativeSpeed;
  const back = slow ? Math.min(slow.backAlongTrack, dist) : 0;
  const run = dist - back, t1 = run / k, t2 = back > 0 ? (2 * back) / k : 0;
  const g = { x: p.guideSpeed * Math.sin(rad(p.guideCourse)), y: p.guideSpeed * Math.cos(rad(p.guideCourse)) };
  const along = (h: number) => {
    if (h <= t1) return { s: k * h, v: k };
    const tau = Math.min(h - t1, t2);
    return t2 > 0 ? { s: run + k * (tau - (tau * tau) / (2 * t2)), v: k * (1 - tau / t2) } : { s: dist, v: 0 };
  };
  return {
    totalHours: t1 + t2,
    at: h => { const a = along(Math.max(0, h)); return { pos: { x: p.from.x + u.x * a.s, y: p.from.y + u.y * a.s }, relSpeed: a.v }; },
    guideAt: h => ({ x: g.x * h, y: g.y * h }),
  };
}
