// RAS approach between a Guide (the supplier) and an approach ship (the receiver), for three evolutions that match different points on the two
// ships at the final station:
//   SKBDL  bridge to bridge       RASAP  RAS point to RAS point       UNREP  fuelling point to fuelling point
// The approach ship runs up on the Guide at a speed above hers and comes down to her speed. While she slows she gains on the Guide by the
// surge, so she starts slowing the surge short of the final station. Worked as on the bridge:
//   surge (yd) = speed advantage (kn) x the ship's surge rate (yd per kn), turned into metres
//   x = surge - (the Guide's matching point to her stern) - (own stem to own matching point): the gap from the Guide's stern to own stem when
//       she starts slowing (negative: her bow overlaps the Guide's quarter)
//   theta = atan((x + own stem to bridge) / distance between the ships): where the Guide's stern bears from own bridge, forward of the beam
//   and from own radar (when its distance from the stem is known): how far ahead of the radar her stern is, along the ship, and its angle from the beam
// Positions on each ship are stem-to-point distances (metres). Pure; `node tools/rasApproach.check.ts`.

import type { Ship } from '../types.ts';

export type Evolution = 'SKBDL' | 'RASAP' | 'UNREP';
export const EVOLUTIONS: Record<Evolution, { label: string; point: 'bridge' | 'ras' | 'fuel'; pointName: string }> = {
  SKBDL: { label: 'SKBDL: bridge to bridge', point: 'bridge', pointName: 'bridge' },
  RASAP: { label: 'RASAP: RAS point to RAS point', point: 'ras', pointName: 'RAS point' },
  UNREP: { label: 'UNREP: fuelling point to fuelling point', point: 'fuel', pointName: 'fuelling point' },
};

export interface Dims { bridge?: number; ras?: number; fuel?: number; /** metres */ breadth?: number; /** length overall, metres */ length?: number; /** own radar aerial's distance from the stem, metres */ radar?: number }

/** The rigs a ship can supply from alongside (a stern rig is not an alongside approach). */
export const alongsideRigs = (s?: Ship) => (s?.particulars?.rigs ?? []).filter(r => r.side !== 'Astern');
export const dimsOf = (s?: Ship): Dims => {
  const p = s?.particulars;
  const pos = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined);
  return { bridge: pos(p?.stemToBridge), ras: pos(p?.stemToRas), fuel: pos(p?.stemToFueling), breadth: pos(p?.breadthOverall), length: pos(p?.lengthOverall), radar: pos(p?.stemToRadar) };
};

const YD_PER_M = 1 / 0.9144;
export interface Input {
  evolution: Evolution;
  guide: Dims; approach: Dims;
  guideSpeed: number; approachSpeed: number;     // knots
  surgeYdPerKnot: number;                        // the approach ship's surge rate: yards gained per knot of speed advantage
  separationM: number;                           // distance between the ships alongside, metres (the side of the triangle for theta)
  standbyYd: number;                             // the stand-by station: yards astern of the final station
}
export interface Plan {
  advantage: number;             // knots
  surgeYd: number;               // yards gained on the Guide while slowing
  surgeM: number;
  /** the Guide's matching point to her stern, metres (her length less its distance from her stem) */
  pointToStern: number;
  /** the Guide's stern to own stem when she starts slowing, metres; negative: overlapping */
  xM: number;
  /** where the Guide's stern bears from own bridge then, degrees forward of the beam (negative: abaft it) */
  thetaDeg: number;
  /** from own radar, when its position is known: her stern's distance ahead of the radar along the ship (m; negative: abaft it), not the slant
   *  range across to her, and its angle forward of the beam */
  radar?: { rangeM: number; thetaDeg: number };
  stemOffsetM: number;           // at the final station the approach ship's stem is this far ahead of the Guide's stem (negative: astern)
  runYd: number;                 // from the stand-by station to the slowing point
  runMinutes: number;            // at the speed advantage
  atOnce: boolean;               // the stand-by station is already inside the surge
  missing: string[];             // the dimensions this evolution needs and the ships do not give
}

export function plan(i: Input): Plan | null {
  const key = EVOLUTIONS[i.evolution].point, name = EVOLUTIONS[i.evolution].pointName;
  const pg = i.guide[key], pa = i.approach[key], ba = i.approach.bridge, lg = i.guide.length;
  const missing = [pg === undefined ? `the Guide's ${name}` : '', lg === undefined ? "the Guide's length" : '', pa === undefined ? `the approach ship's ${name}` : '', ba === undefined ? "the approach ship's bridge" : ''].filter(Boolean);
  const advantage = i.approachSpeed - i.guideSpeed;
  if (!(advantage > 0) || !(i.surgeYdPerKnot > 0) || pg === undefined || pa === undefined || ba === undefined || lg === undefined) return missing.length || advantage > 0 ? { ...blank(), advantage: Math.max(advantage, 0), missing } : null;
  const surgeYd = advantage * i.surgeYdPerKnot, surgeM = surgeYd / YD_PER_M;
  const pointToStern = lg - pg;
  const xM = surgeM - pointToStern - pa;
  const thetaDeg = (Math.atan2(xM + ba, i.separationM) * 180) / Math.PI;
  const ra = i.approach.radar, radar = ra === undefined ? undefined : { rangeM: xM + ra, thetaDeg: (Math.atan2(xM + ra, i.separationM) * 180) / Math.PI };
  const runYd = i.standbyYd - surgeYd;
  return {
    advantage, surgeYd, surgeM, pointToStern, xM, thetaDeg, ...(radar ? { radar } : {}), stemOffsetM: pa - pg,
    runYd: Math.max(0, runYd), runMinutes: Math.max(0, runYd) / (advantage * 2000 / 60), atOnce: runYd <= 0, missing,
  };
}
const blank = (): Plan => ({ advantage: 0, surgeYd: 0, surgeM: 0, pointToStern: 0, xM: 0, thetaDeg: 0, stemOffsetM: 0, runYd: 0, runMinutes: 0, atOnce: false, missing: [] });

/** The same at other speed advantages (knots), as worked on the bridge for several approach speeds. */
export const sweep = (i: Input, advantages: number[]) => advantages.map(a => ({ advantage: a, plan: plan({ ...i, approachSpeed: i.guideSpeed + a }) }));
