// Anchoring sums from BR 45(1)(2) Chapter 14: the cable to veer (formulae 14.1-14.4), the Safety, Bridge and Stern Swinging
// Circles (paras 1410d, 1415b) and the Minimum Swinging Radius variants (formulae 14.5-14.8). Lengths in metres, depths as
// given, cable in shackles (15 fathoms, 27.432 m). Pure; `node tools/anchor.check.ts` checks it.

export const SHACKLE_M = 27.432;                 // one shackle of cable: 15 fathoms
export const CABLE_M = 185.2;                    // one cable: a tenth of a nautical mile
/** BR 45 para 1412g: the Reduced MSR allows 45 metres (50 yards) over the ship's length. */
export const REDUCED_ALLOWANCE_M = 45;

export type CableType = 'steel' | 'bronze';
export type DepthUnit = 'metres' | 'fathoms';

/**
 * Cable required in shackles for the depth (the greatest depth expected, charted depth plus the maximum height of tide).
 * Forged steel: 1.5 sqrt(depth in metres) (14.1) or 2 sqrt(depth in fathoms) (14.2).
 * Aluminium bronze: sqrt(depth in metres) (14.3) or sqrt(1.3 x depth in fathoms) (14.4).
 */
export function cableRequired(depth: number, unit: DepthUnit, type: CableType): number {
  if (!(depth > 0)) return 0;
  if (unit === 'metres') return type === 'steel' ? 1.5 * Math.sqrt(depth) : Math.sqrt(depth);
  return type === 'steel' ? 2 * Math.sqrt(depth) : Math.sqrt(1.3 * depth);
}

/** Para 1411c: in 15-20 kn of wind with a stream under 2 kn the cable could be cut by 60%. */
export const benignCable = (shackles: number) => shackles * 0.4;

export interface Circles {
  /** (maximum usable cable + length of ship + safety margin), independent of the MSR chosen (para 1410d) */
  safety: number;
  /** (cable veered + stem-to-standard distance), the circle the Bridge stays inside (para 1415b) */
  bridge: number;
  /** (cable veered + length of ship) (para 1415b); the same sum as the Normal MSR */
  stern: number;
  /** Normal MSR = length of ship + length of cable veered (14.5) */
  normalMsr: number;
  /** Reduced MSR = length of ship + 45 m (14.7) */
  reducedMsr: number;
}

export interface CircleInput {
  shipLength: number;            // m
  stemToStandard: number;        // m, hawsepipe (stem) to the standard compass / bridge
  veeredShackles: number;
  maxUsableShackles: number;     // the last shackle is normally inboard of the hawse pipe
  safetyMargin: number;          // m, at least a cable to start with
}

export function circles(i: CircleInput): Circles {
  const veered = i.veeredShackles * SHACKLE_M, usable = i.maxUsableShackles * SHACKLE_M;
  return {
    safety: usable + i.shipLength + i.safetyMargin,
    bridge: veered + i.stemToStandard,
    stern: veered + i.shipLength,
    normalMsr: i.shipLength + veered,
    reducedMsr: i.shipLength + REDUCED_ALLOWANCE_M,
  };
}

/** Distance apart for two ships: double MSR is the two added (14.6, 14.8), single MSR is the larger one (paras 1412f, j). */
export function spacing(a: number, b: number): { double: number; single: number } {
  return { double: a + b, single: Math.max(a, b) };
}
