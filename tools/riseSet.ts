// Sunrise, sunset, twilight and meridian passage for a position and date, the Sun's true bearing at rising and
// setting (the amplitude), and the compass or gyro error from an observed bearing. Pure; `node tools/riseSet.check.ts`.
// Rising and setting are for the Sun's upper limb on the horizon with standard refraction (centre 50' below it), as in
// the almanac, or as seen from the height of eye (the horizon dips). Twilight is for the centre 6, 12 and 18 degrees down.
import { sunAt } from './sunEphemeris.ts';
import { meridianPassageJd, reduce } from './sunSights.ts';
import type { Pos } from './sunSights.ts';

const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const mod360 = (d: number) => ((d % 360) + 360) % 360;

export type Event = 'rise' | 'set';

/** Julian day (UT) at which the Sun's centre has altitude `h0` degrees, on the morning or evening around `mp` (the meridian passage). Null when it does not happen. */
export function crossing(pos: Pos, mp: number, morning: boolean, h0: number): number | null {
  const f = (jd: number) => reduce(sunAt(jd), pos).hc - h0;
  let lo = morning ? mp - 0.5 : mp, hi = morning ? mp : mp + 0.5;
  const flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if ((fm > 0) === (flo > 0)) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface SunTimes {
  meridianPassage: number;
  rise: number | null; set: number | null;
  /** true bearing of the Sun at rising and setting from the position */
  riseBearing: number | null; setBearing: number | null;
  civil: [number | null, number | null];          // start in the morning, end in the evening
  nautical: [number | null, number | null];
  astronomical: [number | null, number | null];
  /** the Sun's declination at meridian passage */
  dec: number;
}

/** `jdNoon` is any moment around local noon of the day wanted (e.g. 12:00 zone time). `dipDeg` is the dip of the horizon for the height of eye, 0 for almanac values. */
export function sunTimes(pos: Pos, jdNoon: number, dipDeg = 0): SunTimes {
  const mp = meridianPassageJd(pos.lon, jdNoon);
  const horizon = -(50 / 60) - dipDeg;
  const rise = crossing(pos, mp, true, horizon), set = crossing(pos, mp, false, horizon);
  const pair = (h: number): [number | null, number | null] => [crossing(pos, mp, true, h), crossing(pos, mp, false, h)];
  const bearing = (jd: number | null) => (jd === null ? null : reduce(sunAt(jd), pos).zn);
  return {
    meridianPassage: mp, rise, set, riseBearing: bearing(rise), setBearing: bearing(set),
    civil: pair(-6), nautical: pair(-12), astronomical: pair(-18), dec: sunAt(mp).dec,
  };
}

/** The Sun's true bearing and altitude at a moment, from a position. */
export function sunBearing(pos: Pos, jd: number): { zn: number; hc: number } {
  const r = reduce(sunAt(jd), pos);
  return { zn: r.zn, hc: r.hc };
}

/** Error of a compass or gyro: true bearing less the bearing observed. Positive when the compass reads too low (error east). */
export const compassError = (trueBearing: number, observed: number): number => wrap180(trueBearing - observed);

/** The amplitude: the angle from east (rising) or west (setting) towards north or south, as "E 12.3° N". Bearing 000 to 360. */
export function amplitude(bearing: number, event: Event): string {
  const b = mod360(bearing);
  const d = Math.abs(wrap180(b - (event === 'rise' ? 90 : 270)));
  const north = event === 'rise' ? b < 90 : b > 270;     // rising: below 090 is north of east; setting: above 270 is north of west
  return `${event === 'rise' ? 'E' : 'W'} ${d.toFixed(1)}° ${north ? 'N' : 'S'}`;
}

/** Dip of the horizon in degrees for a height of eye in metres. */
export const dipDegrees = (hoeM: number): number => (0.0293 * Math.sqrt(Math.max(0, hoeM)));
