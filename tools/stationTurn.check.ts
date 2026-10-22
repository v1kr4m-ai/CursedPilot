// Run: node tools/stationTurn.check.ts   (BR 45(6) paras 0425 examples 4-3, 4-4 and 4-5; the book's distances are read off a plot, so they are good to about 50 yards)
import assert from 'node:assert/strict';
import { solve } from './stationTurn.ts';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const cnear = (a: number, b: number, tol: number, m = '') => near(((a - b + 540) % 360) - 180, 0, tol, m);

// Example 4-3: Guide 220-18; station 500 yd astern; approach 040 at 22 kn; 30 degrees of wheel: advance 200, transfer 530, 1 min 30 s, 4 kn lost; margin 100
const e3 = solve({ guideCourse: 220, guideSpeed: 18, approachCourse: 40, approachSpeed: 22, stationBearing: 40, stationDistance: 500, margin: 100, marginSide: 'Starboard',
  advance: 200, transfer: 530, speedLoss: 4, decelPerKnot: 33, turnSeconds: 90 });
near(e3.guideRun, 900, 1e-6); near(e3.excess, 0, 1e-9); assert.equal(e3.variant, 'near stationing speed');
cnear(e3.guideBearing, 86, 1, 'E4-3 true bearing'); near(e3.guideDistance, 820, 60, 'E4-3 range'); cnear(e3.relativeBearing, 46, 1, 'E4-3 relative');
assert.equal(Math.round(e3.transferBearing), 310); assert.ok(e3.turnAngle < 0);
// Example 4-4: Guide 220-15, approach at 30 kn; advance 280, transfer 630, 1 min 12 s, 3 kn lost; 33 yd per knot -> 12 kn @ 33 = 396 yd later
const e4 = solve({ guideCourse: 220, guideSpeed: 15, approachCourse: 40, approachSpeed: 30, stationBearing: 40, stationDistance: 500, margin: 100, marginSide: 'Starboard',
  advance: 280, transfer: 630, speedLoss: 3, decelPerKnot: 33, turnSeconds: 72 });
near(e4.correction, 396, 1e-6); near(e4.guideRun, 600, 1e-6); assert.equal(e4.variant, 'very high speed');
cnear(e4.guideBearing, 131, 1, 'E4-4 true bearing'); near(e4.guideDistance, 710, 40, 'E4-4 range'); cnear(e4.relativeBearing, 91, 1, 'E4-4 relative');
// Example 4-5: Guide 320-15, oblique approach 100 at 15 kn; advance 400, transfer 380 (the book turns to starboard), 1 min 40 s, 4 kn lost; margin on the Guide's port side
const e5 = solve({ guideCourse: 320, guideSpeed: 15, approachCourse: 100, approachSpeed: 15, stationBearing: 140, stationDistance: 500, margin: 100, marginSide: 'Port',
  advance: 400, transfer: 380, speedLoss: 4, decelPerKnot: 33, turnSeconds: 100, turn: 'Starboard' });
near(e5.correction, -132, 1e-6); assert.equal(e5.variant, 'equal speed'); near(e5.guideRun, 833, 5);
cnear(e5.guideBearing, 90, 2, 'E4-5 true bearing'); near(e5.guideDistance, 810, 40, 'E4-5 range'); cnear(e5.relativeBearing, -10, 2, 'E4-5 relative (red 10)');
assert.equal(Math.round(e5.transferBearing), 190);
console.log('stationTurn: all checks passed');
