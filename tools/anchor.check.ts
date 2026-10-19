// Run: node tools/anchor.check.ts
import assert from 'node:assert/strict';
import * as a from './anchor.ts';

const near = (x: number, y: number, tol = 1e-9, what = '') => assert.ok(Math.abs(x - y) <= tol, `${what} ${x} is not within ${tol} of ${y}`);

// formulae 14.1 - 14.4
near(a.cableRequired(36, 'metres', 'steel'), 9);                      // 1.5 x 6
near(a.cableRequired(25, 'metres', 'steel'), 7.5);
near(a.cableRequired(36, 'metres', 'bronze'), 6);
near(a.cableRequired(16, 'fathoms', 'steel'), 8);                     // 2 x 4
near(a.cableRequired(20, 'fathoms', 'bronze'), Math.sqrt(26));        // sqrt(1.3 x 20)
assert.equal(a.cableRequired(0, 'metres', 'steel'), 0); assert.equal(a.cableRequired(-3, 'fathoms', 'steel'), 0);
// the metric and fathom forms of formula 14.1 / 14.2 agree to about 1.5%
near(a.cableRequired(36, 'metres', 'steel'), a.cableRequired(36 / 1.8288, 'fathoms', 'steel'), 0.15);
near(a.benignCable(10), 4);

// Example 14-2: ship 155 m, 10 shackles (275 m) usable, 1.5 cable (275 m) margin: 155 + 275 + 275 = 705 m
const c = a.circles({ shipLength: 155, stemToStandard: 45, veeredShackles: 5, maxUsableShackles: 10, safetyMargin: 275 });
near(c.safety, 155 + 10 * a.SHACKLE_M + 275); near(c.safety, 705, 1);   // the book rounds a shackle to 27.5 m
// Example 14-3 in yards, 30 yd to the shackle: ship 120 yd, stem to standard 45 yd, 5 veered (150 yd), 7 available (210 yd), margin 1 cable (100 yd)
{
  const y = (m: number) => m / 0.9144, e = a.circles({ shipLength: 120 * 0.9144, stemToStandard: 45 * 0.9144, veeredShackles: 5, maxUsableShackles: 7, safetyMargin: 100 * 0.9144 });
  near(y(e.bridge), 150 * (a.SHACKLE_M / 27.432) + 45, 1e-6); near(y(e.stern), 150 + 120, 1e-6); near(y(e.normalMsr), 270, 1e-6); near(y(e.safety), 7 * 30 + 120 + 100, 1e-6);
}
near(c.bridge, 5 * a.SHACKLE_M + 45); near(c.stern, 155 + 5 * a.SHACKLE_M); near(c.normalMsr, c.stern); near(c.reducedMsr, 155 + 45);
// the Safety Swinging Circle does not depend on the cable veered, nor the MSR on the cable available
near(a.circles({ shipLength: 155, stemToStandard: 45, veeredShackles: 2, maxUsableShackles: 10, safetyMargin: 275 }).safety, c.safety);
near(a.circles({ shipLength: 155, stemToStandard: 45, veeredShackles: 5, maxUsableShackles: 3, safetyMargin: 275 }).normalMsr, c.normalMsr);
// two ships: double is the two added, single is the larger
assert.deepEqual(a.spacing(300, 250), { double: 550, single: 300 });
near(a.REDUCED_ALLOWANCE_M / a.SHACKLE_M, 1.64, 0.01);                // "just under 2 shackles" (para 1412g)
console.log('anchor: all checks passed');
