// Run: node tools/board.check.ts
import assert from 'node:assert/strict';
import * as b from './board.ts';
import { place, solve } from './battenberg.ts';
import type { CalculationResult } from '../fishtail/types.ts';

const near = (x: number, y: number, tol: number, m = '') => assert.ok(Math.abs(x - y) <= tol, `${m} ${x} vs ${y}`);
const NM = b.YD_PER_NM;
const base: b.Common = { guideCourse: 0, guideSpeed: 12, ownCourse: 0, ownSpeed: 12, stationingSpeed: 18, nowBearing: 180, nowYards: 2000, nextBearing: 0, nextYards: 2000 };

// missing figures are named, and nothing is drawn
assert.deepEqual(b.stationScene({ ...base, guideSpeed: null, nextYards: null }, null).need, ["the Guide's speed", 'the next station distance']);

// changing station from 2000 yd astern to 2000 yd ahead at 18 kn: the same answer as the Battenberg tool's sum, up her wake
{
  const s = b.stationScene(base, null);
  const [best] = solve({ guideCourse: 0, guideSpeed: 12, stationingSpeed: 18, from: place(180, 2000 / NM), to: place(0, 2000 / NM) });
  assert.match(s.rows[0][1], /^000° at 18 kn$/);
  near(s.play!.totalHours, best.hours, 1e-9); near(best.relativeSpeed, 6, 1e-9);   // 6 kn relative over 4000 yd
  const end = s.play!.at(s.play!.totalHours); near(end.y, 2000 / NM, 1e-9); near(end.x, 0, 1e-9);
  assert.deepEqual(s.marks.map(m => m.kind), ['own', 'station']);
  // with the loss of speed a point to reduce is marked before the station
  const slow = b.stationScene(base, 33);
  assert.ok(slow.marks.some(m => m.kind === 'slow')); assert.match(slow.rows.map(r => r[0]).join('|'), /Reduce/);
  // too slow to get there
  assert.match(b.stationScene({ ...base, stationingSpeed: 10, nextBearing: 0 }, null).warn ?? '', /higher stationing speed/);
}
// on station in a set time: 4000 yd up her wake in 10 min needs about 11.85 kn relative more than her 12 kn
{
  const s = b.inTimeScene(base, 10);
  assert.match(s.rows[0][1], /^steer 000° at 23\.\d kn$/);
  near(s.play!.at(10 / 60).y, 2000 / NM, 1e-9);
}
// holding course and speed: 2000 yd east of a Guide on 000 at 12, own 270 at 12: relative 225 at 17 kn; closest 2000 sin 45 = 1414 yd
{
  const s = b.cpaScene({ ...base, nowBearing: 90, ownCourse: 270 });
  assert.match(s.rows[0][1], /^225° at 17\.0 kn$/);
  assert.match(b.cpaScene({ ...base, ownCourse: 90 }).rows[1][1], /opening/);   // from astern, moving 135 relative: opening
  assert.match(s.rows[1][1], /^1414 yd in /);
  assert.ok(s.marks.some(m => m.kind === 'point' && m.label === 'CPA'));
  assert.match(b.cpaScene(base).rows[0][1], /none/);   // same course and speed: no relative motion
}
// joining from ahead: the wheel-over and the Guide's bearing and range, the same as Station from Bows
{
  const s = b.bowsScene({ guideCourse: 220, guideSpeed: 18, ownCourse: 40, ownSpeed: 22, stationingSpeed: 22, nowBearing: null, nowYards: null, nextBearing: 40, nextYards: 500 },
    { margin: 100, marginSide: 'Starboard', advance: 200, transfer: 530, speedLoss: 4, decelPerKnot: 33, turnSeconds: 90, turn: 'Auto' });
  assert.match(s.rows[0][1], /^Green 46 \(086°T\) at 870 yd$/);   // BR 45(6) Example 4-3
  const wheel = s.marks.find(m => m.kind === 'wheel')!;
  near(s.play!.at(s.play!.totalHours).x, wheel.pos.x, 1e-9); near(s.play!.at(s.play!.totalHours).y, wheel.pos.y, 1e-9);   // the run ends at the wheel-over
}
// a fishtail turned onto the Guide's course: one turn out, 480 yd advance and 300 yd transfer in 60 s, the Guide stopped
{
  const f = { track_points: [{ x: 0, y: 0, heading: 0, advance: 0, transfer: 0, time: 0 }, { x: 300, y: 480, heading: 90, advance: 480, transfer: 300, time: 60, turnAngle: 90 }],
    corner_points: [{ x: 0, y: 0, type: 'start' }, { x: 0, y: 480, type: 'advance' }, { x: 300, y: 480, type: 'transfer' }], lateral_separation: 300, drop_distance: -480, total_time: 60, final_position: { x: 300, y: 480 }, guide_distance: 0 } as unknown as CalculationResult;
  const s = b.fishtailScene({ ...base, guideCourse: 90, guideSpeed: 0, nowBearing: 0, nowYards: 0 }, f, 'Half fishtail');
  const end = s.play!.at(1);                       // Guide on 090: the fishtail's "up" is east, its "right" is south
  near(end.x * NM, 480, 1e-6); near(end.y * NM, -300, 1e-6);
  near(s.play!.totalHours, 60 / 3600, 1e-12);
  assert.deepEqual(b.fishtailScene(base, null, 'x').need, ['turning data for the fishtail']);
}
// rel-vel with the Guide as the other ship: her course from plots, passing her, closing her when slower
{
  // own 000 at 10; the Guide plotted 090 at 4000 yd, then 6 min later 090 at 3000 yd: relative 270 at 4.9 kn (1000 yd in 6 min); true 334 at 11.2
  const p = b.plotScene({ ...base, ownCourse: 0, ownSpeed: 10 }, [{ minutes: 0, bearing: 90, yards: 4000 }, { minutes: 6, bearing: 90, yards: 3000 }]);
  assert.match(p.rows[1][1], /^270° at 4\.9 kn$/);                         // her relative track
  assert.match(p.rows[0][1], /^334° at 11\.2 kn$/);                         // her true velocity = relative + own
  assert.deepEqual(b.plotScene(base, [{ minutes: 0, bearing: 90, yards: 4000 }]).need, ['two or more plots of the Guide']);
  // pass her at 1000 yd: both sides offered, ahead first
  const ps = b.passScene({ ...base, guideCourse: 0, guideSpeed: 10, stationingSpeed: 20, nowBearing: 90, nowYards: 6000 }, 1000);
  assert.ok(ps.rows.some(r => /ahead/.test(r[0])) && ps.rows.some(r => /astern/.test(r[0])));
  // slower than the Guide: the nearest she can be got
  const f = b.fasterScene({ ...base, guideCourse: 0, guideSpeed: 20, stationingSpeed: 10, nowBearing: 0, nowYards: 6000 });   // you 6000 yd ahead of a faster Guide
  assert.match(f.rows[0][0], /Steer/);
}
// round the clock: the book's advice with its manoeuvre (no turning data: the fishtail asks for it)
{
  const r = b.rtcScene(base, 'Ahead', 'Astern', 'Starboard', 'opposite', 1000, null);
  assert.match(r.rows[0][0], /Equal speed \(para 0429a\)/); assert.deepEqual(r.need, ['turning data for the fishtail']);
  const st = b.rtcScene(base, 'Astern', 'Abeam', 'Starboard', 'opposite', 1000, null);   // at stationing speed: the course to steer
  assert.ok(st.rows.some(x => x[0] === 'Course to steer'));
  near(b.stationTrue(90, 'Bow (45)', 'Port'), 45, 1e-9); near(b.stationTrue(90, 'Quarter', 'Starboard'), 225, 1e-9);
}
// RAS: own bridge alongside the Guide's mark, on her starboard side with the Guide to your port; the run from stand-by to final
{
  const plan = { advantage: 4, surgeYd: 100, surgeM: 91.44, pointToStern: 69, xM: -10, thetaDeg: 30, stemOffsetM: 0, runYd: 400, runMinutes: 400 / (4 * NM / 60), atOnce: false, missing: [] };
  const r = b.rasScene({ ...base, guideCourse: 0 }, plan, { bridgeAheadOfMarkM: 0, lateralM: 50, guideTo: 'Port', standbyYd: 500 });
  const fin = r.marks.find(m => m.kind === 'station')!.pos, slow = r.marks.find(m => m.kind === 'slow')!.pos;
  near(fin.x * 1852, 50, 1e-6); near(fin.y, 0, 1e-12); near((fin.y - slow.y) * 1852, 91.44, 1e-6);   // the surge, between slowing and final
  const end = r.play!.at(r.play!.totalHours); near(end.y, 0, 1e-9);
  assert.match(r.rows[2][1], /forward of your port beam/);
}
console.log('board: all checks passed');
