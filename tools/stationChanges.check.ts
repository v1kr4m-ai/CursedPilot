// Run: node tools/stationChanges.check.ts   (BR 45(6) paras 0427 to 0429)
import assert from 'node:assert/strict';
import * as s from './stationChanges.ts';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
// Example 4-6: four ships 500 yd apart at 12 kn, stationing speed 20, 33 yd/kn
const r = s.reverseOrder({ ships: 4, spacing: 500, columnSpeed: 12, stationingSpeed: 20, perKnot: 33 })!;
near(r.lengthYards, 1500, 1e-9); near(r.minutes, 9.48, 0.01, 'time'); near(r.distanceNm, 3.0, 0.01, 'distance'); near(r.seaRoomNoMarginNm, 2.25, 0.01, 'less the column'); near(r.seaRoomNm, 2.8, 0.02, 'with 25 %');
assert.equal(s.reverseOrder({ ships: 1, spacing: 500, columnSpeed: 12, stationingSpeed: 20, perKnot: 33 }), null);
assert.equal(s.reverseOrder({ ships: 4, spacing: 500, columnSpeed: 12, stationingSpeed: 8, perKnot: 33 }), null);    // no relative speed
// 360 degree turn: the Guide at 16 kn runs 4267 yd in an 8 minute turn, plus 4 kn lost x 33 yd/kn
near(s.distanceLost360({ guideSpeed: 16, turnSeconds: 480, speedLoss: 4, perKnot: 33 }), 4266.67 + 132, 0.01);
// round the clock: every pair in para 0429 has a solution; the others do not
const pairs: [s.Station, s.Station][] = [['Ahead', 'Astern'], ['Ahead', 'Abeam'], ['Bow (45)', 'Abeam'], ['Bow (45)', 'Quarter'], ['Abeam', 'Astern'], ['Astern', 'Abeam'], ['Abeam', 'Ahead']];
for (const [a, b] of pairs) assert.ok(s.roundTheClock(a, b), `${a} to ${b}`);
assert.ok(s.roundTheClock('Abeam', 'Abeam', 'opposite')!.warning); assert.equal(s.roundTheClock('Abeam', 'Abeam', 'same'), null);
assert.equal(s.roundTheClock('Quarter', 'Ahead'), null);
assert.equal(s.roundTheClock('Abeam', 'Astern')!.warning, true); assert.equal(s.roundTheClock('Ahead', 'Abeam')!.speed, 'Equal speed'); assert.equal(s.roundTheClock('Astern', 'Abeam')!.speed, 'Stationing speed');
// rule of thumb: Guide 12, stationing 20, relative speed 8 -> 2 x 8 = 16 degrees out (the book prints 20, an arithmetic slip); 4 degrees a knot for astern to quarter
near(s.angleOut(12, 20), 16, 1e-9); near(s.angleOut(12, 20, 4), 32, 1e-9);
console.log('stationChanges: all checks passed');
