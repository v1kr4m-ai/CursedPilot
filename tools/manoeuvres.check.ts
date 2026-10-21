// Run: node tools/manoeuvres.check.ts
import assert from 'node:assert/strict';
import * as m from './manoeuvres.ts';

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
// Stopwatch: stationed 5 cables astern, Guide at 10 kn -> 3 minutes
near(m.stopwatchSeconds(5 * 200, 10), 180, 1e-9);
// Radian rule, column: Adv 200, T 200, 5 cables astern, 12 kn, turn 1 minute: the Guide runs 2 cables (400 yd), R = 4 cables, angle about 15 degrees
const c = m.columnTurn({ knots: 12, distance: 1000, advance: 200, transfer: 200, turnSeconds: 60 })!;
near(c.guideRun, 400, 1e-9); near(c.along, 800, 1e-9); near(c.radian, 15, 1e-9); near(c.exact, 14.04, 0.01);
// Corpen 'S': 12 kn, transfer 300, turn 1.5 min (600 yd run), 50 yd lost, range 4 cables -> 350 ahead, 26 degrees
const s = m.abreastTurn({ knots: 12, range: 800, transfer: 300, turnSeconds: 90, lossYards: 50 })!;
near(s.guideRun, 600, 1e-9); near(s.netAhead, 350, 1e-9); near(s.radian, 26.25, 1e-9);
// Regaining track: 2 cables off, 5 degrees throw-off -> 24 cables, 12 minutes at 12 kn
near(m.distanceToRegain(2, 5), 24, 1e-9); near(24 / 12 * 6, 12, 1e-9);
// 2 cables off, regain in 5 minutes at 12 kn (10 cables) -> 12 degrees
near(m.throwOffToRegain(2, 10), 12, 1e-9);
// stream: sin(angle) = 2 / 8
near(m.streamAllowance(2, 8)!, 14.48, 0.01); assert.equal(m.streamAllowance(9, 8), null);
// RAS: RAS point at 3 cables; 5 degrees off gives 150 ft; 4 degrees gives 120 ft; 120 ft at 3 cables needs 4 degrees
near(m.lateralFeet(3, 5), 150, 1e-9); near(m.lateralFeet(3, 4), 120, 1e-9); near(m.angleForSeparation(120, 3), 4, 1e-9);
// surge: 18 -> 12 kn in a minute against a Guide at 12 kn: 500 - 400 = 100 yd; at 0.5 cable the angle is 24 degrees
near(m.surgeYards(18, 12, 12, 60), 100, 1e-9); near(m.angleForSeparation(120, 100 / 200), 24, 1e-9);
console.log('manoeuvres: all checks passed');
