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
console.log('shipChecks: all checks passed');
