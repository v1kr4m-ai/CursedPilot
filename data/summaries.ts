// What the Calibration Data cards and the My Ship card show about each kind of record: how many, and what the
// latest one says. Pure; `node data/summaries.check.ts` checks it.
import type { Ship, SimpleRecord } from '../types.ts';

export interface Summary {
  id: 'turning' | 'accel' | 'fishtails' | 'em' | 'compass';
  title: string;
  count: number;
  /** a short line describing the latest record(s); '' when there are none */
  latest: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-04" -> "4 Oct 2026"; anything else is shown as it is. */
export function shortDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.trim());
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : d.trim();
}

/** The record with the latest date; for equal or unreadable dates, the one entered last. */
export function latestRecord(list: SimpleRecord[]): SimpleRecord | undefined {
  let best: SimpleRecord | undefined;
  for (const r of list) if (!best || (r.date ?? '') >= (best.date ?? '')) best = r;
  return best;
}

const recordLine = (list: SimpleRecord[]) => {
  const r = latestRecord(list);
  if (!r) return '';
  const text = (r.value || r.description || '').trim();
  return [r.date ? shortDate(r.date) : '', text].filter(Boolean).join(' · ');
};

const hasData = (r: Ship['turningDataSets'][number]['data'][number]) => r.advance > 0 || r.transfer > 0;

export function turningLine(ship: Ship): { count: number; line: string } {
  const sets = ship.turningDataSets.map(s => ({ s, rows: s.data.filter(hasData).length })).filter(x => x.rows > 0);
  const count = sets.reduce((n, x) => n + x.rows, 0);
  if (!count) return { count: 0, line: '' };
  const label = ({ s }: (typeof sets)[number]) => `${s.testSpeed} kn ${s.wheelAngle}° ${s.turnSide === 'Port' ? 'Port' : 'Stbd'}`;
  const shown = sets.slice(0, 3).map(label).join(', ');
  return { count, line: `${sets.length} ${sets.length === 1 ? 'table' : 'tables'}: ${shown}${sets.length > 3 ? ` +${sets.length - 3} more` : ''}` };
}

export function calibrationSummaries(ship: Ship): Summary[] {
  const t = turningLine(ship);
  return [
    { id: 'turning', title: 'Turning Trials', count: t.count, latest: t.line },
    { id: 'accel', title: 'Acceleration and Deceleration', count: ship.accelDecelData.length, latest: recordLine(ship.accelDecelData) },
    { id: 'fishtails', title: 'Fishtails', count: ship.fishtails.length, latest: recordLine(ship.fishtails) },
    { id: 'em', title: 'EM Log Calibration', count: ship.emLogCalibration.length, latest: recordLine(ship.emLogCalibration) },
    { id: 'compass', title: 'Compass Swing', count: ship.compassSwing.length, latest: recordLine(ship.compassSwing) },
  ];
}
