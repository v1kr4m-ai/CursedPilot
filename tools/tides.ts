// Tide height between a high water and the next low water (or the reverse), from the times and heights of the two.
// Two methods: the rule of twelfths (1, 2, 3, 3, 2, 1 twelfths of the range in each sixth of the duration) and the
// half-cosine (simple harmonic) curve. Also the Moon's phase for spring or neap. Pure; `node tools/tides.check.ts` checks it.
import { moonGeometric } from './bodies.ts';
import { sunTrueLongitude } from './sunEphemeris.ts';

export type Method = 'twelfths' | 'cosine';
export interface Tide { t: number; h: number }          // t in hours (any common origin), h in the height unit the user works in

const CUM = [0, 1, 3, 6, 9, 11, 12].map(x => x / 12);   // share of the range reached at each sixth of the duration

/** Fraction of the range gone (0 at the first tide, 1 at the second) a fraction `u` of the way through the duration. */
export function fraction(u: number, method: Method): number {
  const x = Math.min(Math.max(u, 0), 1);
  if (method === 'cosine') return (1 - Math.cos(Math.PI * x)) / 2;
  const k = Math.min(5, Math.floor(x * 6)), w = x * 6 - k;
  return CUM[k] + (CUM[k + 1] - CUM[k]) * w;
}

/** The inverse: how far through the duration the tide has gone when the fraction `f` of the range has gone. */
export function fractionInverse(f: number, method: Method): number {
  const y = Math.min(Math.max(f, 0), 1);
  if (method === 'cosine') return Math.acos(1 - 2 * y) / Math.PI;
  const k = CUM.findIndex((c, i) => i < 6 && y <= CUM[i + 1]);
  return (k + (y - CUM[k]) / (CUM[k + 1] - CUM[k])) / 6;
}

export function heightAt(a: Tide, b: Tide, t: number, method: Method): number {
  return a.h + (b.h - a.h) * fraction((t - a.t) / (b.t - a.t), method);
}

/** Time (hours) at which the tide stands at `h`, or null when `h` is outside the two heights. */
export function timeAt(a: Tide, b: Tide, h: number, method: Method): number | null {
  const lo = Math.min(a.h, b.h), hi = Math.max(a.h, b.h);
  if (h < lo - 1e-12 || h > hi + 1e-12 || a.h === b.h) return null;
  return a.t + (b.t - a.t) * fractionInverse((h - a.h) / (b.h - a.h), method);
}

/** Rate of rise (+) or fall (-) in height units per hour at time t. */
export function rateAt(a: Tide, b: Tide, t: number, method: Method): number {
  const e = 1 / 600;     // six seconds
  return (heightAt(a, b, t + e, method) - heightAt(a, b, t - e, method)) / (2 * e);
}

export interface Phase {
  /** Moon's longitude less the Sun's, 0-360: 0 new, 90 first quarter, 180 full, 270 last quarter */
  elongation: number;
  ageDays: number;
  name: string;
  kind: 'spring' | 'neap' | 'between';
  /** days to the nearest new or full Moon (positive) */
  daysFromSyzygy: number;
  /** between springs and neaps: heading for springs ('making') or for neaps ('falling off') */
  trend: 'making' | 'falling off' | null;
  perigean: boolean;
}

const SYNODIC_DEG_PER_DAY = 12.190749;

export function moonPhase(jdUT: number): Phase {
  const jde = jdUT + 69 / 86400;                         // dynamical time: a minute is far inside what a tide table needs
  const T = (jde - 2451545) / 36525;
  const g = moonGeometric(jde);
  const el = (((g.lon - sunTrueLongitude(T)) % 360) + 360) % 360;
  const toSyzygy = Math.min(el % 180, 180 - (el % 180));    // degrees from the nearest new or full
  const days = toSyzygy / SYNODIC_DEG_PER_DAY;
  const kind = days <= 2.5 ? 'spring' : days >= 4.6 ? 'neap' : 'between';
  // the highest springs come a day or two after the new or full Moon, so "making" runs up to about 1.5 days after it
  const pastSyzygy = el % 180 < 90;
  const trend = kind === 'between' ? (pastSyzygy ? 'falling off' : 'making') : null;
  const name = el < 22.5 || el >= 337.5 ? 'New Moon' : el < 67.5 ? 'waxing crescent' : el < 112.5 ? 'first quarter' : el < 157.5 ? 'waxing gibbous'
    : el < 202.5 ? 'Full Moon' : el < 247.5 ? 'waning gibbous' : el < 292.5 ? 'last quarter' : 'waning crescent';
  return { elongation: el, ageDays: el / SYNODIC_DEG_PER_DAY, name, kind, daysFromSyzygy: days, trend, perigean: g.distance < 368000 };
}
