// Run: node data/summaries.check.ts
import assert from 'node:assert/strict';
import * as s from './summaries.ts';
import type { Ship } from '../types.ts';

const base: Ship = { id: 'x', name: 'X', type: 'Other', particulars: { lengthOverall: 0, breadthOverall: 0, displacement: 0, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 }, turningDataSets: [], accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: [] };
const row = (n: number, adv: number, transfer = 1) => ({ id: `r${n}`, turnAmount: n, bearingMob: 0, angle: n, rangeCables: 0, rangeYards: 0, transfer, advance: adv, distToNewCourse: 0, time: '', speed: 12 });

// nothing recorded: counts are zero and no text
for (const x of s.calibrationSummaries(base)) { assert.equal(x.count, 0); assert.equal(x.latest, ''); }
assert.deepEqual(s.calibrationSummaries(base).map(x => x.id), ['turning', 'accel', 'fishtails', 'em', 'compass']);

// dates
assert.equal(s.shortDate('2026-10-04'), '4 Oct 2026'); assert.equal(s.shortDate('2023-10-02'), '2 Oct 2023'); assert.equal(s.shortDate('last week'), 'last week'); assert.equal(s.shortDate('2026-13-01'), '2026-13-01');

// latest record = latest date, not the last typed; equal dates -> the later entry
const rec = (id: string, date: string, value: string) => ({ id, date, description: 'note', value });
const ship: Ship = { ...base, fishtails: [rec('a', '2026-10-04', '14 kn · 15° rudder'), rec('b', '2026-01-02', 'older'), rec('c', '2026-10-04', 'same day, entered later')], emLogCalibration: [{ id: 'e', date: '', description: 'only a note' }] };
assert.equal(s.latestRecord(ship.fishtails)!.id, 'c');
const sums = Object.fromEntries(s.calibrationSummaries(ship).map(x => [x.id, x]));
assert.equal(sums.fishtails.count, 3); assert.equal(sums.fishtails.latest, '4 Oct 2026 · same day, entered later');
assert.equal(sums.em.latest, 'only a note');                                           // no date, no value: the description is shown

// turning data: blank sheet rows do not count; tables are listed
const turning: Ship = { ...base, turningDataSets: [
  { wheelAngle: 15, testSpeed: 12, turnSide: 'Starboard', data: [row(30, 380), row(60, 640), row(345, 0, 0)] },
  { wheelAngle: 20, testSpeed: 8, turnSide: 'Port', data: [row(45, 300)] },
  { wheelAngle: 10, testSpeed: 15, turnSide: 'Port', data: [row(90, 0, 0)] },                  // all blank: not a table yet
] };
assert.deepEqual(s.turningLine(turning), { count: 3, line: '2 tables: 12 kn 15° Stbd, 8 kn 20° Port' });
const many: Ship = { ...base, turningDataSets: [8, 10, 12, 15, 18].map(sp => ({ wheelAngle: 15, testSpeed: sp, turnSide: 'Port' as const, data: [row(30, 100)] })) };
assert.equal(s.turningLine(many).line, '5 tables: 8 kn 15° Port, 10 kn 15° Port, 12 kn 15° Port +2 more');
assert.equal(s.turningLine({ ...base, turningDataSets: [{ wheelAngle: 15, testSpeed: 12, turnSide: 'Port', data: [row(30, 100)] }] }).line, '1 table: 12 kn 15° Port');

console.log('summaries: all checks passed');
