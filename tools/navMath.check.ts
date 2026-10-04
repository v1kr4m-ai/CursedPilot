// Run: node tools/navMath.check.ts   (prints "navMath: all checks passed" or throws on the first failure)
import assert from 'node:assert/strict';
import * as m from './navMath.ts';

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

// angles
near(m.norm360(-10), 350); near(m.norm360(370), 10); near(m.reciprocal(45), 225); near(m.reciprocal(270), 90);
near(m.radianAngle(1, 60), 0.954929658551372);

// time / speed / distance: any one from the other two
let r = m.solveTSD({ distance: null, speed: 12, minutes: 30 })!; near(r.distance, 6); assert.equal(r.solved, 'distance');
r = m.solveTSD({ distance: 6, speed: null, minutes: 30 })!; near(r.speed, 12);
r = m.solveTSD({ distance: 6, speed: 12, minutes: null })!; near(r.minutes, 30);
assert.equal(m.solveTSD({ distance: 6, speed: 12, minutes: 30 }), null);          // nothing to solve
assert.equal(m.solveTSD({ distance: 6, speed: null, minutes: null }), null);      // too little given
assert.equal(m.solveTSD({ distance: 6, speed: null, minutes: 0 }), null);         // zero time
assert.equal(m.solveTSD({ distance: 6, speed: 0, minutes: null }), null);         // zero speed

// compass
near(m.compassToTrue(90, 2, -5), 87); near(m.trueToCompass(87, 2, -5), 90);
near(m.compassToTrue(358, 1, 3), 2); near(m.trueFromGyro(10, -3), 7); near(m.trueBearing(270, 120), 30);

// CPA: head-on, both 10 kn, 10 nm apart -> collision course in 30 min
let c = m.cpa({ ownCourse: 0, ownSpeed: 10, bearing: 0, range: 10, targetCourse: 180, targetSpeed: 10 });
near(c.cpa, 0, 1e-9); near(c.tcpaMinutes!, 30); assert.equal(c.status, 'closing'); near(c.relativeSpeed, 20); near(c.relativeCourse!, 180);
// target abeam to starboard 5 nm, steaming parallel at the same speed: no relative motion
c = m.cpa({ ownCourse: 0, ownSpeed: 10, bearing: 90, range: 5, targetCourse: 0, targetSpeed: 10 });
assert.equal(c.status, 'steady'); near(c.cpa, 5); assert.equal(c.tcpaMinutes, null);
// crossing: target 5 nm due east of us, heading west at 10 kn, we are stopped -> passes through us
c = m.cpa({ ownCourse: 0, ownSpeed: 0, bearing: 90, range: 5, targetCourse: 270, targetSpeed: 10 });
near(c.cpa, 0, 1e-9); near(c.tcpaMinutes!, 30);
// target already past and opening
c = m.cpa({ ownCourse: 0, ownSpeed: 10, bearing: 180, range: 2, targetCourse: 180, targetSpeed: 10 });
assert.equal(c.status, 'opening'); assert.equal(c.tcpaMinutes, null); near(c.cpa, 2);
// offset pass: target 10 nm ahead, 1 nm to starboard, reciprocal course, equal speeds
c = m.cpa({ ownCourse: 0, ownSpeed: 10, bearing: Math.atan2(1, 10) * 180 / Math.PI, range: Math.hypot(1, 10), targetCourse: 180, targetSpeed: 10 });
near(c.cpa, 1, 1e-9);

// course to steer
let k = m.courseToSteer(90, 10, 90, 0) as { cts: number; sog: number; allowance: number }; near(k.cts, 90); near(k.sog, 10);
k = m.courseToSteer(0, 10, 90, 2) as typeof k;                  // current setting east: steer into it
near(k.allowance, -Math.asin(0.2) * 180 / Math.PI, 1e-9); near(k.cts, 360 + k.allowance, 1e-9); near(k.sog, 10 * Math.cos(Math.asin(0.2)), 1e-9);
k = m.courseToSteer(0, 10, 0, 3) as typeof k; near(k.cts, 0); near(k.sog, 13);   // fair current
k = m.courseToSteer(0, 10, 180, 3) as typeof k; near(k.sog, 7);                    // foul current
assert.ok('error' in m.courseToSteer(0, 5, 90, 6));                                // current too strong
assert.ok('error' in m.courseToSteer(0, 5, 180, 5));                               // no headway
assert.ok('error' in m.courseToSteer(0, 0, 90, 1));

// distance off / horizons
near(m.distanceOffVSA(30, 45) * 1852, 30);                                         // 45 deg: distance == height
near(m.distanceOffVSA(100, 1.5), 100 / Math.tan(1.5 * Math.PI / 180) / 1852);
near(m.visualHorizon(25), 10.4); near(m.radarHorizon(25), 11.05);
near(m.visibleRange(16, 36), 2.08 * (4 + 6)); near(m.radarRange(16, 36), 2.21 * 10);

// wheel-over: a 90 degree turn needs exactly the advance; beyond 90 the new track is met further on
near(m.wheelOverDistance(450, 450, 90)!, 450);
near(m.wheelOverDistance(450, 300, 45)!, 450 - 300 / Math.tan(Math.PI / 4));
assert.ok(m.wheelOverDistance(450, 300, 120)! > 450);                              // past 90 the new track is met further on
near(m.wheelOverDistance(450, 300, -45)!, m.wheelOverDistance(450, 300, 45)!);     // port and starboard alike
assert.equal(m.wheelOverDistance(450, 300, 0), null); assert.equal(m.wheelOverDistance(450, 300, 180), null);

// units
const dist = m.UNIT_GROUPS[0], speed = m.UNIT_GROUPS[1];
near(m.convertUnit(1, 'nautical mile', 'metre', dist), 1852); near(m.convertUnit(1, 'nautical mile', 'cable (0.1 nm)', dist), 10);
near(m.convertUnit(2025, 'yard', 'nautical mile', dist), 2025 * 0.9144 / 1852);
near(m.convertUnit(10, 'knot', 'metre/second', speed), 5.144444444444445, 1e-9); near(m.convertUnit(1, 'knot', 'kilometre/hour', speed), 1.852, 1e-9);
near(m.convertUnit(6, 'foot', 'fathom', dist), 1);

console.log('navMath: all checks passed');
