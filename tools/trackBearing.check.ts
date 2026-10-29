// Run: node tools/trackBearing.check.ts
import assert from 'node:assert/strict';
import { trackTable } from './trackBearing.ts';

const near = (a: number, b: number, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const base = { bearing: 0, course: 90, range: 10, known: 'initial' as const, step: 5, count: 2 };

// crossing from the left, abeam at the start: 000 at 10, then 026.6 at 11.18, then 045 at 14.14 (a 10-10 right angle, a 5-10-11.18 triangle)
{
  const r = trackTable(base)!;
  assert.equal(r.rows.length, 3);
  near(r.rows[0].bearing, 0); near(r.rows[0].range, 10); assert.ok(r.rows[0].isKnown);
  near(r.rows[1].bearing, 26.565); near(r.rows[1].range, 11.18);
  near(r.rows[2].bearing, 45); near(r.rows[2].range, 14.142);
  near(r.cpa.range, 10); near(r.cpa.fromKnown, 0);
}
// the known point is the end of the run: the rows go back along the track to it
{
  const r = trackTable({ bearing: 90, course: 0, range: 5, known: 'final', step: 5, count: 2 })!;
  assert.deepEqual(r.rows.map(x => x.fromKnown), [-10, -5, 0]);
  near(r.rows[0].range, 11.18); near(r.rows[0].bearing, 153.435); near(r.rows[1].range, 7.071); near(r.rows[1].bearing, 135);
  near(r.rows[2].range, 5); near(r.rows[2].bearing, 90); assert.ok(r.rows[2].isKnown && !r.rows[0].isKnown);
  near(r.cpa.range, 5); near(r.cpa.fromKnown, 0);         // the line of sight is square to the track at the known point
}
// coming straight at the observer: the range falls by the step each row and the bearing holds; the closest approach is zero, at the range run
{
  const r = trackTable({ bearing: 45, course: 225, range: 10, known: 'initial', step: 2.5, count: 3 })!;
  r.rows.forEach((x, i) => { near(x.range, 10 - 2.5 * i); near(x.bearing, 45); });
  near(r.cpa.range, 0); near(r.cpa.fromKnown, 10);
}
// going past the closest point: the range grows again, and the closest approach lies behind a run that starts after it
{
  const r = trackTable({ bearing: 315, course: 90, range: 10, known: 'initial', step: 10, count: 1 })!;   // 10 nm out on the port bow side, heading east
  near(r.cpa.fromKnown, 7.071); near(r.cpa.range, 7.071); near(r.cpa.bearing, 0);
  near(r.rows[1].range, 7.654); near(r.rows[1].bearing, 22.5);
  const past = trackTable({ bearing: 45, course: 90, range: 10, known: 'initial', step: 1, count: 1 })!;
  assert.ok(past.cpa.fromKnown < 0);                       // already opening
}
// 5 cables is 0.5 nm: the step is given to the module in nm
{
  const r = trackTable({ ...base, step: 0.5, count: 4 })!;
  near(r.rows[4].run, 2); near(r.rows[4].range, Math.hypot(10, 2));
}
// figures that cannot be worked
assert.equal(trackTable({ ...base, range: 0 }), null); assert.equal(trackTable({ ...base, step: 0 }), null);
assert.equal(trackTable({ ...base, count: 0 }), null); assert.equal(trackTable({ ...base, course: NaN }), null);
console.log('trackBearing: all checks passed');
