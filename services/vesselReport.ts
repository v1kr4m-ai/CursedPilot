// Pure builders for per-vessel exports (no React, no file I/O) so they can be checked with
// `node services/vesselReport.check.ts`.
import type { Ship, ShipInfo, SimpleRecord, TurningDataRow } from '../types.ts';
import { formatField, shownFields } from '../data/customFields.ts';
import { compassHtml, emLogHtml, fishtailsHtml, turningPlotSvg } from './reportExtras.ts';

export type Cell = string | number;

const PARTICULARS: [string, keyof Ship['particulars'], string][] = [
  ['Length overall', 'lengthOverall', 'm'],
  ['Breadth overall', 'breadthOverall', 'm'],
  ['Displacement', 'displacement', 'tons'],
  ['Stem to standard', 'stemToStandard', 'm'],
  ['Stem to bridge', 'stemToBridge', 'm'],
  ['Stem to RAS point', 'stemToRas', 'm'],
  ['Stem to fueling point', 'stemToFueling', 'm'],
];

const INFO_FIELDS: [string, keyof ShipInfo][] = [
  ['Class', 'shipClass'], ['Pennant', 'pennant'], ['Builder', 'builder'], ['Commissioned', 'commissioned'], ['Status', 'status'],
  ['Displacement', 'displacement'], ['Length', 'length'], ['Beam', 'beam'], ['Draught', 'draught'], ['Speed', 'speed'],
  ['Complement', 'complement'], ['Propulsion', 'propulsion'], ['Armament', 'armament'], ['Sensors', 'sensors'], ['Aircraft', 'aircraft'], ['Notes', 'notes'],
];

/** The descriptive details that have been filled in (class, pennant, builder...). */
export const infoRows = (ship: Ship): Cell[][] => [
  ...INFO_FIELDS.map(([label, key]): Cell[] => [label, (ship.info?.[key] ?? '').toString().trim()]).filter(r => r[1] !== ''),
  ...shownFields(ship, 'details').map((f): Cell[] => [f.label.trim(), f.value.trim()]).filter(r => r[1] !== ''),
];

const RECORD_SECTIONS: [string, 'accelDecelData' | 'fishtails' | 'emLogCalibration' | 'compassSwing'][] = [
  ['Acceleration and deceleration', 'accelDecelData'],
  ['Fishtails', 'fishtails'],
  ['EM log calibration', 'emLogCalibration'],
  ['Compass swing', 'compassSwing'],
];

export const TURNING_HEADER = ['Turn (°)', 'Bearing MOB (°)', 'Angle (°)', 'Range (cables)', 'Range (yd)', 'Transfer (yd)', 'Advance (yd)', 'Dist to new course', 'Time', 'Speed (kn)'];
export const RECORD_HEADER = ['Date', 'Details', 'Remarks'];

/** The blank pre-filled turn amounts of an untouched sheet carry no information, so they are left out. */
export const rowHasData = (r: TurningDataRow) =>
  [r.bearingMob, r.angle, r.rangeCables, r.rangeYards, r.transfer, r.advance, r.distToNewCourse].some(n => n > 0) || !!r.time || (r.speed !== '' && r.speed !== 0);

export const particularRows = (ship: Ship): Cell[][] => [
  ...PARTICULARS.map(([label, key, unit]): Cell[] => [label, ship.particulars[key] ?? 0, unit]),
  ...shownFields(ship, 'particulars').map((f): Cell[] => [f.label.trim(), f.value.trim(), (f.unit ?? '').trim()]),
];

export const turningRow = (r: TurningDataRow): Cell[] =>
  [r.turnAmount, r.bearingMob, r.angle, r.rangeCables, r.rangeYards, r.transfer, r.advance, r.distToNewCourse, r.time, r.speed];

export const recordRows = (list: SimpleRecord[]): Cell[][] => list.map(r => [r.date, r.value ?? '', r.description ?? '']);

export const turningTitle = (s: Ship['turningDataSets'][number]) =>
  `${s.testSpeed} kn, wheel ${s.wheelAngle}° ${s.turnSide}${s.initialHead !== undefined ? `, initial head ${s.initialHead}°` : ''}`;

export interface Sheet { name: string; rows: Cell[][] }

/**
 * All of a vessel's turning data as one table: a header row, then a row per recorded turn with the speed, wheel angle,
 * side and initial head of its table in front. The headings are ones the importer reads back, so an export can be
 * imported again without loss.
 */
export function turningTable(ship: Ship): Cell[][] {
  const out: Cell[][] = [['Speed (kn)', 'Wheel (°)', 'Side', 'Initial head (°)', ...TURNING_HEADER]];
  ship.turningDataSets.forEach(s =>
    s.data.filter(rowHasData).forEach(r => out.push([s.testSpeed, s.wheelAngle, s.turnSide, s.initialHead ?? '', ...turningRow(r)])));
  return out;
}

/** The turning table as one object per row, keyed by heading; the second "Speed (kn)" is keyed "Speed (kn)_1", as spreadsheet readers do. */
export const turningObjects = (table: Cell[][]): Record<string, Cell>[] => {
  const [head, ...rows] = table;
  return rows.map(r => Object.fromEntries(head.map((h, i) => [String(h) + (head.indexOf(h) !== i ? '_1' : ''), r[i]])));
};

/** Comma-separated text: cells with commas, quotes or line breaks are quoted, quotes doubled. */
export const toCsv = (rows: Cell[][]): string =>
  rows.map(r => r.map(c => { const t = String(c); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(',')).join('\r\n');

/** Workbook layout: one sheet per section. Sheet names are limited to 31 characters. */
export function vesselSheets(ship: Ship): Sheet[] {
  const sheets: Sheet[] = [
    { name: 'Vessel', rows: [['Name', ship.name], ['Type', ship.type], ...infoRows(ship), [], ['Particular', 'Value', 'Unit'], ...particularRows(ship)] },
  ];
  sheets.push({ name: 'Turning data', rows: turningTable(ship) });
  RECORD_SECTIONS.forEach(([title, key]) => sheets.push({ name: title.slice(0, 31), rows: [RECORD_HEADER, ...recordRows(ship[key])] }));
  return sheets;
}

export const escapeHtml = (s: unknown) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const table = (header: Cell[], rows: Cell[][]) =>
  `<table><thead><tr>${header.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;

/** Self-contained printable report. Open it in a browser and print or save as PDF. */
export function vesselReportHtml(ship: Ship, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const turning = ship.turningDataSets
    .map(s => ({ s, rows: s.data.filter(rowHasData) }))
    .filter(x => x.rows.length > 0)
    .map(({ s, rows }) => `<h3>${escapeHtml(turningTitle(s))}</h3>${table(TURNING_HEADER, rows.map(turningRow))}${turningPlotSvg(rows)}`)
    .join('') || '<p class="none">No turning data recorded.</p>';
  const special: Partial<Record<(typeof RECORD_SECTIONS)[number][1], (s: Ship) => string>> = { fishtails: fishtailsHtml, emLogCalibration: emLogHtml, compassSwing: compassHtml };
  const records = RECORD_SECTIONS.map(([title, key]) =>
    `<h2>${escapeHtml(title)}</h2>${special[key] ? special[key]!(ship) : ship[key].length ? table(RECORD_HEADER, recordRows(ship[key])) : '<p class="none">No records.</p>'}`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ship.name)} - Cursed Pilot report</title>
<style>
  body{font-family:system-ui,Roboto,Arial,sans-serif;color:#0f172a;margin:24px;font-size:13px}
  h1{margin:0 0 2px;font-size:22px} h2{margin:22px 0 6px;font-size:15px;border-bottom:1px solid #cbd5e1;padding-bottom:3px} h3{margin:14px 0 4px;font-size:13px}
  .sub{color:#64748b;margin-bottom:10px} .none{color:#94a3b8;font-style:italic}
  table{border-collapse:collapse;width:100%;margin-bottom:6px} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:left}
  .plot{width:100%;max-width:340px;display:block;margin:6px 0 10px} h3{break-after:avoid}
  th{background:#f1f5f9;font-size:11px} td{font-variant-numeric:tabular-nums}
  @media print{body{margin:12mm} h2,h3{break-after:avoid} table{break-inside:auto} tr{break-inside:avoid}}
</style></head><body>
<h1>${escapeHtml(ship.name)}</h1><div class="sub">${escapeHtml(ship.type)} &middot; exported ${day} from Cursed Pilot</div>
${infoRows(ship).length ? `<h2>Details</h2>${table(['Detail', 'Value'], infoRows(ship))}` : ''}
<h2>Particulars</h2>${table(['Particular', 'Value', 'Unit'], particularRows(ship))}
<h2>Turning data</h2>${turning}
${records}
<p class="sub" style="margin-top:20px">Reference record only. Verify against the ship's own trials and standing orders.</p>
</body></html>`;
}

/** e.g. "HMS Vanguard" -> "hms-vanguard-2026-10-04.xlsx" */
export const vesselFileName = (ship: Ship, ext: string, date: Date = new Date(), part?: string) =>
  `${ship.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vessel'}${part ? `-${part}` : ''}-${date.toISOString().slice(0, 10)}.${ext}`;
