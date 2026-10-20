// Flying Corpen: the course and speed that give a helicopter the wind over the deck it needs, from the true wind. Also the
// true wind from the wind measured on deck. Winds are named by the direction they blow FROM, as at sea; relative winds are
// angles off the bow, + to starboard (Green), - to port (Red). Pure; `node tools/flyingCorpen.check.ts` checks it.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** Any angle as -180..180 */
export const signed = (d: number) => { const n = norm360(d); return n > 180 ? n - 360 : n; };

export interface Wind { from: number; speed: number }          // true bearing the wind blows from, knots

/** The vector a wind moves along (towards), and a ship's velocity, in knots with x east and y north. */
const windVec = (w: Wind) => ({ x: -w.speed * Math.sin(rad(w.from)), y: -w.speed * Math.cos(rad(w.from)) });
const shipVec = (course: number, speed: number) => ({ x: speed * Math.sin(rad(course)), y: speed * Math.cos(rad(course)) });

/** The wind a ship feels on deck: where it comes from (true, and off the bow, -180..180) and how fast. */
export function apparentWind(course: number, speed: number, wind: Wind): { from: number; rel: number; speed: number } {
  const w = windVec(wind), v = shipVec(course, speed);
  const a = { x: v.x - w.x, y: v.y - w.y };                     // the wind relative to the ship comes FROM the direction of ship's velocity less the wind's
  const from = norm360(deg(Math.atan2(a.x, a.y)));
  return { from, rel: signed(from - course), speed: Math.hypot(a.x, a.y) };
}

/** The true wind, from the wind measured on deck (off the bow, + starboard, and its speed) with the ship's course and speed. */
export function trueWind(course: number, speed: number, relFrom: number, appSpeed: number): Wind {
  const v = shipVec(course, speed), onDeck = shipVec(course + relFrom, appSpeed);   // onDeck points FROM where the wind seems to come, so it is minus the apparent-wind vector
  const w = { x: onDeck.x - v.x, y: onDeck.y - v.y };            // true wind vector (towards) is minus that
  const tw = { x: -w.x, y: -w.y };
  return { from: norm360(deg(Math.atan2(-tw.x, -tw.y))), speed: Math.hypot(tw.x, tw.y) };
}

export interface Flying {
  /** the flying course, true; null when there is no wind and any course will do */
  course: number | null;
  /** the speed through the water that gives the wind over the deck asked for, knots */
  speed: number;
  /** true when the ship runs downwind faster than the wind to bring it from ahead */
  downwind: boolean;
}

/**
 * The courses and speeds that give a wind over the deck of `wod` knots from `theta` degrees off the bow (+ starboard).
 * With the wind vector w, the ship's velocity v and the wanted wind on deck u(C + theta) x wod: v - w = wod u(C + theta), so
 * the cross-deck part gives sin (C - D) = -(wod / wind) sin theta, and the along-deck part gives the speed
 * speed = wod cos theta - wind cos (D - C). Two courses satisfy the first; those with a speed of nothing or more are kept,
 * the slower first. Empty when the wind is too light to give that angle at all.
 */
export function flyingCourses(wind: Wind, wod: number, theta: number): Flying[] {
  if (!(wod > 0)) return [];
  if (!(wind.speed > 1e-9)) return [{ course: null, speed: wod, downwind: false }];
  const x = (-wod / wind.speed) * Math.sin(rad(theta));
  if (Math.abs(x) > 1 + 1e-12) return [];
  const a = deg(Math.asin(Math.max(-1, Math.min(1, x))));
  const out: Flying[] = [];
  for (const c of [norm360(wind.from + a), norm360(wind.from + 180 - a)]) {
    const speed = wod * Math.cos(rad(theta)) - wind.speed * Math.cos(rad(wind.from - c));
    if (speed < -1e-9) continue;
    if (out.some(o => o.course !== null && Math.abs(signed(o.course - c)) < 1e-6 && Math.abs(o.speed - speed) < 1e-6)) continue;
    out.push({ course: c, speed: Math.max(0, speed), downwind: Math.abs(signed(c - wind.from)) > 90 });
  }
  return out.sort((p, q) => p.speed - q.speed);
}

/** The shortest turn from one course to another, degrees: + to starboard, - to port. */
export const turnBetween = (from: number, to: number) => signed(to - from);
