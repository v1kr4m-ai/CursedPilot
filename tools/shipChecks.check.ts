// Run: node tools/shipChecks.check.ts
import assert from 'node:assert/strict';
import * as c from './shipChecks.ts';

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
// Handbook para 1: true range 1.00, radar 0.98 -> +0.02
near(c.rangeIndexError(1.0, 0.98), 0.02, 1e-9);
// two-mark: charted 3.00 between marks, ranges 1.48 and 1.46 -> (3.00 - 2.94) / 2 = +0.03
near(c.twoMarkIndexError(3.0, 1.48, 1.46), 0.03, 1e-9);
// para 5: gyro bearing 180, radar 179 -> +1
near(c.radarBearingError(180, 179), 1, 1e-9); near(c.radarBearingError(1, 359), 2, 1e-9);
// BR 45(3) Example 4-5, two runs: 1 nm in 218 s and 240 s, log 14.9 and 15.1 -> +5.0%
const v1 = c.groundSpeed(1, 218), v2 = c.groundSpeed(1, 240);
near(v1, 16.5, 0.02); near(v2, 15.0, 0.001);
near(c.logCorrection([{ ground: v1, log: 14.9 }, { ground: v2, log: 15.1 }])!.percent, 5.0, 0.15);
// Example 4-6, four runs -> about -5%
const r4 = c.logCorrection([{ ground: 21.59, log: 20.3 }, { ground: 17.76, log: 20.8 }, { ground: 21.27, log: 20.6 }, { ground: 18.37, log: 20.7 }])!;
near(r4.percent, -4.9, 0.1); assert.equal(r4.method, 'four-run');
near(c.correctedSpeed(20, -5), 19, 1e-9);
assert.equal(c.logCorrection([{ ground: 10, log: 10 }]), null);
// toe-in: repeater 6 m off, Jackstaff 30 m ahead -> 11.3 degrees
near(c.toeInAngle(6, 30), 11.31, 0.01);
near(c.jackstaffReads(90, 11.31, 'Port'), 101.31, 1e-9); near(c.jackstaffReads(5, 11, 'Starboard'), 354, 1e-9);
// echo sounder report steps
assert.deepEqual([10, 25, 60].map(c.soundingReportStep), [1, 5, 10]);
// the saved records: BR 45(1)(2) example 15.1 (charted 21565 yd, radar 21545 yd -> +20 yd)
assert.equal(c.radarIndexError({ method: 'Radar calibration chart', true: '21565', radar: '21545' }), 20);
near(c.radarIndexError({ method: 'Two-mark', ab: '3.00', a: '1.48', b: '1.46' })!, 0.03, 1e-9);
near(c.radarIndexError({ method: 'HSA', ht1: '1.00', hr1: '0.98', ht2: '1.50', hr2: '1.46' })!, 0.03, 1e-9);
near(c.radarIndexError({ method: 'Two-ship', true: '0.50', radar: '0.47' })!, 0.03, 1e-9);
// cocked hat: three marks around a known position, radar ranges all short by 0.04, so the tangent circle has radius 0.04
const P = { x: 0.3, y: -0.2 }, marks = [{ x: 2, y: 1 }, { x: -1.5, y: 1.8 }, { x: 0.5, y: -2.4 }];
const hat = c.radarIndexError({ method: 'Three-mark (cocked hat)', ...Object.fromEntries(marks.flatMap((m, i) => [[`x${i + 1}`, String(m.x)], [`y${i + 1}`, String(m.y)], [`r${i + 1}`, String(Math.hypot(m.x - P.x, m.y - P.y) - 0.04)]])) })!;
near(hat, 0.04, 1e-6);
assert.equal(c.cockedHat([{ x: 0, y: 0, r: 1 }, { x: 1, y: 0, r: 1 }, { x: 2, y: 0, r: 1 }]), null);       // marks in a line
assert.match(c.radarIndexSummary({ method: 'Radar calibration chart', true: '21565', radar: '21545', unit: 'yards' }), /index error \+20\.0 yd \(add to radar ranges\)/);
assert.match(c.radarBearingSummary({ visual: '180', radar: '179' }), /bearing error \+1\.0°/);
// speed log (BR 45(3) example 4-5)
assert.match(c.speedLogSummary({ speed: '15', runs: '2', dist: '1', t1: '218', l1: '14.9', t2: '240', l2: '15.1' }), /\+5\.0 % \(two-run\)/);
// lubber's line: repeater 6 m off to port, Jackstaff 30 m ahead, head 090 -> should read 101.3
const lub = { method: 'Toe-in angle', side: 'Port', offset: '6', ahead: '30', head: '90', read: '101.3' };
const lr = c.lubberResult(lub)!;
near(lr.toeIn!, 11.31, 0.01); near(lr.error, 0, 0.05); assert.match(c.lubberSummary(lub), /aligned/);
near(c.lubberResult({ method: 'Direct comparison', lubber: '1', jack: '359' })!.error, 2, 1e-9);
assert.match(c.echoSummary({ method: 'Hand lead line', ref: '10.0', echo: '10.3' }), /error -0\.30 m/);
console.log('shipChecks: all checks passed');
