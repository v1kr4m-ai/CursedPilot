// Pure conversions between spreadsheet/JSON turning-table rows, the Fishtail calculator's points, and a
// vessel's own turning data sets. No I/O, so `node fishtail/tableConvert.check.ts` can check it.
import type { TurningDataRow, TurningDataSet } from '../types.ts';
import type { TurningDataPoint } from './types.ts';

const clean = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADINGS = {
  heading: ['Heading (deg)', 'Heading', 'Degrees', 'Angle', 'Hdg', 'Headingdeg', 'Turn', 'Turn amount'],
  advance: ['Advance (yds)', 'Advance', 'Adv', 'YardsAdv', 'YardsAdvance', 'Advyds', 'Advanceyds', 'Advance (yd)'],
  transfer: ['Transfer (yds)', 'Transfer', 'Trans', 'YardsTrans', 'YardsTransfer', 'Transyds', 'Transferyds', 'Transfer (yd)'],
  time: ['Time (sec)', 'Time', 'Sec', 'Seconds', 'T', 'Timesec'],
  speed: ['Own Speed (kts)', 'Own Speed', 'Speed', 'Speedkts', 'OwnSpeed', 'OwnSpeedkts', 'Speed (kn)'],
  rudder: ['Rudder Angle (deg)', 'Rudder Angle', 'Rudder', 'Rudderdeg', 'RudderAngledeg', 'Wheel', 'Wheel (deg)'],
  side: ['Side of Turn', 'Side', 'Direction', 'SideofTurn'],
} as const;

type Row = Record<string, unknown>;

const pick = (row: Row, keys: readonly string[]): unknown => {
  const wanted = keys.map(clean);
  const hit = Object.keys(row).find(k => wanted.includes(clean(k)));
  return hit === undefined ? undefined : row[hit];
};
const num = (row: Row, keys: readonly string[]) => {
  const n = parseFloat(String(pick(row, keys)));
  return Number.isFinite(n) ? n : 0;
};
/** Seconds from a number, or from an "mm:ss" clock string like the ones in this app's own exports. */
const seconds = (row: Row, keys: readonly string[]) => {
  const raw = String(pick(row, keys) ?? '').trim();
  const m = /^(\d+):(\d{1,2})$/.exec(raw);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};
const text = (row: Row, keys: readonly string[]) => {
  const v = pick(row, keys);
  return v === undefined || v === null ? '' : String(v);
};

const sideOf = (s: string): 'starboard' | 'port' => (/port/i.test(s) || s.trim().toLowerCase() === 'p' ? 'port' : 'starboard');

/** True when the sheet carries its own speed/rudder/side columns, so no questions need asking. */
export const hasEmbeddedMetadata = (rows: Row[]) => {
  const keys = Object.keys(rows[0] ?? {}).map(clean);
  return ['tablename', 'ownspeed', 'ownspeedkts', 'sideofturn', 'wheel', 'side'].some(k => keys.includes(k));
};

export interface TableMeta { ownSpeed: number; rudder: string; side: 'starboard' | 'port' }

/** Rows from a file -> calculator points. Metadata comes from `meta` when the sheet has none of its own. */
export function rowsToPoints(rows: Row[], meta?: TableMeta): TurningDataPoint[] {
  return rows.map((row, i) => {
    const speed = meta ? meta.ownSpeed : num(row, HEADINGS.speed) || 15;
    const rudder = meta ? meta.rudder : text(row, HEADINGS.rudder) || '20';
    const side = meta ? meta.side : sideOf(text(row, HEADINGS.side));
    return {
      id: `import-${i}`,
      tableName: `${speed}kts-${rudder}deg-${side.toUpperCase()}`,
      heading: num(row, HEADINGS.heading),
      advance: num(row, HEADINGS.advance),
      transfer: num(row, HEADINGS.transfer),
      time: seconds(row, HEADINGS.time),
      ownSpeed: speed,
      rudder,
      side,
    } as TurningDataPoint;
  });
}

/** 105 -> "01:45", the format the vessel's turning sheet uses. */
export const secondsToClock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const newRow = (p: TurningDataPoint, id: string): TurningDataRow => ({
  id, turnAmount: p.heading, bearingMob: 0, angle: p.heading, rangeCables: 0, rangeYards: 0,
  transfer: p.transfer, advance: p.advance, distToNewCourse: 0, time: p.time > 0 ? secondsToClock(p.time) : '', speed: p.ownSpeed,
});

/** Groups points by speed, wheel and side into vessel turning data sets. Rows whose wheel angle is not a number are dropped. */
export function pointsToTurningSets(points: TurningDataPoint[]): { sets: TurningDataSet[]; skipped: number } {
  const sets = new Map<string, TurningDataSet>();
  let skipped = 0;
  points.forEach((p, i) => {
    const wheel = parseFloat(p.rudder);
    if (!Number.isFinite(wheel) || !Number.isFinite(p.heading) || !Number.isFinite(p.ownSpeed)) { skipped++; return; }
    const key = `${p.ownSpeed}|${wheel}|${p.side}`;
    if (!sets.has(key)) sets.set(key, { wheelAngle: wheel, testSpeed: p.ownSpeed, turnSide: p.side === 'port' ? 'Port' : 'Starboard', initialHead: 0, data: [] });
    sets.get(key)!.data.push(newRow(p, `imp-${key}-${p.heading}-${i}`));
  });
  return { sets: [...sets.values()], skipped };
}

/** Merges imported sets into a vessel's: rows for the same turn amount are replaced, everything else is kept. */
export function mergeTurningSets(existing: TurningDataSet[], incoming: TurningDataSet[]): TurningDataSet[] {
  const out = existing.map(s => ({ ...s, data: [...s.data] }));
  incoming.forEach(inc => {
    const hit = out.find(s => s.testSpeed === inc.testSpeed && s.wheelAngle === inc.wheelAngle && s.turnSide === inc.turnSide);
    if (!hit) { out.push(inc); return; }
    const replaced = new Set(inc.data.map(r => r.turnAmount));
    hit.data = [...hit.data.filter(r => !replaced.has(r.turnAmount)), ...inc.data].sort((a, b) => a.turnAmount - b.turnAmount);
  });
  return out;
}
