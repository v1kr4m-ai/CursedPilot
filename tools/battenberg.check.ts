// Run: node tools/battenberg.check.ts
import assert from 'node:assert/strict';
import * as b from './battenberg.ts';

const near = (x: number, y: number, tol = 1e-6, what = '') => assert.ok(Math.abs(x - y) <= tol, `${what} ${x} is not within ${tol} of ${y}`);

// BR 45(6) Example 4-1: own ship 4 miles on the Guide's port beam (Guide 030 at 10 kn), stationing speed 20 kn, to a station 1 mile ahead of the Guide
const guideCourse = 30;
const from = b.place(b.stationBearing(guideCourse, -90), 4), to = b.place(b.stationBearing(guideCourse, 0), 1);
const sol = b.solve({ guideCourse, guideSpeed: 10, stationingSpeed: 20, from, to });
assert.equal(sol.length, 1);                                       // faster than the Guide: one course
// the book reads 073 off a plot; the exact solution of the triangle is 076.9 (relative track 106.0, relative speed 15.1 kn)
near(sol[0].course, 76.95, 0.05, 'course'); near(sol[0].relativeSpeed, 15.07, 0.01, 'relative speed'); near(sol[0].relativeCourse, 105.96, 0.05, 'relative course');
// the course really does give the relative track from -> to: own velocity minus the Guide's velocity points along (to - from)
{
  const v = { x: 20 * Math.sin((sol[0].course * Math.PI) / 180), y: 20 * Math.cos((sol[0].course * Math.PI) / 180) };
  const g = { x: 10 * Math.sin((30 * Math.PI) / 180), y: 10 * Math.cos((30 * Math.PI) / 180) };
  const rel = { x: v.x - g.x, y: v.y - g.y }, d = { x: to.x - from.x, y: to.y - from.y };
  near(rel.x * d.y - rel.y * d.x, 0, 1e-9, 'relative velocity is parallel to the track');
  assert.ok(rel.x * d.x + rel.y * d.y > 0, 'and points the right way');
  near(sol[0].hours, Math.hypot(d.x, d.y) / sol[0].relativeSpeed, 1e-12);
}
// the same speed as the Guide, joining dead astern from 2 miles to 1 mile: closes along the Guide's course at once
{
  const s = b.solve({ guideCourse: 90, guideSpeed: 10, stationingSpeed: 15, from: b.place(270, 2), to: b.place(270, 1) });
  near(s[0].course, 90, 1e-9); near(s[0].relativeSpeed, 5, 1e-9); near(s[0].hours, 0.2, 1e-9);
}
// slower than the Guide: two courses are possible when the track runs back towards her, and none if the speed is too low
{
  const two = b.solve({ guideCourse: 0, guideSpeed: 10, stationingSpeed: 8, from: b.place(0, 2), to: b.place(180, 2) });
  assert.equal(two.length, 2);                                     // dropping astern from 2 miles ahead to 2 miles astern at 8 kn against 10: slow ahead (relative 2 kn) or reverse course (relative 18 kn)
  near(two[0].course, 180, 1e-9); near(two[0].relativeSpeed, 18, 1e-9); near(two[1].course, 0, 1e-9); near(two[1].relativeSpeed, 2, 1e-9);
  assert.equal(b.solve({ guideCourse: 0, guideSpeed: 10, stationingSpeed: 3, from: b.place(90, 3), to: b.place(150, 3) }).length, 0);   // too slow to make the track good at all
  const some = b.solve({ guideCourse: 0, guideSpeed: 10, stationingSpeed: 9, from: b.place(90, 3), to: b.place(150, 3) });
  assert.ok(some.length >= 1);
  // each course really holds the speed and gives the relative track asked for
  for (const s of some) {
    const v = { x: 9 * Math.sin((s.course * Math.PI) / 180), y: 9 * Math.cos((s.course * Math.PI) / 180) };
    const rel = { x: v.x - 0, y: v.y - 10 }, d = { x: b.place(150, 3).x - b.place(90, 3).x, y: b.place(150, 3).y - b.place(90, 3).y };
    near(rel.x * d.y - rel.y * d.x, 0, 1e-9); assert.ok(rel.x * d.x + rel.y * d.y > 0);
  }
}
assert.deepEqual(b.solve({ guideCourse: 0, guideSpeed: 10, stationingSpeed: 15, from: b.place(0, 1), to: b.place(0, 1) }), []);   // already there

// slowing (para 0424): a frigate at 33 yd per knot slowing 25 -> 15 kn runs 330 yd; Example 4-2
{
  const prob = { guideCourse: 90, guideSpeed: 15, stationingSpeed: 25, from: b.place(270, 3), to: b.place(270, 0.5) };
  const s = b.solve(prob)[0];
  near(s.course, 90, 1e-9); near(s.relativeSpeed, 10, 1e-9);
  const sl = b.slowing(prob, s, 33 / 2025.37)!;
  near(sl.decelDistance * 2025.37, 330, 1e-6, 'deceleration distance in yards');
  near(sl.backAlongTrack * 2025.37, 330 * (10 / 25), 1e-6, 'scaled by relative speed over own speed');
  near(sl.distance, 0.5 + (330 * 0.4) / 2025.37, 1e-9);                                        // on the track astern of the station
  near(sl.guideBearsTrue, 90, 1e-6);                                                          // the Guide is right ahead
  assert.equal(sl.immediately, false);
  assert.equal(b.slowing({ ...prob, stationingSpeed: 15 }, s, 33 / 2025.37), null);          // nothing to lose
  assert.equal(b.slowing({ ...prob, from: b.place(270, 0.51) }, b.solve({ ...prob, from: b.place(270, 0.51) })[0], 33 / 2025.37)!.immediately, true);
}
// playing the run: starts at the start, ends on the station, never goes backwards and never overshoots
{
  const prob = { guideCourse: 90, guideSpeed: 15, stationingSpeed: 25, from: b.place(270, 3), to: b.place(270, 0.5) };
  const s = b.solve(prob)[0], sl = b.slowing(prob, s, 33 / 2025.37)!, pr = b.profile(prob, s, sl);
  near(pr.at(0).pos.x, prob.from.x, 1e-9); near(pr.at(0).pos.y, prob.from.y, 1e-9);
  const end = pr.at(pr.totalHours); near(end.pos.x, prob.to.x, 1e-9); near(end.pos.y, prob.to.y, 1e-9); near(end.relSpeed, 0, 1e-9);
  near(pr.at(pr.totalHours + 5).pos.x, prob.to.x, 1e-9, 'stays on station');
  let prev = -1e9;
  for (let i = 0; i <= 200; i++) { const x = pr.at((pr.totalHours * i) / 200).pos.x; assert.ok(x >= prev - 1e-9 && x <= prob.to.x + 1e-9, 'steady closing'); prev = x; }
  // time: the straight run to the slow-down point at 10 kn, then twice the slow-down distance over 10 kn
  near(pr.totalHours, (2.5 - sl.backAlongTrack) / 10 + (2 * sl.backAlongTrack) / 10, 1e-9);
  near(pr.at((2.5 - sl.backAlongTrack) / 10).relSpeed, 10, 1e-9, 'full relative speed up to the slow-down point');
  near(pr.guideAt(2).x, 30, 1e-9);                                                                // the Guide steams 15 kn due east
  // with no deceleration figure: constant speed to the station
  const flat = b.profile(prob, s, null); near(flat.totalHours, 2.5 / 10, 1e-12); near(flat.at(0.1).pos.x, -3 + 1, 1e-9);
}
// stations given as true bearings are the same points as the angle off the Guide's bow: Guide 040, starboard beam (090 off the bow) is 130 true
{ const p1 = b.place(b.stationBearing(40, 90), 1.5), p2 = b.place(130, 1.5); if (Math.abs(p1.x - p2.x) > 1e-9 || Math.abs(p1.y - p2.y) > 1e-9) throw new Error('true bearing and angle off the bow disagree'); if (b.stationBearing(40, -90) !== 310) throw new Error('port beam'); }
console.log('battenberg: all checks passed');
