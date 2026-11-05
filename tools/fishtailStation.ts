// When a change of station is made by fishtail. Going from ahead to the bow, beam, quarter or astern of the Guide, or from the beam to the quarter or
// astern, or from one beam to the other, a ship cannot simply steer a straight Battenberg course: she drops back (or crosses) by a fishtail, the "round
// the clock" manoeuvres of BR 45(6) para 0429, especially at small ranges. This works out whether a requested change is one, and which manoeuvre the book gives.
// Pure; `node tools/fishtailStation.check.ts`.

import { STATIONS, roundTheClock } from './stationChanges.ts';
import type { Solution, Station } from './stationChanges.ts';

/** Angle off the Guide's bow of each standard station. */
export const STATION_ANGLE: Record<Station, number> = { Ahead: 0, 'Bow (45)': 45, Abeam: 90, Quarter: 135, Astern: 180 };
/** Ranges up to this (nautical miles) are "small": the ships are close enough that a fishtail is the way to change station. */
export const SMALL_RANGE_NM = 2;
/** A change of bearing under this many degrees is not a change of station. */
const MIN_CHANGE = 20;

/** The standard station nearest to an angle off the bow, 0 to 180 degrees. */
export const nearestStation = (angleOffBow: number): Station => {
  const a = Math.min(180, Math.max(0, Math.abs(angleOffBow)));
  return STATIONS.reduce((best, s) => (Math.abs(STATION_ANGLE[s] - a) < Math.abs(STATION_ANGLE[best] - a) ? s : best), STATIONS[0]);
};

export interface Nearby { from: Station; to: Station; solution: Solution }
export interface FishtailAdvice {
  from: Station; to: Station;
  /** the two stations are on opposite sides of the Guide */
  opposite: boolean;
  /** both ranges are small, so a fishtail is the way to make the change */
  small: boolean;
  /** the book's suggested manoeuvre for this pair, when para 0429 has one */
  solution: Solution | null;
  /** when it has not, the neighbouring changes it does give */
  nearby: Nearby[];
}

/**
 * `offFrom` and `offTo` are angles off the Guide's bow, positive to starboard and negative to port (-180 to 180); the ranges are in nautical miles.
 * Returns null when the change is not one made by fishtail (to a station further ahead, or only a small change of bearing).
 */
export function fishtailAdvice(i: { offFrom: number; offTo: number; rangeFromNm: number; rangeToNm: number; smallNm?: number }): FishtailAdvice | null {
  const aF = Math.abs(i.offFrom), aT = Math.abs(i.offTo);
  const from = nearestStation(aF), to = nearestStation(aT);
  const opposite = i.offFrom * i.offTo < 0;
  const dropsAft = STATIONS.indexOf(to) > STATIONS.indexOf(from) && aT - aF >= MIN_CHANGE;
  const crossesBeam = from === 'Abeam' && to === 'Abeam' && opposite;
  if (!dropsAft && !crossesBeam) return null;
  const solution = roundTheClock(from, to, opposite ? 'opposite' : 'same');
  const nearby: Nearby[] = [];
  if (!solution) {
    const fi = STATIONS.indexOf(from), ti = STATIONS.indexOf(to);
    for (const [f, t] of [[fi, ti - 1], [fi, ti + 1], [fi + 1, ti], [fi - 1, ti]] as const) {
      const sf = STATIONS[f], st = STATIONS[t];
      const s = sf && st && sf !== st && STATIONS.indexOf(st) > STATIONS.indexOf(sf) ? roundTheClock(sf, st) : null;
      if (s && !nearby.some(n => n.from === sf && n.to === st)) nearby.push({ from: sf, to: st, solution: s });
    }
  }
  return { from, to, opposite, small: Math.max(i.rangeFromNm, i.rangeToNm) <= (i.smallNm ?? SMALL_RANGE_NM), solution, nearby: nearby.slice(0, 3) };
}

/** A short plain-words version of the advice, for the assistant. */
export function fishtailSummary(a: FishtailAdvice): string {
  const head = `${a.from} to ${a.to} is a change made by fishtail${a.small ? ', as the ranges are small' : ''}, not by a steady course`;
  if (a.solution) return `${head} (BR 45(6) para ${a.solution.para}): ${a.solution.text[0]}`;
  const n = a.nearby[0];
  return n ? `${head}. Para 0429 has no solution for that pair; the nearest is ${n.from} to ${n.to} (para ${n.solution.para}): ${n.solution.text[0]}` : `${head}; para 0429 has no solution for that pair.`;
}
