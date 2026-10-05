// Run: node services/turningRoundTrip.check.ts
// A vessel's turning data exported to every format must import back identical, through the same code the app uses.
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { buildDocx, readDocxTables } from './docx.ts';
import { toCsv, turningObjects, turningTable } from './vesselReport.ts';
import { hasEmbeddedMetadata, mergeTurningSets, rowsToTurningSets, tableToRows } from '../fishtail/tableConvert.ts';
import type { Ship, TurningDataSet } from '../types.ts';

const row = (turn: number, o: Partial<TurningDataSet['data'][number]> = {}) => ({
  id: `r${turn}`, turnAmount: turn, bearingMob: 0, angle: 0, rangeCables: 0, rangeYards: 0, transfer: 0, advance: 0, distToNewCourse: 0, time: '', speed: 12 as number | string, ...o,
});
const sets: TurningDataSet[] = [
  { wheelAngle: 15, testSpeed: 12, turnSide: 'Starboard', initialHead: 90, data: [
    row(15, { bearingMob: 7.5, angle: 15, rangeCables: 2.33, rangeYards: 466, transfer: 120.5, advance: 450, distToNewCourse: 35, time: '01:45', speed: 12 }),
    row(30, { angle: 30, transfer: 90, advance: 380, time: '01:10', speed: 11.5 }),
    row(345, { speed: '' }),                                                              // blank sheet row (no speed either): not exported
  ] },
  { wheelAngle: 20, testSpeed: 8, turnSide: 'Port', data: [row(60, { advance: 700.25, transfer: 320, time: '03:00', speed: 8 })] },
  { wheelAngle: 25, testSpeed: 15, turnSide: 'Port', initialHead: 0, data: [row(90, { advance: 1234.5, transfer: 2000, time: '10:05', speed: '' })] },   // blank speed cell
];
const ship: Ship = {
  id: 's', name: 'Round Trip', type: 'Other', turningDataSets: sets,
  particulars: { lengthOverall: 0, breadthOverall: 0, displacement: 0, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 },
  accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: [],
};

// what should come back: the recorded rows only, speeds filled from the table when the cell was blank
const expected = sets.map(s => ({
  wheelAngle: s.wheelAngle, testSpeed: s.testSpeed, turnSide: s.turnSide, initialHead: s.initialHead ?? 0,
  data: s.data.filter(r => r.advance > 0 || r.transfer > 0).map(({ id, ...r }) => ({ ...r, speed: r.speed === '' ? s.testSpeed : r.speed })),
}));
const shape = (result: TurningDataSet[]) => result.map(s => ({ ...s, data: s.data.map(({ id, ...r }) => r) }));

const table = turningTable(ship);
assert.equal(table.length, 1 + 1 + 1 + 1 + 1);                                             // header + 4 recorded rows (the blank 345 row is left out)
assert.equal(table[0].filter(h => h === 'Speed (kn)').length, 2);                         // the table's speed and each row's own

const viaSheet = (rows: Record<string, unknown>[]) => { assert.ok(hasEmbeddedMetadata(rows)); const r = rowsToTurningSets(rows); assert.equal(r.skipped, 0); return shape(r.sets); };
const readSheet = (wb: XLSX.WorkBook) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' }) as Record<string, unknown>[];

// CSV (with the byte-order mark the export adds)
assert.deepEqual(viaSheet(readSheet(XLSX.read(`﻿${toCsv(table)}`, { type: 'string' }))), expected);
// Excel
const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(table), 'Turning data');
const xlsxBytes: Uint8Array = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
assert.deepEqual(viaSheet(readSheet(XLSX.read(xlsxBytes, { type: 'array' }))), expected);
// Word
const docx = await buildDocx('Round Trip - turning data', [{ rows: table.map(r => r.map(String)) }]);
const tables = await readDocxTables(docx); assert.equal(tables.length, 1);
assert.deepEqual(viaSheet(tableToRows(tables[0])), expected);
// JSON
assert.deepEqual(viaSheet(JSON.parse(JSON.stringify(turningObjects(table)))), expected);

// importing into a vessel that already has some of the data replaces matching turns and keeps the rest
const merged = mergeTurningSets([{ wheelAngle: 15, testSpeed: 12, turnSide: 'Starboard', initialHead: 90, data: [row(15, { advance: 1, transfer: 1 }), row(120, { advance: 999, transfer: 5 })] }], rowsToTurningSets(turningObjects(table)).sets);
assert.deepEqual(merged[0].data.map(d => [d.turnAmount, d.advance]), [[15, 450], [30, 380], [120, 999]]);
assert.equal(merged.length, 3);

// a table in a whole-vessel Word/Excel file that is not turning data is skipped by the reader's column test, so these must agree
assert.equal(rowsToTurningSets([{ Name: 'Class', Value: 'Destroyer' }]).sets.length, 0);

console.log('turning round trip: Excel, CSV, Word and JSON all return identical data');
