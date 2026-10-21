// Relative velocity problems of the REL-VEL docket, solved without a plot. Positions are the other ship relative to own ship (x east,
// y north, n miles); velocities are knots. Own velocity + relative velocity of the other ship = her true velocity:
//   other's relative position P changes at (other's velocity - own velocity). Pure; `node tools/relvel.check.ts`.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const norm = (d: number) => ((d % 360) + 360) % 360;

export interface V { x: number; y: number }
export const vec = (course: number, speed: number): V => ({ x: speed * Math.sin(rad(course)), y: speed * Math.cos(rad(course)) });
export const pos = (bearing: number, range: number): V => vec(bearing, range);
export const courseOf = (v: V) => norm(deg(Math.atan2(v.x, v.y)));
export const speedOf = (v: V) => Math.hypot(v.x, v.y);
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y;
const cross = (a: V, b: V) => a.x * b.y - a.y * b.x;

// ---- the other ship's course and speed from her plotted relative track -----------------------------------------------------------------
export interface Obs { minutes: number; bearing: number; range: number }
export interface Contact { course: number; speed: number; relCourse: number; relSpeed: number; rel: V; last: V }
/** Least-squares line through the plotted positions (two or more); the relative velocity is its slope, the true velocity adds own velocity. */
export function contactFromPlots(ownCourse: number, ownSpeed: number, obs: Obs[]): Contact | null {
  if (obs.length < 2) return null;
  const n = obs.length, t = obs.map(o => o.minutes / 60), p = obs.map(o => pos(o.bearing, o.range));
  const tm = t.reduce((a, b) => a + b, 0) / n, xm = p.reduce((a, b) => a + b.x, 0) / n, ym = p.reduce((a, b) => a + b.y, 0) / n;
  const stt = t.reduce((a, b) => a + (b - tm) ** 2, 0);
  if (!(stt > 0)) return null;
  const rel: V = { x: t.reduce((a, b, i) => a + (b - tm) * (p[i].x - xm), 0) / stt, y: t.reduce((a, b, i) => a + (b - tm) * (p[i].y - ym), 0) / stt };
  const tv = add(rel, vec(ownCourse, ownSpeed));
  return { course: courseOf(tv), speed: speedOf(tv), relCourse: courseOf(rel), relSpeed: speedOf(rel), rel, last: { x: xm + rel.x * (t[n - 1] - tm), y: ym + rel.y * (t[n - 1] - tm) } };
}

// ---- when will she be a given range off ---------------------------------------------------------------------------------------------------
export interface Event { minutes: number; bearing: number }
export interface Approach { cpa: number; cpaMinutes: number; cpaBearing: number; events: Event[] }
/** From relative position `p0` moving at relative velocity `rel`: the closest approach, and the times (after now) she is `range` away. */
export function approach(p0: V, rel: V, range?: number): Approach | null {
  const s2 = dot(rel, rel);
  if (!(s2 > 1e-12)) return null;
  const tc = -dot(p0, rel) / s2, pc = { x: p0.x + rel.x * tc, y: p0.y + rel.y * tc };
  const events: Event[] = [];
  if (range !== undefined) {
    const b = dot(p0, rel), c = dot(p0, p0) - range * range, d = b * b - s2 * c;
    if (d >= 0) for (const t of [(-b - Math.sqrt(d)) / s2, (-b + Math.sqrt(d)) / s2]) if (t >= 0) events.push({ minutes: t * 60, bearing: courseOf({ x: p0.x + rel.x * t, y: p0.y + rel.y * t }) });
  }
  return { cpa: Math.hypot(pc.x, pc.y), cpaMinutes: tc * 60, cpaBearing: courseOf(pc), events };
}

// ---- closing a faster ship: the closest she can be got ---------------------------------------------------------------------------------------
export interface Closest { course: number; cpa: number; minutes: number; bearing: number; rel: V }
/** Own speed `s` is below the other ship's, so no course keeps her on a steady bearing: choose the course that brings the relative track nearest. */
export function closeFaster(p0: V, targetCourse: number, targetSpeed: number, s: number): Closest | null {
  const vt = vec(targetCourse, targetSpeed);
  let best: Closest | null = null;
  const at = (c: number): Closest | null => {
    const rel = sub(vt, vec(c, s)), s2 = dot(rel, rel);
    if (!(s2 > 1e-12)) return null;
    const tc = -dot(p0, rel) / s2;
    if (tc < 0) return null;
    const pc = { x: p0.x + rel.x * tc, y: p0.y + rel.y * tc };
    return { course: c, cpa: Math.hypot(pc.x, pc.y), minutes: tc * 60, bearing: courseOf(pc), rel };
  };
  for (let c = 0; c < 360; c += 0.5) { const r = at(c); if (r && (!best || r.cpa < best.cpa)) best = r; }
  if (!best) return null;
  for (let step = 0.25; step > 1e-6; step /= 2) for (const c of [best.course - step, best.course + step]) { const r = at(norm(c)); if (r && r.cpa < best.cpa) best = r; }
  return best;
}

// ---- passing at a given distance ----------------------------------------------------------------------------------------------------------------
export interface Pass { side: 'ahead' | 'astern'; course: number; minutes: number; bearing: number; rel: V }
/** Courses at speed `s` that make the relative track just touch a circle of `distance` about own ship: one passes ahead of the other ship, one astern. */
export function passAt(p0: V, targetCourse: number, targetSpeed: number, s: number, distance: number): Pass[] {
  const vt = vec(targetCourse, targetSpeed), r0 = Math.hypot(p0.x, p0.y);
  if (!(r0 > distance)) return [];
  const out: Pass[] = [];
  const base = deg(Math.atan2(-p0.x, -p0.y)), off = deg(Math.asin(distance / r0));      // direction from P toward own ship, and the tangent's offset from it
  for (const u of [base + off, base - off]) {
    const d = vec(u, 1);                                                                // unit direction of the relative track
    // own velocity = vt - k d with |own| = s: k^2 - 2 k (vt . d) + |vt|^2 - s^2 = 0
    const b = dot(vt, d), disc = b * b - (dot(vt, vt) - s * s);
    if (disc < 0) continue;
    for (const k of [b + Math.sqrt(disc), b - Math.sqrt(disc)]) {
      if (!(k > 1e-9)) continue;
      const rel = { x: d.x * k, y: d.y * k }, own = sub(vt, rel);
      const tc = -dot(p0, rel) / dot(rel, rel);
      if (tc < 0) continue;
      const pc = { x: p0.x + rel.x * tc, y: p0.y + rel.y * tc };
      const ahead = dot({ x: -pc.x, y: -pc.y }, vt) > 0;          // own ship is ahead of the other ship when, from her, own lies along her heading
      out.push({ side: ahead ? 'ahead' : 'astern', course: courseOf(own), minutes: tc * 60, bearing: courseOf(pc), rel });
    }
  }
  const seen = new Set<string>();
  return out.filter(o => { const k = `${o.side}${o.course.toFixed(3)}`; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (a.side === b.side ? a.minutes - b.minutes : a.side === 'ahead' ? -1 : 1));
}

// ---- stations ---------------------------------------------------------------------------------------------------------------------------------------
/** Course and speed to go from `from` to `to` (own ship relative to the Guide) in `hours`. */
export function stationInTime(guideCourse: number, guideSpeed: number, from: V, to: V, hours: number): { course: number; speed: number } | null {
  if (!(hours > 0)) return null;
  const own = add(vec(guideCourse, guideSpeed), { x: (to.x - from.x) / hours, y: (to.y - from.y) / hours });
  return { course: courseOf(own), speed: speedOf(own) };
}
/** How close own ship comes to the Guide on the run, and the first time and bearing she is within `visibility` of her (Guide bearing from own ship). */
export function stationRun(from: V, to: V, relSpeed: number, visibility?: number): { closest: number; closestBearing: number; sight: Event | null } {
  const d = sub(to, from), len = Math.hypot(d.x, d.y), u = { x: d.x / len, y: d.y / len };
  const t = Math.max(0, Math.min(len, -dot(from, u))), c = { x: from.x + u.x * t, y: from.y + u.y * t };
  let sight: Event | null = null;
  if (visibility !== undefined) {
    const b = dot(from, u), cc = dot(from, from) - visibility * visibility, disc = b * b - cc;
    if (disc >= 0 && cc > 0) { const s = -b - Math.sqrt(disc); if (s >= 0 && s <= len) sight = { minutes: (s / relSpeed) * 60, bearing: courseOf({ x: -(from.x + u.x * s), y: -(from.y + u.y * s) }) }; }
  }
  return { closest: Math.hypot(c.x, c.y), closestBearing: courseOf({ x: -c.x, y: -c.y }), sight };
}
void cross;
