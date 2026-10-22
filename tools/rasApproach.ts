// RAS approach between a Guide (the supplier) and an approach ship (the receiver), for three evolutions that match different points on the two
// ships at the final station:
//   SKBDL  bridge to bridge       RASAP  RAS point to RAS point       UNREP  fuelling point to fuelling point
// The approach ship runs up on the Guide at a speed above hers and comes down to her speed. While she slows she gains on the Guide by the
// surge, so she starts slowing the surge short of the final station. Positions on each ship are stem-to-point distances (metres). Pure;
// `node tools/rasApproach.check.ts`.

import type { Ship } from '../types.ts';

export type Evolution = 'SKBDL' | 'RASAP' | 'UNREP';
export const EVOLUTIONS: Record<Evolution, { label: string; point: 'bridge' | 'ras' | 'fuel'; pointName: string }> = {
  SKBDL: { label: 'SKBDL: bridge to bridge', point: 'bridge', pointName: 'bridge' },
  RASAP: { label: 'RASAP: RAS point to RAS point', point: 'ras', pointName: 'RAS point' },
  UNREP: { label: 'UNREP: fuelling point to fuelling point', point: 'fuel', pointName: 'fuelling point' },
};

export interface Dims { bridge?: number; ras?: number; fuel?: number; /** metres */ breadth?: number }
export const dimsOf = (s?: Ship): Dims => {
  const p = s?.particulars;
  const pos = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : undefined);
  return { bridge: pos(p?.stemToBridge), ras: pos(p?.stemToRas), fuel: pos(p?.stemToFueling), breadth: pos(p?.breadthOverall) };
};

/** The ship's own deceleration rate, knots a minute, from her latest deceleration run (from, to, time in seconds). */
export function decelRate(s?: Pick<Ship, 'accelDecelData'>): number | undefined {
  let best: { date: string; rate: number } | undefined;
  for (const r of s?.accelDecelData ?? []) {
    const f = r.fields; if (!f || !/decel/i.test(f.type ?? '')) continue;
    const from = Number(f.from), to = Number(f.to), t = Number(f.time);
    if (!(from > to) || !(t > 0)) continue;
    const rate = (from - to) / (t / 60);
    if (!best || (r.date ?? '') >= best.date) best = { date: r.date ?? '', rate };
  }
  return best?.rate;
}

const YD_PER_M = 1 / 0.9144;
export interface Input {
  evolution: Evolution;
  guide: Dims; approach: Dims;
  guideSpeed: number; approachSpeed: number;     // knots
  decelKnPerMin: number;                         // the approach ship's deceleration rate
  separationFt: number;                          // between the ships' sides at the final station
  standbyYd: number;                             // the stand-by station: yards astern of the final station
}
export interface Plan {
  advantage: number;             // knots
  slowMinutes: number;           // time to come down from the approach speed to the Guide's
  surgeYd: number;               // yards gained on the Guide while slowing
  lateralYd: number;             // centre line to centre line at the final station
  stemOffsetM: number;           // at the final station the approach ship's stem is this far ahead of the Guide's stem (negative: astern)
  slowBearing: number;           // degrees off the approach ship's bow, toward the Guide, at which the Guide's point bears when she starts slowing
  slowRangeYd: number;           // and its range from her bridge
  runYd: number;                 // from the stand-by station to the slowing point
  runMinutes: number; totalMinutes: number;   // to the slowing point, and on to the final station
  atOnce: boolean;               // the stand-by station is already inside the surge
  missing: string[];             // the dimensions this evolution needs and the ships do not give
}

export function plan(i: Input): Plan | null {
  const key = EVOLUTIONS[i.evolution].point;
  const pg = i.guide[key], pa = i.approach[key], ba = i.approach.bridge;
  const missing = [pg === undefined ? `the Guide's ${EVOLUTIONS[i.evolution].pointName}` : '', pa === undefined ? `the approach ship's ${EVOLUTIONS[i.evolution].pointName}` : '', ba === undefined ? "the approach ship's bridge" : ''].filter(Boolean);
  const advantage = i.approachSpeed - i.guideSpeed;
  if (!(advantage > 0) || !(i.decelKnPerMin > 0) || pg === undefined || pa === undefined || ba === undefined) return missing.length || advantage > 0 ? { ...blank(), advantage: Math.max(advantage, 0), missing } : null;
  const slowMinutes = advantage / i.decelKnPerMin;
  const surgeYd = (advantage / 2) * slowMinutes * (2000 / 60);        // relative speed falls evenly from the advantage to nothing
  const lateralYd = i.separationFt / 3 + (((i.guide.breadth ?? 0) + (i.approach.breadth ?? 0)) / 2) * YD_PER_M;
  // the Guide's point is `surge` ahead of the approach ship's point when she starts slowing; her bridge is (pa - ba) ahead of her own point
  const ahead = surgeYd - (pa - ba) * YD_PER_M;
  const runYd = i.standbyYd - surgeYd;
  return {
    advantage, slowMinutes, surgeYd, lateralYd, stemOffsetM: pg - pa,
    slowBearing: (Math.atan2(lateralYd, ahead) * 180) / Math.PI, slowRangeYd: Math.hypot(lateralYd, ahead),
    runYd: Math.max(0, runYd), runMinutes: Math.max(0, runYd) / (advantage * 2000 / 60), totalMinutes: Math.max(0, runYd) / (advantage * 2000 / 60) + slowMinutes, atOnce: runYd <= 0, missing,
  };
}
const blank = (): Plan => ({ advantage: 0, slowMinutes: 0, surgeYd: 0, lateralYd: 0, stemOffsetM: 0, slowBearing: 0, slowRangeYd: 0, runYd: 0, runMinutes: 0, totalMinutes: 0, atOnce: false, missing: [] });
