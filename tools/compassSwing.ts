// Compass swing: deviation on eight headings -> coefficients A-E -> deviation card. Pure; `node tools/compassSwing.check.ts` checks it.
// Deviation is + when the compass reads to the East of magnetic north (compass north points east: magnetic = compass + deviation).
// Model (Admiralty): dev = A + B sin(h) + C cos(h) + D sin(2h) + E cos(2h), h = compass heading.

export const SWING_HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export interface Coefficients { A: number; B: number; C: number; D: number; E: number }

const rad = (d: number) => (d * Math.PI) / 180;

/** Coefficients from the deviation observed on each of the eight headings; null unless all eight are present. */
export function coefficients(dev: (number | null)[]): Coefficients | null {
  if (dev.length !== 8 || dev.some(d => d === null || !Number.isFinite(d))) return null;
  const d = dev as number[];
  const sum = (f: (h: number) => number) => d.reduce((s, v, i) => s + v * f(rad(SWING_HEADINGS[i])), 0);
  return {
    A: sum(() => 1) / 8,
    B: sum(Math.sin) / 4,
    C: sum(Math.cos) / 4,
    D: sum(h => Math.sin(2 * h)) / 4,
    E: sum(h => Math.cos(2 * h)) / 4,
  };
}

export const deviationAt = (c: Coefficients, heading: number): number => {
  const h = rad(heading);
  return c.A + c.B * Math.sin(h) + c.C * Math.cos(h) + c.D * Math.sin(2 * h) + c.E * Math.cos(2 * h);
};

/** The deviation card: every `step` degrees round the compass. */
export const deviationTable = (c: Coefficients, step = 15): { heading: number; dev: number }[] =>
  Array.from({ length: 360 / step }, (_, i) => ({ heading: i * step, dev: deviationAt(c, i * step) }));

/** "3.2°E", "1.0°W", "0.0°". */
export const formatDev = (d: number, digits = 1): string => {
  const v = Math.abs(d).toFixed(digits);
  return +v === 0 ? `${(0).toFixed(digits)}°` : `${v}°${d > 0 ? 'E' : 'W'}`;
};

/** Eight deviations stored on a record as d0, d45 ... d315 (text), read back as numbers or null. */
export const readDeviations = (fields: Record<string, string> | undefined): (number | null)[] =>
  SWING_HEADINGS.map(h => { const v = parseFloat(fields?.[`d${h}`] ?? ''); return Number.isFinite(v) ? v : null; });

/** Largest deviation on the card, with the heading it occurs at. */
export function worst(c: Coefficients): { heading: number; dev: number } {
  return deviationTable(c, 5).reduce((m, p) => (Math.abs(p.dev) > Math.abs(m.dev) ? p : m));
}

/** One line for the record: coefficients when all eight are there, else the residual alone. */
export function swingSummary(compass: string, dev: (number | null)[], residual: string): string {
  const c = coefficients(dev);
  if (!c) return `${compass} compass · residual deviation ${residual}°`;
  const w = worst(c);
  const k = (n: number) => { const v = Math.round(n * 10) / 10 || 0; return (v >= 0 ? '+' : '') + v.toFixed(1); };
  return `${compass} compass · A ${k(c.A)} B ${k(c.B)} C ${k(c.C)} D ${k(c.D)} E ${k(c.E)} · max ${formatDev(w.dev)} on ${String(w.heading).padStart(3, '0')}°`;
}
