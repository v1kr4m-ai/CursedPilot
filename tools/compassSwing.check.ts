// Run: node tools/compassSwing.check.ts
import assert from 'node:assert/strict';
import * as c from './compassSwing.ts';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

// deviations made from known coefficients are recovered exactly from the eight headings
const known = { A: 1, B: 3, C: -2, D: 0.5, E: -1 };
const dev = c.SWING_HEADINGS.map(h => c.deviationAt(known, h));
const got = c.coefficients(dev)!;
for (const k of ['A', 'B', 'C', 'D', 'E'] as const) near(got[k], known[k]);

// ...and the card between the swing headings follows the same curve
for (const p of c.deviationTable(got, 15)) near(p.dev, c.deviationAt(known, p.heading));
assert.equal(c.deviationTable(got, 15).length, 24); assert.equal(c.deviationTable(got, 10).length, 36);

// a constant deviation is pure A
const flat = c.coefficients(Array(8).fill(2))!;
near(flat.A, 2); for (const k of ['B', 'C', 'D', 'E'] as const) near(flat[k], 0);

// all eight must be there
assert.equal(c.coefficients([1, 2, 3, null, 5, 6, 7, 8]), null); assert.equal(c.coefficients([1, 2]), null);

// sign convention: compass reading 3 deg east of magnetic on 090 gives B > 0
assert.ok(c.coefficients([0, 1, 3, 1, 0, -1, -3, -1])!.B > 2);

// worst point on the card
const w = c.worst({ A: 0, B: 4, C: 0, D: 0, E: 0 }); near(w.heading, 90); near(w.dev, 4);

// text
assert.equal(c.formatDev(3.24), '3.2°E'); assert.equal(c.formatDev(-1.04), '1.0°W'); assert.equal(c.formatDev(0.02), '0.0°');
assert.deepEqual(c.readDeviations({ d0: '1', d45: '-2.5', d90: '', d180: 'x' }), [1, -2.5, null, null, null, null, null, null]);
assert.equal(c.swingSummary('Standard', Array(8).fill(null), '+1.5'), 'Standard compass · residual deviation +1.5°');
assert.match(c.swingSummary('Gyro', dev, ''), /^Gyro compass · A \+1\.0 B \+3\.0 C -2\.0 D \+0\.5 E -1\.0 · max /);

console.log('compassSwing: all checks passed');
