// How a saved fishtail is stored and shown in the Fishtails card. Pure; `node data/fishtails.check.ts` checks it.
import type { SimpleRecord } from '../types.ts';

export type FishtailSort = 'date' | 'speed' | 'wheel' | 'side' | 'station';
export const FISHTAIL_SORTS: { key: FishtailSort; label: string }[] = [
  { key: 'date', label: 'Date' }, { key: 'speed', label: 'Speed' }, { key: 'wheel', label: 'Wheel' }, { key: 'side', label: 'Side' }, { key: 'station', label: 'Station' },
];

/** Eight stations round the guide, ahead first and then clockwise (000, 045, 090 ... 315). */
const STATIONS = ['Ahead', 'Bow Stbd', 'Abeam Stbd', 'Quarter Stbd', 'Astern', 'Quarter Port', 'Abeam Port', 'Bow Port'];

/** Where own ship ends up relative to the guide: x to starboard, y ahead, in yards. Within 1 yard counts as on the guide. */
export function stationOf(x: number, y: number): { name: string; index: number } {
  if (Math.hypot(x, y) < 1) return { name: 'On guide', index: -1 };
  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  const index = Math.round(((bearing + 360) % 360) / 45) % 8;
  return { name: STATIONS[index], index };
}

export interface FishtailInput {
  kind: string;          // 'Half' | 'Full' | 'Distorted'
  angles: number[];      // signed turn angles, first one gives the side of the first turn
  speed: number;         // speed of the turning table used
  wheel: string;
  lateral: number;       // yards
  drop: number;          // yards, positive when own ship ends astern of the guide
  finalX: number;        // own ship's final x from where it started (yards, to starboard)
  plot?: string;         // the track, from encodePlot, so the card can draw it
}

/** The values kept on the record so the card can show and sort them without parsing text. */
export function fishtailFields(i: FishtailInput): Record<string, string> {
  const st = stationOf(i.finalX, -i.drop);
  const shown = i.kind === 'Distorted' ? [i.angles[0], i.angles[2]] : [i.angles[0]];
  return {
    kind: i.kind, angle: shown.map(a => `${Math.abs(Math.round(a))}`).join('/'), speed: String(i.speed), wheel: i.wheel,
    side: i.angles[0] >= 0 ? 'Starboard' : 'Port', station: st.name, stationIdx: String(st.index),
    lateral: String(Math.round(i.lateral)), drop: String(Math.round(i.drop)),
    ...(i.plot ? { graph: i.plot } : {}),
  };
}

export interface FishtailRow {
  id: string; date: string; kind: string; angle: string;
  speed: number | null; wheel: number | null; side: string; station: string; stationIdx: number; lateral: number | null; drop: number | null;
  /** the saved track (see fishtailPlot.ts), when the fishtail was saved with one */
  graph?: string;
}

const n = (v: string | undefined): number | null => { const x = parseFloat(v ?? ''); return Number.isFinite(x) ? x : null; };

/** One display row from a record: new records carry their values; older calculator and hand-typed ones are read from their text. */
export function fishtailRow(r: SimpleRecord): FishtailRow {
  const f = r.fields;
  if (f && f.kind) {
    return { id: r.id, date: r.date, kind: f.kind, angle: f.angle ?? '', speed: n(f.speed), wheel: n(f.wheel), side: f.side ?? '', station: f.station || '-', stationIdx: n(f.stationIdx) ?? 99, lateral: n(f.lateral), drop: n(f.drop), graph: f.graph || undefined };
  }
  if (f && (f.speed || f.rudder)) {
    return { id: r.id, date: r.date, kind: '-', angle: '', speed: n(f.speed), wheel: n(f.rudder), side: '', station: '-', stationIdx: 99, lateral: null, drop: null };
  }
  const text = `${r.description} ${r.value ?? ''}`;
  const kind = /(half|full|distorted)/i.exec(text)?.[1] ?? '';
  const all = /(?:half|full|distorted) fishtail ((?:\d+°\s*\/?\s*)+)/i.exec(r.value ?? '')?.[1]?.replace(/°|\s/g, '') ?? '';
  const angle = /distorted/i.test(kind) ? all : all.split('/')[0];   // half and full list the turn angle twice or thrice
  const t = /\(([\d.]+) kn, (\d+)° wheel, (Port|Starboard)\)/i.exec(r.description);
  return {
    id: r.id, date: r.date, kind: kind ? kind[0].toUpperCase() + kind.slice(1).toLowerCase() : '-', angle,
    speed: t ? n(t[1]) : null, wheel: t ? n(t[2]) : null, side: t ? t[3][0].toUpperCase() + t[3].slice(1).toLowerCase() : '',
    station: '-', stationIdx: 99, lateral: n(/lateral (-?[\d.]+)/i.exec(text)?.[1]), drop: n(/drop (-?[\d.]+)/i.exec(text)?.[1]),
  };
}

const sideRank = (s: string) => (s === 'Port' ? 0 : s === 'Starboard' ? 1 : 2);
const num = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity);

/** Sorted copy: by the chosen column, ties by speed, wheel, then newest first. Rows missing the value go last. */
export function sortFishtails(rows: FishtailRow[], by: FishtailSort): FishtailRow[] {
  const key = (a: FishtailRow, b: FishtailRow): number =>
    by === 'speed' ? num(a.speed, b.speed) : by === 'wheel' ? num(a.wheel, b.wheel)
      : by === 'side' ? sideRank(a.side) - sideRank(b.side) : by === 'station' ? a.stationIdx - b.stationIdx : 0;
  return [...rows].sort((a, b) => key(a, b) || (by === 'date' ? 0 : num(a.speed, b.speed) || num(a.wheel, b.wheel)) || b.date.localeCompare(a.date));
}
