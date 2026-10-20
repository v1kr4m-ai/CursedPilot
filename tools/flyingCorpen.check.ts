// Run: node tools/flyingCorpen.check.ts
import assert from 'node:assert/strict';
import * as fc from './flyingCorpen.ts';

const near = (a: number, b: number, tol = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
const angNear = (a: number, b: number, tol = 1e-6, what = '') => near(fc.signed(a - b), 0, tol, what);

// a ship making 10 kn into a 15 kn wind feels 25 kn from right ahead
{
  const a = fc.apparentWind(90, 10, { from: 90, speed: 15 });
  near(a.speed, 25); near(a.rel, 0); angNear(a.from, 90);
  // running downwind at 10 kn in a 15 kn wind: 5 kn on deck, from astern
  const d = fc.apparentWind(90, 10, { from: 270, speed: 15 }); near(d.speed, 5); near(Math.abs(d.rel), 180);
  // a wind on the beam: ship 10 kn north, wind 10 kn from the east: 14.1 kn from 45 degrees on the starboard bow
  const b = fc.apparentWind(0, 10, { from: 90, speed: 10 }); near(b.speed, 14.142, 0.001); near(b.rel, 45, 1e-9); angNear(b.from, 45);
  // stopped: the true wind
  const s = fc.apparentWind(123, 0, { from: 200, speed: 17 }); near(s.speed, 17); angNear(s.from, 200);
}

// true wind from the wind on deck, round trip with apparentWind
for (const [course, speed, from, ws] of [[90, 10, 90, 15], [0, 10, 90, 10], [215, 18, 330, 22], [350, 5, 10, 3], [60, 25, 60, 12]] as const) {
  const a = fc.apparentWind(course, speed, { from, speed: ws });
  const t = fc.trueWind(course, speed, a.rel, a.speed);
  near(t.speed, ws, 1e-9, 'true wind speed'); angNear(t.from, from, 1e-7, 'true wind direction');
}
// the book case: 25 kn felt dead ahead at 10 kn on 090 means a true wind of 15 kn from 090
{ const t = fc.trueWind(90, 10, 0, 25); near(t.speed, 15); angNear(t.from, 90); }
// a ship stopped feels the true wind
{ const t = fc.trueWind(0, 0, 40, 20); near(t.speed, 20); angNear(t.from, 40); }

// flying course: 25 kn wanted from right ahead in a 15 kn wind from 090: steer 090 at 10 kn, or run off downwind at 40 kn
{
  const r = fc.flyingCourses({ from: 90, speed: 15 }, 25, 0);
  assert.equal(r.length, 2); angNear(r[0].course!, 90); near(r[0].speed, 10); assert.equal(r[0].downwind, false);
  angNear(r[1].course!, 270); near(r[1].speed, 40); assert.equal(r[1].downwind, true);
}
// wind stronger than the deck needs, dead ahead: only running downwind works (steaming into it would give more than asked)
{
  const r = fc.flyingCourses({ from: 90, speed: 30 }, 25, 0);
  assert.equal(r.length, 1); angNear(r[0].course!, 270); near(r[0].speed, 55);
}
// wind on deck from Green 15: every answer really gives that wind and speed
for (const wind of [{ from: 0, speed: 12 }, { from: 137, speed: 20 }, { from: 301, speed: 8 }]) for (const [wod, theta] of [[25, 15], [30, -10], [20, 0], [35, 30], [15, -20]] as const) {
  const r = fc.flyingCourses(wind, wod, theta);
  for (const f of r) {
    const a = fc.apparentWind(f.course!, f.speed, wind);
    near(a.speed, wod, 1e-7, `wod for ${JSON.stringify(wind)} ${wod}/${theta}`); near(a.rel, theta, 1e-6, 'angle on deck');
  }
}
// no solution when the angle cannot be had: a 5 kn wind cannot give 25 kn from 40 degrees on the bow
assert.deepEqual(fc.flyingCourses({ from: 0, speed: 5 }, 25, 40), []);
// calm: any course, the speed is the deck wind
{ const r = fc.flyingCourses({ from: 0, speed: 0 }, 22, 0); assert.equal(r[0].course, null); near(r[0].speed, 22); }
// the slower answer comes first
{ const r = fc.flyingCourses({ from: 45, speed: 18 }, 28, 10); for (let i = 1; i < r.length; i++) assert.ok(r[i].speed >= r[i - 1].speed); }
near(fc.turnBetween(350, 20), 30); near(fc.turnBetween(20, 350), -30); near(fc.turnBetween(90, 270), -180 === fc.signed(180) ? -180 : 180);
console.log('flyingCorpen: all checks passed');
