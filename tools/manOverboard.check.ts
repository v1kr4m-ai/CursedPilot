// Run: node tools/manOverboard.check.ts
import assert from 'node:assert/strict';
import * as m from './manOverboard.ts';

const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

assert.deepEqual(m.turnsFor('williamson', 'Starboard'), [60, -240]); assert.deepEqual(m.turnsFor('williamson', 'Port'), [-60, 240]);
assert.deepEqual(m.turnsFor('scharnow', 'Starboard'), [240, -60]);
// the turns add up to half a circle either way round: the ship ends reciprocal to her start
for (const k of ['williamson', 'scharnow'] as const) for (const sd of ['Port', 'Starboard'] as const) near((((m.turnsFor(k, sd).reduce((a, b) => a + b, 0)) % 360) + 360) % 360, 180);
// every manoeuvre ends on the reciprocal
for (const k of ['williamson', 'scharnow'] as const) for (const s of ['Port', 'Starboard'] as const) near(m.rescue(k, s, () => ({ advance: 1, transfer: 1, time: 1 })).headingEnd, 180);

// a ship that turns on the spot (no advance, no transfer) stays at the man, after the time the legs take
let o = m.rescue('williamson', 'Starboard', () => ({ advance: 0, transfer: 0, time: 30 }));
near(o.distance, 0); near(o.seconds, 60);

// pure advance on each leg: Starboard Williamson, legs of 100 yards along heads 000 and 060 -> ends 100 ahead and 100 sin60 east, 100 cos60 north
o = m.rescue('williamson', 'Starboard', () => ({ advance: 100, transfer: 0, time: 10 }));
near(o.x, 100 * Math.sin(Math.PI / 3)); near(o.y, 100 + 100 * Math.cos(Math.PI / 3));
// the same fall to port is the mirror image
const p = m.rescue('williamson', 'Port', () => ({ advance: 100, transfer: 0, time: 10 }));
near(p.x, -o.x); near(p.y, o.y); near(p.lateral, -o.lateral);

// transfer goes to the side of the turn: first leg stbd turn, transfer 50 -> 50 to starboard of head 000; second leg port turn from head 060, transfer to port of 060
o = m.rescue('scharnow', 'Starboard', l => (l === 240 ? { advance: 0, transfer: 50, time: 0 } : { advance: 0, transfer: 0, time: 0 }));
near(o.x, 50); near(o.y, 0);
o = m.rescue('scharnow', 'Starboard', l => (l === 60 ? { advance: 0, transfer: 50, time: 0 } : { advance: 0, transfer: 0, time: 0 }));
// second leg starts on head 240, turns port: transfer is 90 deg to port of 240 = 150 -> (sin150, cos150)*50
near(o.x, 50 * Math.sin((150 * Math.PI) / 180)); near(o.y, 50 * Math.cos((150 * Math.PI) / 180));

// the man is dead astern-ish of a ship ending 200 yd ahead of him heading 180: he is dead ahead (relative bearing 0)
o = m.rescue('williamson', 'Starboard', l => (l === 60 ? { advance: 200, transfer: 0, time: 0 } : { advance: 0, transfer: 0, time: 0 }));
// leg 1 advance 200 along 000 -> (0, 200); leg 2 no movement; head 180; man bears 180 true -> relative 0
near(o.x, 0); near(o.y, 200); near(o.manRelativeBearing, 0); near(o.toRun, 200); near(o.distance, 200);

assert.ok(m.TURNS.williamson.how('Starboard').includes('060') && m.TURNS.scharnow.how('Port').includes('240'));
console.log('manOverboard: all checks passed');
