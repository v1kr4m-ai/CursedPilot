// Run: node services/vesselReport.check.ts
import assert from 'node:assert/strict';
import * as r from './vesselReport.ts';
import type { Ship } from '../types.ts';

const blank = { id: 'b', turnAmount: 345, bearingMob: 0, angle: 0, rangeCables: 0, rangeYards: 0, transfer: 0, advance: 0, distToNewCourse: 0, time: '', speed: '' as const };
const filled = { ...blank, id: 'f', turnAmount: 60, transfer: 300, advance: 640, time: '02:05', speed: 12 };
const ship: Ship = {
  id: 's1', name: 'HMS <Evil> & "Co"', type: 'Destroyer',
  particulars: { lengthOverall: 152.4, breadthOverall: 21.2, displacement: 8500, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 },
  turningDataSets: [{ wheelAngle: 15, testSpeed: 12, turnSide: 'Starboard', initialHead: 90, data: [blank, filled] }, { wheelAngle: 20, testSpeed: 8, turnSide: 'Port', data: [blank] }],
  accelDecelData: [{ id: 'a', date: '2026-01-02', description: 'trial', value: '0 to 20 kn in 120 s' }],
  fishtails: [], emLogCalibration: [], compassSwing: [],
};

// blank pre-filled sheet rows are dropped, real ones kept
assert.equal(r.rowHasData(blank), false); assert.equal(r.rowHasData(filled), true);
assert.equal(r.rowHasData({ ...blank, time: '01:00' }), true);

const sheets = r.vesselSheets(ship);
assert.deepEqual(sheets.map(s => s.name), ['Vessel', 'Turning data', 'Acceleration and deceleration', 'Fishtails', 'EM log calibration', 'Compass swing']);
assert.ok(sheets.every(s => s.name.length <= 31));
assert.equal(sheets[1].rows.length, 2);                                    // header + the one filled row (second set is all blank)
assert.deepEqual(sheets[1].rows[1].slice(0, 5), [12, 15, 'Starboard', 90, 60]);
assert.deepEqual(sheets[2].rows[1], ['2026-01-02', '0 to 20 kn in 120 s', 'trial']);
assert.deepEqual(sheets[3].rows, [r.RECORD_HEADER]);                       // empty section still has its header

// HTML is escaped and complete
const html = r.vesselReportHtml(ship, new Date('2026-10-04T10:00:00Z'));
assert.ok(!html.includes('<Evil>') && html.includes('&lt;Evil&gt; &amp; &quot;Co&quot;'));
assert.ok(html.includes('exported 2026-10-04') && html.includes('152.4') && html.includes('640') && html.includes('12 kn, wheel 15° Starboard, initial head 90°'));
assert.ok(!html.includes('wheel 20'));                                      // all-blank set omitted
assert.ok(html.includes('No records.'));
assert.equal(r.vesselReportHtml({ ...ship, turningDataSets: [] }).includes('No turning data recorded.'), true);

// file names
assert.equal(r.vesselFileName(ship, 'xlsx', new Date('2026-10-04T10:00:00Z')), 'hms-evil-co-2026-10-04.xlsx');
assert.equal(r.vesselFileName({ ...ship, name: '***' }, 'json', new Date('2026-10-04T10:00:00Z')), 'vessel-2026-10-04.json');

console.log('vesselReport: all checks passed');
