// Run: node tools/emLog.check.ts
import assert from 'node:assert/strict';
import * as e from './emLog.ts';

const rec = (id: string, date: string, ref?: string, log?: string) => ({ id, date, description: '', fields: ref === undefined ? undefined : { ref, log: log ?? '' } });
const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

const pts = e.logPoints([rec('a', '2026-01-01', '10', '10.4'), rec('b', '2026-01-02', '20', '20.2'), rec('c', '2026-01-03', '15', '15.5'), rec('old', '2026-01-04'), rec('bad', '2026-01-05', 'x', '1')]);
assert.deepEqual(pts.map(p => p.id), ['a', 'c', 'b']);                 // sorted by log, records without both numbers left out
near(pts[0].error, 0.4); near(pts[2].error, 0.2);

// between points: straight line; at a point: exact; outside: nothing
near(e.trueSpeed(pts, 10.4), 10); near(e.trueSpeed(pts, 20.2), 20);
near(e.trueSpeed(pts, 15.5), 15);
near(e.trueSpeed(pts, 12.95), 12.5);                                    // halfway between (10.4, 10) and (15.5, 15)
assert.equal(e.trueSpeed(pts, 5), null); assert.equal(e.trueSpeed(pts, 25), null); assert.equal(e.trueSpeed([], 10), null); assert.equal(e.trueSpeed(pts, NaN), null);

// two runs at the same log reading: the newest one is used
const two = e.logPoints([rec('x', '2026-01-01', '10', '10.4'), rec('y', '2026-02-01', '9.8', '10.4'), rec('z', '2026-01-01', '20', '20.4')]);
near(e.trueSpeed(two, 10.4), 9.8);

assert.equal(e.signedKn(0.34), '+0.3'); assert.equal(e.signedKn(-0.04), '0.0'); assert.equal(e.signedKn(-0.26), '-0.3');

console.log('emLog: all checks passed');
