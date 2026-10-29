// Run: node tools/stationTurn.check.ts   (BR 45(6) paras 0425 examples 4-3, 4-4 and 4-5; the book's distances are read off a plot, so they are good to about 50 yards)
import assert from 'node:assert/strict';
import { radarPicture, solve } from './stationTurn.ts';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const cnear = (a: number, b: number, tol: number, m = '') => near(((a - b + 540) % 360) - 180, 0, tol, m);

// Example 4-3: Guide 220-18; station 500 yd astern; approach 040 at 22 kn; 30 degrees of wheel: advance 200, transfer 530, 1 min 30 s, 4 kn lost; margin 100
const e3 = solve({ guideCourse: 220, guideSpeed: 18, approachCourse: 40, approachSpeed: 22, stationBearing: 40, stationDistance: 500, margin: 100, marginSide: 'Starboard',
  advance: 200, transfer: 530, speedLoss: 4, decelPerKnot: 33, turnSeconds: 90 });
near(e3.guideRun, 900, 1e-6); near(e3.excess, 0, 1e-9); assert.equal(e3.variant, 'near stationing speed');
cnear(e3.guideBearing, 86, 1, 'E4-3 true bearing'); near(e3.guideDistance, 820, 60, 'E4-3 range'); cnear(e3.relativeBearing, 46, 1, 'E4-3 relative');
assert.equal(Math.round(e3.transferBearing), 130); assert.ok(e3.turnAngle > 0);   // reciprocal: Auto turns toward the Guide, here to starboard (green 46)
// Example 4-4: Guide 220-15, approach at 30 kn; advance 280, transfer 630, 1 min 12 s, 3 kn lost; 33 yd per knot -> 12 kn @ 33 = 396 yd later
const e4 = solve({ guideCourse: 220, guideSpeed: 15, approachCourse: 40, approachSpeed: 30, stationBearing: 40, stationDistance: 500, margin: 100, marginSide: 'Starboard',
  advance: 280, transfer: 630, speedLoss: 3, decelPerKnot: 33, turnSeconds: 72 });
near(e4.correction, 396, 1e-6); near(e4.guideRun, 600, 1e-6); assert.equal(e4.variant, 'very high speed');
cnear(e4.guideBearing, 131, 1, 'E4-4 true bearing'); near(e4.guideDistance, 710, 40, 'E4-4 range'); cnear(e4.relativeBearing, 91, 1, 'E4-4 relative');
// Example 4-5: Guide 320-15, oblique approach 100 at 15 kn; advance 400, transfer 380, the shorter way (140 degrees to port), 1 min 40 s, 4 kn lost; margin on the Guide's port side
const e5 = solve({ guideCourse: 320, guideSpeed: 15, approachCourse: 100, approachSpeed: 15, stationBearing: 140, stationDistance: 500, margin: 100, marginSide: 'Port',
  advance: 400, transfer: 380, speedLoss: 4, decelPerKnot: 33, turnSeconds: 100 });
near(e5.correction, -132, 1e-6); assert.equal(e5.variant, 'equal speed'); near(e5.guideRun, 833, 5);
cnear(e5.guideBearing, 90, 2, 'E4-5 true bearing'); near(e5.guideDistance, 810, 40, 'E4-5 range'); cnear(e5.relativeBearing, -10, 2, 'E4-5 relative (red 10)');
assert.equal(Math.round(e5.transferBearing), 10); assert.ok(e5.turnAngle < 0);
// the plotted turn is the turn shown: forcing the other way moves the wheel-over to the other side (it used to be plotted the wrong way round)
const e3p = solve({ ...{ guideCourse: 220, guideSpeed: 18, approachCourse: 40, approachSpeed: 22, stationBearing: 40, stationDistance: 500, margin: 100, marginSide: 'Starboard' as const,
  advance: 200, transfer: 530, speedLoss: 4, decelPerKnot: 33, turnSeconds: 90 }, turn: 'Port' });
assert.ok(e3p.turnAngle < 0 && e3p.relativeBearing < 0, 'turning to port, the Guide is on the port bow at the wheel-over');
// on own ship's radar (Example 4-3): at the wheel-over the Guide lies where the working says; a minute earlier she is one minute's relative run
// back up her relative track (her 18 kn on 220 less own 22 kn on 040 = 40 kn on 220, 1333 yd a minute), so the blip comes in from 040
{
  const i3 = { guideCourse: 220, guideSpeed: 18, approachCourse: 40, approachSpeed: 22, stationBearing: 40, stationDistance: 500, margin: 100, marginSide: 'Starboard' as const,
    advance: 200, transfer: 530, speedLoss: 4, decelPerKnot: 33, turnSeconds: 90 };
  const s3 = solve(i3), r3 = radarPicture(i3, s3, 3);
  cnear(r3.wheelOver.trueBearing, s3.guideBearing, 1e-9); near(r3.wheelOver.range, s3.guideDistance, 1e-9); cnear(r3.wheelOver.relativeBearing, s3.relativeBearing, 1e-9);
  cnear(r3.relCourse, 220, 1e-9); near(r3.relSpeed, 40, 1e-9);
  assert.deepEqual(r3.blips.map(b => b.minutes), [-3, -2, -1]);
  const b1 = r3.blips[2];
  near(b1.x - r3.wheelOver.x, 1333.33 * Math.sin(40 * Math.PI / 180), 0.1); near(b1.y - r3.wheelOver.y, 1333.33 * Math.cos(40 * Math.PI / 180), 0.1);
  assert.ok(r3.blips[0].range > r3.blips[1].range && r3.blips[1].range > r3.blips[2].range);   // closing
  cnear(r3.onStation.trueBearing, 220, 1e-9); near(r3.onStation.range, 500, 1e-9);           // on station 500 yd astern of her: she is right ahead, on 220
}
console.log('stationTurn: all checks passed');
