// Run: node tools/rangeFormulas.check.ts
import assert from 'node:assert/strict';
import * as r from './rangeFormulas.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);

// BR 45(1)(1) Example 8-1: lighthouse elevation 40 m above MHWS, tide 2.12 m below it, VSA 0 deg 46'.2, index error +1'.2: 1.65 n miles
{
  const angle = r.correctedAngle(46.2 / 60, 1.2), elev = r.correctedElevation(40, 2.12);
  near(angle * 60, 47.4, 1e-9, 'corrected angle'); near(elev, 42.12, 1e-9);
  near(r.distanceByHeight(elev, angle), 1.65, 0.005, 'range of the light');
  near(r.distanceByHeight(40, angle), 1.565, 0.01, 'without the tide correction the range is less');
}
// formula 8.1a: an object 100 m wide subtending 1 degree is 100 / 0.017453 = 5729.6 m
near(r.distanceByWidth(100, 1) * 1852, 5729.58, 0.05); assert.ok(Number.isNaN(r.distanceByWidth(100, 0)));
// Appendix 6, Example A6-1: mountain 1646 m, height of eye 7.6 m, VSA 1 deg 59'.3, index error -1'.3, about 25 n miles: 24.6 n miles
{
  const b = r.distanceBeyondHorizon(1646, 7.6, 1 + 59.3 / 60, -1.3, 25)!;
  near(b.distanceNm, 24.6, 0.1, 'range of the mountain'); near(b.apparentDeg * 60, 1 * 60 + 53.1 - 0.0, 0.3, 'apparent altitude (book 1 deg 53.1)');
  near(b.refractionMin, 0.08 * b.distanceNm, 1e-6); assert.ok(b.iterations < 20);
  near(r.distanceBeyondHorizon(1646, 7.6, 1 + 59.3 / 60, -1.3, 5)!.distanceNm, b.distanceNm, 1e-4, 'the first guess does not matter');
}
assert.equal(r.distanceBeyondHorizon(5, 20, 1, 0), null);                                       // an object lower than the eye
// the horizon method, Example 8-3: observed 0 deg 12'.1, index error +1'.2, height of eye 49 ft (14.94 m): 1.42 n miles
{
  const h = 49 * 0.3048, d = r.distanceByHorizon(h, 12.1 / 60, 1.2)!;
  near(d.thetaMin, 20.1, 0.7, 'angle after dip (book 20.1 using its own dip of 6.8)');
  // the book's own numbers: 20.1' = 27.7242 / d + 0.42 d  ->  d = 1.42
  const q = (th: number, hFt: number) => { const disc = th * th - 4 * 0.42 * 0.5658 * hFt; return (th - Math.sqrt(disc)) / 0.84; };
  near(q(20.1, 49), 1.42, 0.005, 'book arithmetic'); near(0.5658 * 49, 27.7242, 1e-4); near(1.8563, 0.5658 * 3.28084, 1e-3, '8.3a and 8.3b agree');
  near(d.distanceNm, 1.42, 0.1);
}
assert.equal(r.distanceByHorizon(10, 0, 0), null);
// dipping range, Example 8-2: eye 12 m, light 40 m: 7.21 + 13.16 = 20.37 n miles (BR 45); Norie's 7.3 + 13.3
near(r.horizon(12, 2.08), 7.21, 0.005); near(r.horizon(40, 2.08), 13.16, 0.005); near(r.dippingRange(12, 40, 2.08), 20.37, 0.01);
near(r.dippingRange(12, 40, r.HORIZON_SETS.norie.visual), 20.6, 0.1, "Norie's gives 20.6");
near(r.dipMinutes(7.6), 4.85, 0.05, 'dip against the book\'s 4.9');
console.log('rangeFormulas: all checks passed');
