// Run: node fishtail/tableConvert.check.ts
import assert from 'node:assert/strict';
import * as t from './tableConvert.ts';
import type { TurningDataSet } from '../types.ts';

// ---- clock
assert.equal(t.secondsToClock(105), '01:45'); assert.equal(t.secondsToClock(5), '00:05'); assert.equal(t.secondsToClock(3725), '62:05'); assert.equal(t.secondsToClock(-4), '00:00');

// ---- word tables become rows; repeated headings are numbered like SheetJS does
assert.deepEqual(t.tableToRows([['A', 'B', 'A'], ['1', '2', '3'], ['4']]), [{ A: '1', B: '2', A_1: '3' }, { A: '4', B: '', A_1: '' }]);
assert.deepEqual(t.tableToRows([['only header']]), []); assert.deepEqual(t.tableToRows([]), []);

// ---- detection
assert.equal(t.hasTurnColumn([{ 'Turn (°)': 30, Advance: 1 }]), true); assert.equal(t.hasTurnColumn([{ Heading: 30 }]), true); assert.equal(t.hasTurnColumn([{ Angle: 30 }]), true);
assert.equal(t.hasTurnColumn([{ Name: 'x', Value: 1 }]), false); assert.equal(t.hasTurnColumn([]), false);
assert.equal(t.hasEmbeddedMetadata([{ 'Speed (kn)': 12, 'Wheel (°)': 15, Side: 'Port' }]), true);
assert.equal(t.hasEmbeddedMetadata([{ 'Own Speed (kts)': 12, 'Rudder Angle (deg)': 15, 'Side of Turn': 'Port' }]), true);   // the calculator's old export
assert.equal(t.hasEmbeddedMetadata([{ Heading: 30, Advance: 380 }]), false);

// ---- a full sheet in this app's own layout keeps every column
const own = [
  { 'Speed (kn)': '12', 'Wheel (°)': '15', Side: 'Starboard', 'Initial head (°)': '90', 'Turn (°)': '30', 'Bearing MOB (°)': '5', 'Angle (°)': '31', 'Range (cables)': '2.3', 'Range (yd)': '466', 'Transfer (yd)': '90', 'Advance (yd)': '380', 'Dist to new course': '12', Time: '01:10', 'Speed (kn)_1': '11.5' },
  { 'Speed (kn)': '12', 'Wheel (°)': '15', Side: 'Starboard', 'Initial head (°)': '90', 'Turn (°)': '60', 'Bearing MOB (°)': '0', 'Angle (°)': '0', 'Range (cables)': '0', 'Range (yd)': '0', 'Transfer (yd)': '1,300', 'Advance (yd)': '640', 'Dist to new course': '0', Time: '125', 'Speed (kn)_1': '' },
  { 'Speed (kn)': '8', 'Wheel (°)': '20', Side: 'Port', 'Initial head (°)': '', 'Turn (°)': '45', 'Bearing MOB (°)': '0', 'Angle (°)': '0', 'Range (cables)': '0', 'Range (yd)': '0', 'Transfer (yd)': '100', 'Advance (yd)': '300', 'Dist to new course': '0', Time: '', 'Speed (kn)_1': '8' },
  { 'Speed (kn)': '12', 'Wheel (°)': '15', Side: 'Starboard', 'Initial head (°)': '90', 'Turn (°)': '345', 'Bearing MOB (°)': '', 'Angle (°)': '', 'Range (cables)': '', 'Range (yd)': '', 'Transfer (yd)': '', 'Advance (yd)': '', 'Dist to new course': '', Time: '', 'Speed (kn)_1': '' },   // blank sheet row
];
const r = t.rowsToTurningSets(own);
assert.equal(r.skipped, 0); assert.equal(r.sets.length, 2);
const a = r.sets[0], b = r.sets[1];
assert.deepEqual([a.testSpeed, a.wheelAngle, a.turnSide, a.initialHead], [12, 15, 'Starboard', 90]);
assert.equal(a.data.length, 2);                                                             // the blank 345 row is not data
assert.deepEqual({ ...a.data[0], id: '' }, { id: '', turnAmount: 30, bearingMob: 5, angle: 31, rangeCables: 2.3, rangeYards: 466, transfer: 90, advance: 380, distToNewCourse: 12, time: '01:10', speed: 11.5 });
assert.deepEqual([a.data[1].transfer, a.data[1].time, a.data[1].speed], [1300, '02:05', 12]);   // thousands comma, seconds -> clock, row speed defaults to the table's
assert.deepEqual([b.testSpeed, b.wheelAngle, b.turnSide, b.initialHead, b.data[0].time, b.data[0].speed], [8, 20, 'Port', 0, '', 8]);

// ---- old calculator-style files: "Heading" is the turn, time is seconds, metadata columns have other names
const old = t.rowsToTurningSets([{ 'Own Speed (kts)': 12, 'Rudder Angle (deg)': 15, 'Side of Turn': 'port', 'Heading (deg)': 60, 'Advance (yds)': 640, 'Transfer (yds)': 300, 'Time (sec)': 125 }]);
assert.deepEqual([old.sets[0].testSpeed, old.sets[0].wheelAngle, old.sets[0].turnSide, old.sets[0].data[0].turnAmount, old.sets[0].data[0].angle, old.sets[0].data[0].time], [12, 15, 'Port', 60, 60, '02:05']);
// a file that uses "Angle" for the turn
assert.equal(t.rowsToTurningSets([{ Angle: 45, Advance: 500, Transfer: 200, Time: '01:30' }], { speed: 10, wheel: 25, side: 'Port' }).sets[0].data[0].turnAmount, 45);

// ---- flat sheets take their table from the user
const flat = t.rowsToTurningSets([{ Heading: 45, Adv: 500, Trans: 200, Sec: 90 }, { Heading: 90, Adv: 820, Trans: 560, Sec: 180 }], { speed: 10, wheel: 25, side: 'Starboard' });
assert.equal(flat.sets.length, 1); assert.deepEqual(flat.sets[0].data.map(d => [d.turnAmount, d.advance, d.transfer, d.time, d.speed]), [[45, 500, 200, '01:30', 10], [90, 820, 560, '03:00', 10]]);

// ---- rows that cannot be placed are counted, not silently lost; duplicates: later wins
const bad = t.rowsToTurningSets([{ 'Speed (kn)': 12, 'Wheel (°)': 'abc', Side: 'Port', Turn: 30, Advance: 100 }, { 'Speed (kn)': 12, 'Wheel (°)': 15, Side: 'Port', Turn: '', Advance: 100 }, { 'Speed (kn)': 12, 'Wheel (°)': 15, Side: 'Port', Turn: 30, Advance: 100 }, { 'Speed (kn)': 12, 'Wheel (°)': 15, Side: 'Port', Turn: 30, Advance: 111 }]);
assert.equal(bad.skipped, 2); assert.equal(bad.sets.length, 1); assert.deepEqual(bad.sets[0].data.map(d => d.advance), [111]);

// ---- merging: same speed/wheel/side replaces matching turn amounts, keeps the rest, sorts; others are added; input untouched
const row = (n: number, adv: number) => ({ id: `r${n}`, turnAmount: n, bearingMob: 0, angle: n, rangeCables: 0, rangeYards: 0, transfer: 1, advance: adv, distToNewCourse: 0, time: '', speed: 12 });
const existing: TurningDataSet[] = [{ wheelAngle: 15, testSpeed: 12, turnSide: 'Starboard', initialHead: 0, data: [row(30, 111), row(90, 999)] }];
const merged = t.mergeTurningSets(existing, r.sets);
assert.equal(merged.length, 2);
assert.deepEqual(merged[0].data.map(d => [d.turnAmount, d.advance]), [[30, 380], [60, 640], [90, 999]]);   // 30 replaced, 90 kept, sorted
assert.equal(existing[0].data[0].advance, 111);

console.log('tableConvert: all checks passed');
