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
  info: { shipClass: 'Test class', pennant: 'D99', builder: '', commissioned: '2014-08', status: 'In service', displacement: '', length: '', beam: '', draught: '', speed: '30 kn', propulsion: '', complement: '', armament: '', sensors: '', aircraft: '', notes: '<b>note</b>', wiki: '' },
  accelDecelData: [{ id: 'a', date: '2026-01-02', description: 'trial', value: '0 to 20 kn in 120 s' }],
  fishtails: [], emLogCalibration: [], compassSwing: [],
  custom: [
    { id: 'p1', group: 'particulars', label: 'Mast height', value: '38.5', unit: 'm' }, { id: 'p2', group: 'particulars', label: '', value: '9' },
    { id: 'd1', group: 'details', label: 'Call sign', value: '<VWXY>' }, { id: 'd2', group: 'details', label: 'Empty', value: '  ' },
  ],
};

// blank pre-filled sheet rows are dropped, real ones kept
assert.equal(r.rowHasData(blank), false); assert.equal(r.rowHasData(filled), true);
assert.equal(r.rowHasData({ ...blank, time: '01:00' }), true);

const sheets = r.vesselSheets(ship);
assert.deepEqual(sheets.map(s => s.name), ['Vessel', 'Turning data', 'Acceleration and deceleration', 'Fishtails', 'EM log calibration', 'Compass swing']);
assert.ok(sheets.every(s => s.name.length <= 31));
assert.deepEqual(sheets[0].rows.slice(0, 7), [['Name', 'HMS <Evil> & "Co"'], ['Type', 'Destroyer'], ['Class', 'Test class'], ['Pennant', 'D99'], ['Commissioned', '2014-08'], ['Status', 'In service'], ['Speed', '30 kn']]);   // blank details are left out
// the user's own headings come after the built-in ones; rows without a heading or without a value are left out
{ const v = sheets[0].rows; const i = v.findIndex(r => r[0] === 'Call sign'); assert.deepEqual(v[i - 1], ['Notes', '<b>note</b>']); assert.deepEqual(v[i + 1], []); }
assert.deepEqual(sheets[0].rows.at(-1), ['Mast height', '38.5', 'm']); assert.ok(!sheets[0].rows.some(r => r[0] === 'Empty' || r[1] === 9));
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
assert.ok(html.includes('Mast height') && html.includes('38.5') && html.includes('&lt;VWXY&gt;') && !html.includes('<VWXY>'));
// the richer sections: turning plot (needs two filled rows), fishtail table, EM log error table, compass deviation card
const rich = r.vesselReportHtml({
  ...ship,
  turningDataSets: [{ wheelAngle: 15, testSpeed: 12, turnSide: 'Starboard', data: [filled, { ...filled, id: 'g', turnAmount: 90, transfer: 420, advance: 800 }] }],
  fishtails: [{ id: 'f1', date: '2026-10-01', description: '', fields: { kind: 'Half', angle: '60', speed: '12', wheel: '15', side: 'Starboard', station: 'Abeam Stbd', stationIdx: '2', lateral: '400', drop: '20' } }],
  emLogCalibration: [{ id: 'e1', date: '2026-10-02', description: '', fields: { ref: '10', log: '10.4' } }],
  compassSwing: [{ id: 'c1', date: '2026-10-03', description: '', value: 'Standard compass', fields: { d0: '1', d45: '4', d90: '5', d135: '2', d180: '-1', d225: '-4', d270: '-5', d315: '-2' } }],
}, new Date('2026-10-04T10:00:00Z'));
assert.ok(rich.includes('aria-label="Turning circle plot"') && !html.includes('aria-label="Turning circle plot"'));
assert.ok(rich.includes('<td>Abeam Stbd</td>') && rich.includes('<td>400</td>') && rich.includes('Drop (yd)'));
assert.ok(rich.includes('Correction (kn)') && rich.includes('<td>+0.4</td>') && rich.includes('<td>-0.4</td>'));
assert.ok(rich.includes('aria-label="Deviation curve"') && rich.includes('Largest') && rich.includes('Compass heading'));
assert.ok(html.includes('<h2>Details</h2>') && html.includes('D99') && html.includes('&lt;b&gt;note&lt;/b&gt;'));
assert.ok(!r.vesselReportHtml({ ...ship, info: undefined, custom: [] }).includes('<h2>Details</h2>'));
assert.ok(r.vesselReportHtml({ ...ship, info: undefined }).includes('<h2>Details</h2>'));          // the user's own details alone are enough
assert.equal(r.vesselReportHtml({ ...ship, turningDataSets: [] }).includes('No turning data recorded.'), true);

// file names
assert.equal(r.vesselFileName(ship, 'xlsx', new Date('2026-10-04T10:00:00Z')), 'hms-evil-co-2026-10-04.xlsx');
assert.equal(r.vesselFileName({ ...ship, name: '***' }, 'json', new Date('2026-10-04T10:00:00Z')), 'vessel-2026-10-04.json');

console.log('vesselReport: all checks passed');
