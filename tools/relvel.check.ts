// Run: node tools/relvel.check.ts   (the printed answers are those of the REL-VEL docket)
import assert from 'node:assert/strict';
import * as r from './relvel.ts';
import { place, solve } from './battenberg.ts';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const cnear = (a: number, b: number, tol: number, m = '') => near(((a - b + 540) % 360) - 180, 0, tol, m);

// Lesson 2: course and speed of the other ship from her relative track
let c = r.contactFromPlots(345, 12, [{ minutes: 0, bearing: 105, range: 11 }, { minutes: 15, bearing: 105, range: 10 }])!;
cnear(c.course, 331.1, 0.2, 'L2Q1'); near(c.speed, 14.4, 0.1, 'L2Q1');   // the docket prints 330-15.2, a plotting figure
c = r.contactFromPlots(340, 12, [[0, 330, 5.7], [6, 338, 4.9], [12, 350, 4.2], [18, 5, 3.8], [24, 20, 3.7], [30, 39, 3.9], [36, 55, 4.5]].map(([minutes, bearing, range]) => ({ minutes, bearing, range })))!;
cnear(c.course, 41, 3, 'example 1'); near(c.speed, 10, 0.7, 'example 1');
// Lesson 4: when will she be 8.5 miles away (30 min); the second example, 10 miles at 42.5 min on bearing 042
const sh = (own: [number, number], p: [number, number], t: [number, number]) => ({ p0: r.pos(p[0], p[1]), rel: { x: r.vec(t[0], t[1]).x - r.vec(own[0], own[1]).x, y: r.vec(t[0], t[1]).y - r.vec(own[0], own[1]).y } });
let s = sh([340, 23], [320, 15], [20, 15]); let a = r.approach(s.p0, s.rel, 8.5)!;
near(a.events[0].minutes, 30, 1.5, 'L4Q1');
s = sh([57, 15], [25, 20], [125, 12]); a = r.approach(s.p0, s.rel, 10)!;
near(a.events[0].minutes, 42.5, 1, 'L4Q2'); cnear(a.events[0].bearing, 42, 2, 'L4Q2');
// Lesson 6: closing a faster ship
let f = r.closeFaster(r.pos(300, 10), 30, 15, 10)!;
cnear(f.course, 342, 1, 'L6 example'); near(f.cpa, 7.5, 0.1, 'L6 example'); near(f.minutes, 38, 3, 'L6 example');
// docket L6 Q1 (21 kn against 25 kn, answer 220 and 2.6 miles): a collision course exists at 284 here, so the printed answer is not a closest-approach one
f = r.closeFaster(r.pos(330, 8), 187, 25, 21)!;
near(f.cpa, 0, 0.05, 'L6Q1 can close fully');
f = r.closeFaster(r.pos(305, 13), 40, 15, 11)!;
cnear(f.course, 358, 1, 'L6Q4'); near(f.cpa, 8.2, 0.3, 'L6Q4');
// Lesson 7: passing at a distance (ahead 350 / astern 268; ahead 183 / astern 153)
let p = r.passAt(r.pos(263, 11), 20, 24, 28, 5);
cnear(p.find(x => x.side === 'ahead')!.course, 350, 1, 'L7Q4 ahead'); cnear(p.find(x => x.side === 'astern')!.course, 268, 2.5, 'L7Q4 astern');
p = r.passAt(r.pos(125, 15), 227, 15, 21, 3);
cnear(p.find(x => x.side === 'ahead')!.course, 183, 1, 'L7Q6 ahead'); cnear(p.find(x => x.side === 'astern')!.course, 153, 2, 'L7Q6 astern');
near(p.find(x => x.side === 'ahead')!.minutes, 60, 2, 'L7Q6 time'); cnear(p.find(x => x.side === 'ahead')!.bearing, 46, 2, 'L7Q6 bearing');
// Lesson 8: course and speed to change station in one hour (064 at 30 kn), and the closest approach on a run (Q4: 2.6 miles, bearing 149)
const t = r.stationInTime(90, 15, place(220, 10), place(45, 8), 1)!;
cnear(t.course, 64, 1, 'L8Q6'); near(t.speed, 30, 0.5, 'L8Q6');
const from = place(270, 5), to = place(0, 3);                    // guide 180-15; starboard beam 5, then 3 astern
const sol = solve({ guideCourse: 180, guideSpeed: 15, stationingSpeed: 22, from, to })[0];
cnear(sol.course, 95, 1.5, 'L8Q4 course');
const run = r.stationRun(from, to, sol.relativeSpeed);
near(run.closest, 2.6, 0.1, 'L8Q4 closest'); cnear(run.closestBearing, 149, 2, 'L8Q4 bearing');
// Lesson 8 worked example: guide 000-25, own on the port beam 6, to the starboard quarter 8 at 25 kn: 36 min, closest 2.6 miles,
// sighted at 4 miles after 6.5 minutes on bearing 075
const ex = solve({ guideCourse: 0, guideSpeed: 25, stationingSpeed: 25, from: place(270, 6), to: place(135, 8) })[0];
near(ex.hours * 60, 36.25, 1, 'L8 example time'); near(r.stationRun(place(270, 6), place(135, 8), ex.relativeSpeed).closest, 2.6, 0.1, 'L8 example closest');
const sight = r.stationRun(place(270, 6), place(135, 8), ex.relativeSpeed, 4).sight!;
cnear(sight.bearing, 75, 3, 'L8 example sight'); near(sight.minutes, 6.5, 0.5, 'L8 example sight');
console.log('relvel: all checks passed');
