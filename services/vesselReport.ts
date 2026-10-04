// Pure builders for per-vessel exports (no React, no file I/O) so they can be checked with
// `node services/vesselReport.check.ts`.
import type { Ship, SimpleRecord, TurningDataRow } from '../types.ts';

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

export const particularRows = (ship: Ship): Cell[][] => PARTICULARS.map(([label, key, unit]) => [label, ship.particulars[key] ?? 0, unit]);

export const turningRow = (r: TurningDataRow): Cell[] =>
  [r.turnAmount, r.bearingMob, r.angle, r.rangeCables, r.rangeYards, r.transfer, r.advance, r.distToNewCourse, r.time, r.speed];

export const recordRows = (list: SimpleRecord[]): Cell[][] => list.map(r => [r.date, r.value ?? '', r.description ?? '']);

export const turningTitle = (s: Ship['turningDataSets'][number]) =>
  `${s.testSpeed} kn, wheel ${s.wheelAngle}° ${s.turnSide}${s.initialHead !== undefined ? `, initial head ${s.initialHead}°` : ''}`;

export interface Sheet { name: string; rows: Cell[][] }

/** Workbook layout: one sheet per section. Sheet names are limited to 31 characters. */
export function vesselSheets(ship: Ship): Sheet[] {
  const sheets: Sheet[] = [
    { name: 'Vessel', rows: [['Name', ship.name], ['Type', ship.type], [], ['Particular', 'Value', 'Unit'], ...particularRows(ship)] },
  ];
  const turning: Cell[][] = [['Speed (kn)', 'Wheel (°)', 'Side', 'Initial head (°)', ...TURNING_HEADER]];
  ship.turningDataSets.forEach(s =>
    s.data.filter(rowHasData).forEach(r => turning.push([s.testSpeed, s.wheelAngle, s.turnSide, s.initialHead ?? '', ...turningRow(r)])));
  sheets.push({ name: 'Turning data', rows: turning });
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
    .map(({ s, rows }) => `<h3>${escapeHtml(turningTitle(s))}</h3>${table(TURNING_HEADER, rows.map(turningRow))}`)
    .join('') || '<p class="none">No turning data recorded.</p>';
  const records = RECORD_SECTIONS.map(([title, key]) =>
    `<h2>${escapeHtml(title)}</h2>${ship[key].length ? table(RECORD_HEADER, recordRows(ship[key])) : '<p class="none">No records.</p>'}`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ship.name)} - Cursed Pilot report</title>
<style>
  body{font-family:system-ui,Roboto,Arial,sans-serif;color:#0f172a;margin:24px;font-size:13px}
  h1{margin:0 0 2px;font-size:22px} h2{margin:22px 0 6px;font-size:15px;border-bottom:1px solid #cbd5e1;padding-bottom:3px} h3{margin:14px 0 4px;font-size:13px}
  .sub{color:#64748b;margin-bottom:10px} .none{color:#94a3b8;font-style:italic}
  table{border-collapse:collapse;width:100%;margin-bottom:6px} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:left}
  th{background:#f1f5f9;font-size:11px} td{font-variant-numeric:tabular-nums}
  @media print{body{margin:12mm} h2,h3{break-after:avoid} table{break-inside:auto} tr{break-inside:avoid}}
</style></head><body>
<h1>${escapeHtml(ship.name)}</h1><div class="sub">${escapeHtml(ship.type)} &middot; exported ${day} from Cursed Pilot</div>
<h2>Particulars</h2>${table(['Particular', 'Value', 'Unit'], particularRows(ship))}
<h2>Turning data</h2>${turning}
${records}
<p class="sub" style="margin-top:20px">Reference record only. Verify against the ship's own trials and standing orders.</p>
</body></html>`;
}

/** e.g. "HMS Vanguard" -> "hms-vanguard-2026-10-04.xlsx" */
export const vesselFileName = (ship: Ship, ext: string, date: Date = new Date()) =>
  `${ship.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vessel'}-${date.toISOString().slice(0, 10)}.${ext}`;
