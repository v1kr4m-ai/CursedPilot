// Run: node tools/fuel.check.ts
import assert from 'node:assert/strict';
import * as f from './fuel.ts';

const near = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const regime: f.FuelRegime = { id: 'r', name: 'Cruise', rows: [
  { rpm: '80', speed: '12', rate: '1.2' }, { rpm: '120', speed: '18', rate: '2.6' }, { rpm: '', speed: '', rate: '' }, { rpm: '60', speed: '9', rate: '0.7' }, { rpm: '100', speed: '', rate: '1.9' },
] };
assert.equal(f.points(regime).length, 3);                                        // blank and half-filled rows are left out
assert.deepEqual(f.points(regime).map(p => p.speed), [9, 12, 18]);               // sorted by speed
assert.equal(f.byRpm(regime, '80.0')!.rate, 1.2); assert.equal(f.byRpm(regime, '999'), null);
// interpolation: 15 kn lies halfway between 12 (1.2) and 18 (2.6) -> 1.9 t/h
near(f.bySpeed(regime, 15)!.rate, 1.9); assert.equal(f.bySpeed(regime, 15)!.outside, false);
assert.equal(f.bySpeed(regime, 20)!.outside, true); near(f.bySpeed(regime, 20)!.rate, 2.6);          // nearest row, flagged
assert.equal(f.bySpeed({ id: 'x', name: 'x', rows: [] }, 12), null);
// forward: 60 t at 12 kn and 1.2 t/h -> 50 h and 600 nm; reverse: 240 nm -> 20 h and 24 t
const e = f.endurance(60, 12, 1.2)!; near(e.hours, 50); near(e.distanceNm, 600);
const p = f.passage(240, 12, 1.2)!; near(p.hours, 20); near(p.fuelTonnes, 24);
assert.equal(f.endurance(60, 12, 0), null); assert.equal(f.passage(240, 0, 1.2), null);
near(f.perMile(12, 1.2)!, 0.1);
assert.equal(f.hm(1.5), '1 h 30 min');
assert.equal(f.templateData().regimes.length, 3); assert.ok(f.templateData().regimes.every(r => r.rows.length === 4 && f.points(r).length === 0));
console.log('fuel: all checks passed');
