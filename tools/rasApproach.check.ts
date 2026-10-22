// Run: node tools/rasApproach.check.ts   (BR 45(6) RAS example: 18 kn down to the Guide's 12 kn in a minute: surge 100 yd)
import assert from 'node:assert/strict';
import * as r from './rasApproach.ts';
import type { Ship } from '../types.ts';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
// ships with the points at the same place and no breadth: pure surge geometry
const same: r.Dims = { bridge: 50, ras: 50, fuel: 50 };
const p = r.plan({ evolution: 'RASAP', guide: same, approach: same, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 6, separationFt: 120, standbyYd: 500 })!;
near(p.advantage, 6, 1e-9); near(p.slowMinutes, 1, 1e-9); near(p.surgeYd, 100, 1e-6);              // the book's 100 yd surge
near(p.lateralYd, 40, 1e-9); near(p.slowBearing, Math.atan2(40, 100) * 180 / Math.PI, 1e-9);       // 120 ft abeam seen from 100 yd short: 21.8 degrees on the bow
near(p.runYd, 400, 1e-6); near(p.runMinutes, 400 / 200, 1e-6); near(p.totalMinutes, 3, 1e-6); assert.equal(p.atOnce, false);   // 6 kn advantage is 200 yd a minute
// a stand-by station inside the surge: slow at once
assert.equal(r.plan({ evolution: 'RASAP', guide: same, approach: same, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 6, separationFt: 120, standbyYd: 60 })!.atOnce, true);
// a slower deceleration gives a longer surge: 3 kn a minute doubles the time and the surge (the surge is (advantage^2 / 2 / rate) in knot-minutes)
near(r.plan({ evolution: 'RASAP', guide: same, approach: same, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 3, separationFt: 120, standbyYd: 500 })!.surgeYd, 200, 1e-6);
// different points: the Guide's RAS point is further aft than the approach ship's, so her stem ends ahead of the Guide's; the bridge offset changes the bearing
const g: r.Dims = { bridge: 40, ras: 70, fuel: 90, breadth: 16 }, a: r.Dims = { bridge: 45, ras: 60, fuel: 80, breadth: 14 };
const ras = r.plan({ evolution: 'RASAP', guide: g, approach: a, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 6, separationFt: 120, standbyYd: 500 })!;
near(ras.stemOffsetM, 10, 1e-9);
near(ras.lateralYd, 40 + (16 + 14) / 2 * (1 / 0.9144), 1e-6);
const bridge = r.plan({ evolution: 'SKBDL', guide: g, approach: a, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 6, separationFt: 120, standbyYd: 500 })!;
near(bridge.stemOffsetM, -5, 1e-9); const fuel = r.plan({ evolution: 'UNREP', guide: g, approach: a, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 6, separationFt: 120, standbyYd: 500 })!;
near(fuel.stemOffsetM, 10, 1e-9);
// missing figures are named; no speed advantage gives no plan
const m = r.plan({ evolution: 'UNREP', guide: { bridge: 40 }, approach: { bridge: 45, fuel: 80 }, guideSpeed: 12, approachSpeed: 18, decelKnPerMin: 6, separationFt: 120, standbyYd: 500 })!;
assert.deepEqual(m.missing, ["the Guide's fuelling point"]);
assert.equal(r.plan({ evolution: 'RASAP', guide: same, approach: same, guideSpeed: 18, approachSpeed: 12, decelKnPerMin: 6, separationFt: 120, standbyYd: 500 }), null);
// the ship's own deceleration rate from her latest run: 20 to 10 kn in 120 s is 5 kn a minute
const ship = { accelDecelData: [
  { id: '1', date: '2026-01-01', description: '', fields: { type: 'Deceleration', from: '20', to: '12', time: '60' } },
  { id: '2', date: '2026-03-01', description: '', fields: { type: 'Deceleration', from: '20', to: '10', time: '120' } },
  { id: '3', date: '2026-04-01', description: '', fields: { type: 'Acceleration', from: '10', to: '20', time: '30' } },
] } as Pick<Ship, 'accelDecelData'>;
near(r.decelRate(ship)!, 5, 1e-9); assert.equal(r.decelRate({ accelDecelData: [] }), undefined); assert.equal(r.decelRate(undefined), undefined);
console.log('rasApproach: all checks passed');
