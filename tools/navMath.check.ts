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

// ---- angle on the bow: we are east of a target (bearing to target 270 from us would mean it is west of us)
const aob = m.angleOnBow;
assert.deepEqual(aob(90, 270), { angle: 0, side: null });                    // target east of us, heading west straight at us
assert.deepEqual(aob(90, 90), { angle: 180, side: null });                   // target east of us, heading east straight away
let bow = aob(90, 0);                                                        // target east of us heading north: we are on its port beam (west of it)
assert.equal(bow.side, 'Port'); near(bow.angle, 90);
bow = aob(90, 180); assert.equal(bow.side, 'Starboard'); near(bow.angle, 90); // heading south: we (west) are on its starboard beam
bow = aob(45, 300); assert.equal(bow.side, 'Port'); near(bow.angle, 75);
near(m.targetCourseFromBowAngle(90, 90, 'Starboard'), 180); near(m.targetCourseFromBowAngle(90, 90, 'Port'), 0);
near(m.targetCourseFromBowAngle(90, 0, null), 270); near(m.targetCourseFromBowAngle(90, 180, null), 90);
for (let b = 0; b < 360; b += 37) for (let tc = 0; tc < 360; tc += 41) {       // round trip for every combination
  const x = aob(b, tc);
  near(Math.abs(m.norm360(m.targetCourseFromBowAngle(b, x.angle, x.side) - tc + 180) - 180), 0, 1e-9);
}

// ---- coordinates
near(m.parseCoord('51 28.5 N', 'lat')!, 51 + 28.5 / 60); near(m.parseCoord("1\u00B012.3'W", 'lon')!, -(1 + 12.3 / 60));
near(m.parseCoord('-1.2', 'lon')!, -1.2); near(m.parseCoord('51.475', 'lat')!, 51.475); near(m.parseCoord('1 12 30 W', 'lon')!, -(1 + 12 / 60 + 30 / 3600));
for (const [t, k] of [['95 N', 'lat'], ['51 70 N', 'lat'], ['51 E', 'lat'], ['abc', 'lat'], ['1 2 3 4', 'lat'], ['51 N 2 S', 'lat'], ['', 'lon'], ['181 E', 'lon']] as const) {
  assert.equal(m.parseCoord(t, k), null, `${t} should be rejected`);
}
near(m.parseAngle('26 34.2')!, 26 + 34.2 / 60); near(m.parseAngle('26.57')!, 26.57);
assert.equal(m.parseAngle('-5'), null); assert.equal(m.parseAngle('26 61'), null); assert.equal(m.parseAngle('x'), null);
assert.equal(m.formatCoord(51.475, 'lat'), "51\u00B028.50'N"); assert.equal(m.formatCoord(-1.2, 'lon'), "1\u00B012.00'W");
assert.equal(m.formatCoord(0.99999999, 'lat'), "1\u00B000.00'N");
const lp = m.fromLocalNm(m.toLocalNm(51.2, -1.3, 51, -1.5), 51, -1.5); near(lp.lat, 51.2, 1e-12); near(lp.lon, -1.3, 1e-12);

// ---- horizontal sextant angle
near(m.positionCircleRadius(2, 90), 1); near(m.distanceOffHSA(2, 90)!, 1);
near(m.distanceOffHSA(4, 60)!, 2 / Math.tan(Math.PI / 6)); assert.equal(m.distanceOffHSA(2, 0), null); assert.equal(m.distanceOffHSA(0, 30), null);

type P = { x: number; y: number };
const brg = (p: P, q: P) => m.norm360(Math.atan2(q.x - p.x, q.y - p.y) * 180 / Math.PI);
const seen = (p: P, a: P, b: P, c: P) => [m.norm360(brg(p, b) - brg(p, a)), m.norm360(brg(p, c) - brg(p, b))];
const solve = (p: P, a: P, b: P, c: P) => { const [al, be] = seen(p, a, b, c); return { al, be, fix: m.hsaFix(a, b, c, al, be) }; };

// observer at the origin looking roughly north, then looking south (left and right swap)
for (const [A, B, C] of [[{ x: -2, y: 6 }, { x: 1, y: 7 }, { x: 5, y: 5 }], [{ x: 2, y: -6 }, { x: -1, y: -7 }, { x: -5, y: -5 }]]) {
  const { al, be, fix } = solve({ x: 0, y: 0 }, A, B, C);
  assert.ok(!('error' in fix), JSON.stringify(fix)); if ('error' in fix) throw 0;
  near(fix.x, 0, 1e-6); near(fix.y, 0, 1e-6); assert.equal(fix.weak, false);
  near(fix.ranges[1], Math.hypot(B.x, B.y), 1e-6); near(fix.bearings[1], brg({ x: 0, y: 0 }, B), 1e-6);
  assert.ok(al > 0 && be > 0);
}

// sweep: a fixed shore line seen from many offshore positions - every non-degenerate case must recover the position
const A = { x: -4, y: 0 }, B = { x: 0, y: 2 }, C = { x: 5, y: 0 };
const d2 = (a: P, b: P) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const ux = (A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y);
const uy = (A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x);
const den = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
const cc = { x: ux / den, y: uy / den }; const rc = Math.sqrt(d2(cc, A));          // circumcircle = the danger circle
let solved = 0, flagged = 0, weak = 0;
for (let x = -14; x <= 14; x += 2.5) for (let y = -16; y <= -2; y += 2.5) {
  const p = { x, y }; const { al, be, fix } = solve(p, A, B, C);
  if (!(al > 0 && be > 0 && al + be < 180)) continue;
  const nearDanger = Math.abs(Math.sqrt(d2(p, cc)) - rc) < 0.4 * rc;
  if ('error' in fix) { assert.ok(nearDanger, `unexpected failure at ${x},${y}: ${JSON.stringify(fix)}`); flagged++; continue; }
  near(fix.x, x, 1e-6); near(fix.y, y, 1e-6);          // weak or not, the position itself must be exact
  if (fix.weak) weak++; else solved++;
}
assert.ok(solved > 20 && weak > 0, `solved ${solved}, weak ${weak}, refused ${flagged}`);

// on the danger circle itself: must refuse or flag, never return a confident wrong answer
const onCircle = { x: cc.x + rc * Math.cos(-1.2), y: cc.y + rc * Math.sin(-1.2) };
{ const { fix } = solve(onCircle, A, B, C); assert.ok('error' in fix || fix.weak, 'danger circle must be flagged'); }

// bad input
assert.ok('error' in m.hsaFix(A, B, C, 0, 20)); assert.ok('error' in m.hsaFix(A, B, C, 100, 90)); assert.ok('error' in m.hsaFix(A, A, C, 20, 20));
{ const { al, be } = solve({ x: 0, y: -8 }, A, B, C); const r = m.hsaFix(C, B, A, al, be); assert.ok('error' in r || Math.hypot(r.x, r.y + 8) > 0.01, 'reversed objects must not reproduce the position'); }

// ---- length units
assert.deepEqual(m.LENGTH_UNIT_KEYS, ['cables', 'nm', 'metres', 'yards', 'km', 'feet', 'fathoms']);
assert.equal(m.DEFAULT_DISTANCE_UNIT, 'cables'); assert.equal(m.DEFAULT_HEIGHT_UNIT, 'metres');
near(m.convertLength(1, 'nm', 'cables'), 10); near(m.convertLength(1, 'cables', 'metres'), 185.2); near(m.convertLength(2025, 'yards', 'nm'), 2025 * 0.9144 / 1852);
near(m.convertLength(6, 'feet', 'fathoms'), 1); near(m.convertLength(1, 'km', 'nm'), 1000 / 1852); near(m.convertLength(5, 'metres', 'metres'), 5);
for (const a of m.LENGTH_UNIT_KEYS) for (const b of m.LENGTH_UNIT_KEYS) near(m.convertLength(m.convertLength(7.5, a, b), b, a), 7.5, 1e-9);   // every pair round-trips
assert.equal(m.isLengthUnit('cables'), true); assert.equal(m.isLengthUnit('nautical miles'), false); assert.equal(m.isLengthUnit(undefined), false); assert.equal(m.isLengthUnit('toString'), false);
assert.equal(m.formatLength(3.4641, 'cables'), '3.46 cables'); assert.equal(m.formatLength(1852, 'metres'), '1852 m'); assert.equal(m.formatLength(0.05, 'nm'), '0.050 nm');
assert.equal(m.formatLength(0.4, 'metres'), '0.40 m'); assert.equal(m.formatLength(7.25, 'metres'), '7.3 m'); assert.equal(m.formatLength(123.456, 'yards'), '123 yd');

// ---- object length from end bearings
let o = m.objectLengthFromBearings(1, 355, 5)!;                                   // 10 degrees across, wrapping through north
near(o.angle, 10); near(o.length, 2 * Math.tan(5 * Math.PI / 180));
near(m.objectLengthFromBearings(1, 5, 355)!.length, o.length);                     // order of the two bearings does not matter
near(m.objectLengthFromBearings(2, 90, 100)!.length, 2 * o.length);                // proportional to distance
near(m.objectLengthFromBearings(10, 0, 90)!.length, 20);                           // 90 degrees: length = 2 x distance
near(m.objectLengthFromBearings(5, 10, 350)!.angle, 20);                           // the smaller angle is taken
// the answer comes out in the unit the distance went in: 5 cables, 3 degrees -> about 0.26 cables, ~48.5 m
near(m.convertLength(m.objectLengthFromBearings(5, 100, 103)!.length, 'cables', 'metres'), 2 * 5 * Math.tan(1.5 * Math.PI / 180) * 185.2);
assert.equal(m.objectLengthFromBearings(1, 40, 40), null); assert.equal(m.objectLengthFromBearings(1, 0, 180), null);   // no angle / opposite directions
assert.equal(m.objectLengthFromBearings(0, 40, 50), null); assert.equal(m.objectLengthFromBearings(-1, 40, 50), null); assert.equal(m.objectLengthFromBearings(NaN, 40, 50), null);

console.log('navMath: all checks passed');
