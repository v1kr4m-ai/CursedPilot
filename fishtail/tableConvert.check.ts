// Run: node fishtail/tableConvert.check.ts
import assert from 'node:assert/strict';
import * as t from './tableConvert.ts';
import type { TurningDataSet } from '../types.ts';

// clock format
assert.equal(t.secondsToClock(105), '01:45'); assert.equal(t.secondsToClock(5), '00:05'); assert.equal(t.secondsToClock(3725), '62:05'); assert.equal(t.secondsToClock(-4), '00:00');

// sheet with its own metadata columns, awkward header spellings
const rows = [
  { 'Own Speed (kts)': 12, 'Rudder Angle (deg)': 15, 'Side of Turn': 'Port', 'Heading (deg)': 30, 'Advance (yds)': 380, 'Transfer (yds)': 90, 'Time (sec)': 70 },
  { 'Own Speed (kts)': 12, 'Rudder Angle (deg)': 15, 'Side of Turn': 'Port', 'Heading (deg)': 60, 'Advance (yds)': 640, 'Transfer (yds)': 300, 'Time (sec)': 125 },
  { 'Own Speed (kts)': 8, 'Rudder Angle (deg)': 'abc', 'Side of Turn': 'Stbd', 'Heading (deg)': 60, 'Advance (yds)': 1, 'Transfer (yds)': 1, 'Time (sec)': 1 },
];
assert.equal(t.hasEmbeddedMetadata(rows), true);
assert.equal(t.hasEmbeddedMetadata([{ Heading: 30, Advance: 380, Transfer: 90, Time: 70 }]), false);
const pts = t.rowsToPoints(rows);
assert.equal(pts[0].side, 'port'); assert.equal(pts[2].side, 'starboard'); assert.equal(pts[0].advance, 380); assert.equal(pts[1].time, 125);

const { sets, skipped } = t.pointsToTurningSets(pts);
assert.equal(skipped, 1);                                                    // the 'abc' wheel angle
assert.equal(sets.length, 1);
assert.deepEqual([sets[0].testSpeed, sets[0].wheelAngle, sets[0].turnSide], [12, 15, 'Port']);
assert.deepEqual(sets[0].data.map(r => [r.turnAmount, r.advance, r.transfer, r.time]), [[30, 380, 90, '01:10'], [60, 640, 300, '02:05']]);

// flat sheet: metadata supplied by the user
const flat = t.rowsToPoints([{ Heading: 45, Adv: 500, Trans: 200, Sec: 90 }], { ownSpeed: 10, rudder: '20', side: 'starboard' });
assert.deepEqual([flat[0].heading, flat[0].advance, flat[0].transfer, flat[0].time, flat[0].ownSpeed, flat[0].rudder], [45, 500, 200, 90, 10, '20']);

// merging: same speed/wheel/side replaces matching turn amounts, keeps the rest, sorts; others are added
const row = (n: number, adv: number) => ({ id: `r${n}`, turnAmount: n, bearingMob: 0, angle: n, rangeCables: 0, rangeYards: 0, transfer: 1, advance: adv, distToNewCourse: 0, time: '', speed: 12 });
const existing: TurningDataSet[] = [{ wheelAngle: 15, testSpeed: 12, turnSide: 'Port', initialHead: 0, data: [row(30, 111), row(90, 999)] }];
const merged = t.mergeTurningSets(existing, sets);
assert.equal(merged.length, 1);
assert.deepEqual(merged[0].data.map(r => [r.turnAmount, r.advance]), [[30, 380], [60, 640], [90, 999]]);   // 30 replaced, 90 kept, sorted
assert.equal(existing[0].data[0].advance, 111);                                                            // input not mutated
const other = t.mergeTurningSets(existing, [{ ...sets[0], testSpeed: 20 }]);
assert.equal(other.length, 2);

// this app's own Excel export re-imports cleanly (wheel/side columns, mm:ss times)
const own = t.rowsToPoints([{ 'Speed (kn)': 12, 'Wheel (°)': 15, Side: 'Starboard', 'Initial head (°)': 0, 'Turn (°)': 60, 'Advance (yd)': 640, 'Transfer (yd)': 300, Time: '02:05', 'Speed (kn)_1': 12 }]);
assert.equal(t.hasEmbeddedMetadata([{ 'Speed (kn)': 12, 'Wheel (°)': 15, Side: 'Starboard', 'Turn (°)': 60 }]), true);
assert.deepEqual([own[0].ownSpeed, own[0].rudder, own[0].side, own[0].heading, own[0].advance, own[0].transfer, own[0].time], [12, '15', 'starboard', 60, 640, 300, 125]);

console.log('tableConvert: all checks passed');
