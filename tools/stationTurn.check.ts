// Run: node tools/stationTurn.check.ts
import assert from 'node:assert/strict';
import { solve } from './stationTurn.ts';

// a worked example: Guide 000 at 12 kn; own ship approaches on 130; station 180 at 1000 yd; margin 50 yd; advance 210, transfer 430,
// 1 kn lost at 25 yd per knot, the turn takes 1 min 58 s
const s = solve({ guideCourse: 0, guideSpeed: 12, approachCourse: 130, stationBearing: 180, stationDistance: 1000, margin: 50, marginSide: 'Starboard',
  advance: 210, transfer: 430, speedLoss: 1, decelPerKnot: 25, turnSeconds: 118 });
assert.equal(Math.round(s.guideRun), 787);
assert.equal(Math.round(s.guideBearing), 216);
assert.equal(Math.round(s.guideDistance), 280);
assert.equal(Math.round(s.transferBearing), 40); assert.ok(s.turnAngle < 0);          // the turn from 130 to 000 is to port
assert.deepEqual([s.points.B.x, s.points.B.y].map(Math.round), [0, -1000]);
assert.deepEqual([s.points.C.x, s.points.C.y].map(Math.round), [50, -1000]);
// no turn data and the ship already on the Guide's course: the Wheel-Over Point is the station less the Guide's run
const z = solve({ guideCourse: 90, guideSpeed: 10, approachCourse: 90, stationBearing: 180, stationDistance: 500, margin: 0, marginSide: 'Port', advance: 0, transfer: 0, speedLoss: 0, decelPerKnot: 0, turnSeconds: 60 });
assert.equal(Math.round(z.guideBearing * 10) / 10, 326.3); assert.equal(Math.round(z.guideDistance), 601);
console.log('stationTurn: all checks passed');
