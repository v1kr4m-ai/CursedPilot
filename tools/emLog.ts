// EM log calibration: log readings against true speed -> error, correction, and a log-to-true conversion.
// Pure; `node tools/emLog.check.ts` checks it. Error = log - true. Correction = true - log (added to the log reading).
import type { SimpleRecord } from '../types.ts';

export interface LogPoint { id: string; date: string; log: number; ref: number; error: number }

/** Points from the records that carry both numbers (records saved from the form keep them in `fields`), sorted by log reading. */
export function logPoints(items: SimpleRecord[]): LogPoint[] {
  const out: LogPoint[] = [];
  for (const r of items) {
    const ref = parseFloat(r.fields?.ref ?? ''), log = parseFloat(r.fields?.log ?? '');
    if (Number.isFinite(ref) && Number.isFinite(log)) out.push({ id: r.id, date: r.date, log, ref, error: log - ref });
  }
  return out.sort((a, b) => a.log - b.log || b.date.localeCompare(a.date));
}

/** True speed for a log reading, by straight lines between the calibrated points. null outside the calibrated range (no guessing). */
export function trueSpeed(points: LogPoint[], reading: number): number | null {
  if (!points.length || !Number.isFinite(reading)) return null;
  // one point per log reading: the newest one wins
  const byLog = new Map<number, LogPoint>();
  for (const p of points) if (!byLog.has(p.log)) byLog.set(p.log, p);
  const pts = [...byLog.values()].sort((a, b) => a.log - b.log);
  if (reading < pts[0].log || reading > pts[pts.length - 1].log) return null;
  for (let i = 0; i < pts.length; i++) {
    if (reading === pts[i].log) return pts[i].ref;
    if (i + 1 < pts.length && reading > pts[i].log && reading < pts[i + 1].log) {
      const f = (reading - pts[i].log) / (pts[i + 1].log - pts[i].log);
      return pts[i].ref + f * (pts[i + 1].ref - pts[i].ref);
    }
  }
  return null;
}

/** "+0.3", "-0.2", "0.0" */
export const signedKn = (n: number): string => { const v = Math.round(n * 10) / 10 || 0; return (v > 0 ? '+' : '') + v.toFixed(1); };
