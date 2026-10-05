// Pure conversions from imported turning-data tables (Excel, CSV, Word, JSON rows) into a vessel's own turning data
// sets, keeping every column of the turning sheet. No I/O, so `node fishtail/tableConvert.check.ts` can check it.
import type { TurningDataRow, TurningDataSet } from '../types.ts';

type Row = Record<string, unknown>;

const clean = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Accepted column headings for each field (matched ignoring case, spaces, brackets and units' punctuation). */
const COLS = {
  turn: ['Turn (deg)', 'Turn', 'Turn amount', 'Heading (deg)', 'Heading', 'Degrees', 'Hdg', 'Headingdeg'],
  turnFallback: ['Angle'],                                    // only when nothing above exists: old files use "Angle" for the turn
  bearingMob: ['Bearing MOB (deg)', 'Bearing MOB', 'Bearing'],
  angle: ['Angle (deg)', 'Angle'],
  rangeCables: ['Range (cables)', 'Range (C)', 'Range cables'],
  rangeYards: ['Range (yd)', 'Range (yds)', 'Range yards', 'Range (Y)'],
  transfer: ['Transfer (yd)', 'Transfer (yds)', 'Transfer', 'Trans', 'YardsTrans', 'YardsTransfer', 'Transyds', 'Transferyds'],
  advance: ['Advance (yd)', 'Advance (yds)', 'Advance', 'Adv', 'YardsAdv', 'YardsAdvance', 'Advyds', 'Advanceyds'],
  dist: ['Dist to new course', 'Dist. New (Yds)', 'Dist to new course (yd)', 'Distance to new course'],
  time: ['Time', 'Time (mm:ss)', 'Time (sec)', 'Sec', 'Seconds', 'T', 'Timesec'],
  speed: ['Speed (kn)', 'Speed', 'Own Speed (kts)', 'Own Speed', 'Speedkts', 'OwnSpeed', 'OwnSpeedkts', 'Speed (knots)', 'Test speed'],
  wheel: ['Wheel (deg)', 'Wheel', 'Rudder Angle (deg)', 'Rudder Angle', 'Rudder', 'Rudderdeg', 'RudderAngledeg'],
  side: ['Side of Turn', 'Side', 'Direction', 'SideofTurn'],
  initialHead: ['Initial head (deg)', 'Initial head', 'Initial heading'],
} as const;

const keyOf = (row: Row, names: readonly string[]): string | undefined => {
  const wanted = names.map(clean);
  return Object.keys(row).find(k => wanted.includes(clean(k)));
};
const raw = (row: Row, names: readonly string[]): unknown => { const k = keyOf(row, names); return k === undefined ? undefined : row[k]; };

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const numOf = (row: Row, names: readonly string[]) => num(raw(row, names));

/** 105 -> "01:45", the format the vessel's turning sheet uses. */
export const secondsToClock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** A time cell: "01:45" stays, a bare number is seconds, anything else is blank. */
const clock = (v: unknown): string => {
  const t = String(v ?? '').trim();
  const m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) return `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
  const n = num(t);
  return n !== null && n > 0 ? secondsToClock(n) : '';
};

const sideOf = (s: string): 'Port' | 'Starboard' => (/port/i.test(s) || s.trim().toLowerCase() === 'p' ? 'Port' : 'Starboard');

const SPEED_NAMES = COLS.speed.map(clean);

/**
 * The columns that carry a speed, in order. The first is the table's speed; a second one, if the file has it, is each
 * row's own speed. Position decides, not the reader's name for a repeated heading ("Speed (kn)_1"), because a byte-order
 * mark on the first heading makes readers treat the two as different headings.
 */
const speedKeys = (row: Row) => Object.keys(row).filter(k => SPEED_NAMES.includes(clean(k)) || /^(?:speed|ownspeed)(?:kn|kts|knots)?[1-9]$/.test(clean(k)));

/** Rows of cell text (first row = headings) -> objects keyed by heading; repeated headings get _1, _2 like SheetJS does. */
export function tableToRows(table: string[][]): Row[] {
  if (table.length < 2) return [];
  const seen = new Map<string, number>();
  const heads = table[0].map(h => {
    const base = h.trim() || 'Column';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}_${n}` : base;
  });
  return table.slice(1).map(cells => Object.fromEntries(heads.map((h, i) => [h, cells[i] ?? ''])));
}

/** True when the rows have a column that can be read as the turn amount. */
export const hasTurnColumn = (rows: Row[]) => !!rows[0] && !!(keyOf(rows[0], COLS.turn) ?? keyOf(rows[0], COLS.turnFallback));

/** True when the table carries its own speed, wheel and side columns, so no questions need asking. */
export const hasEmbeddedMetadata = (rows: Row[]) => !!rows[0] && !!keyOf(rows[0], COLS.wheel) && !!keyOf(rows[0], COLS.side);

export interface TableMeta { speed: number; wheel: number; side: 'Port' | 'Starboard' }

export interface ImportResult { sets: TurningDataSet[]; /** rows with data that could not be placed in a table */ skipped: number }

/**
 * Builds turning data sets, one per speed + wheel angle + side, from imported rows. `meta` supplies the table when the
 * file has none. Blank rows (the empty pre-filled turn amounts of a sheet) are ignored; if a turn amount appears twice
 * in a table, the later row wins.
 */
export function rowsToTurningSets(rows: Row[], meta?: TableMeta): ImportResult {
  const sets = new Map<string, TurningDataSet>();
  let skipped = 0;
  rows.forEach((row, i) => {
    const turnKey = keyOf(row, COLS.turn) ?? keyOf(row, COLS.turnFallback);
    const turn = turnKey === undefined ? null : num(row[turnKey]);
    const hasAngleCol = turnKey !== undefined && clean(turnKey) !== 'angle';
    const bearingMob = numOf(row, COLS.bearingMob) ?? 0;
    const angle = (hasAngleCol ? numOf(row, COLS.angle) : null) ?? turn ?? 0;
    const rangeCables = numOf(row, COLS.rangeCables) ?? 0, rangeYards = numOf(row, COLS.rangeYards) ?? 0;
    const transfer = numOf(row, COLS.transfer) ?? 0, advance = numOf(row, COLS.advance) ?? 0, dist = numOf(row, COLS.dist) ?? 0;
    const time = clock(raw(row, COLS.time));
    const isBlank = [bearingMob, rangeCables, rangeYards, transfer, advance, dist].every(n => n === 0) && !time;
    if (isBlank) return;

    const sk = speedKeys(row);
    const setSpeed = meta ? meta.speed : (sk[0] ? num(row[sk[0]]) : null);
    const wheel = meta ? meta.wheel : numOf(row, COLS.wheel);
    const side = meta ? meta.side : sideOf(String(raw(row, COLS.side) ?? ''));
    if (turn === null || setSpeed === null || wheel === null) { skipped++; return; }

    const key = `${setSpeed}|${wheel}|${side}`;
    if (!sets.has(key)) sets.set(key, { wheelAngle: wheel, testSpeed: setSpeed, turnSide: side, initialHead: numOf(row, COLS.initialHead) ?? 0, data: [] });
    const data: TurningDataRow = {
      id: `imp-${key}-${turn}-${i}`, turnAmount: turn, bearingMob, angle, rangeCables, rangeYards, transfer, advance, distToNewCourse: dist,
      time, speed: (sk[meta ? 0 : 1] ? num(row[sk[meta ? 0 : 1]]) : null) ?? setSpeed,
    };
    const set = sets.get(key)!;
    const at = set.data.findIndex(d => d.turnAmount === turn);
    if (at >= 0) set.data[at] = data; else set.data.push(data);
  });
  return { sets: [...sets.values()], skipped };
}

/** Merges imported sets into a vessel's: rows for the same turn amount are replaced, everything else is kept. */
export function mergeTurningSets(existing: TurningDataSet[], incoming: TurningDataSet[]): TurningDataSet[] {
  const out = existing.map(s => ({ ...s, data: [...s.data] }));
  incoming.forEach(inc => {
    const hit = out.find(s => s.testSpeed === inc.testSpeed && s.wheelAngle === inc.wheelAngle && s.turnSide === inc.turnSide);
    if (!hit) { out.push({ ...inc, data: [...inc.data].sort((a, b) => a.turnAmount - b.turnAmount) }); return; }
    const replaced = new Set(inc.data.map(r => r.turnAmount));
    hit.data = [...hit.data.filter(r => !replaced.has(r.turnAmount)), ...inc.data].sort((a, b) => a.turnAmount - b.turnAmount);
  });
  return out;
}
