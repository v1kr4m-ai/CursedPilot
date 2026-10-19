// Run: node tools/shipParams.check.ts
import assert from 'node:assert/strict';
import type { Ship } from '../types.ts';
import { firstNumber, shipParams } from './shipParams.ts';

const base: Ship = {
  id: 's', name: 'Test', type: 'Frigate',
  particulars: { lengthOverall: 142.5, breadthOverall: 16.9, displacement: 3850, stemToStandard: 48, stemToBridge: 40, stemToRas: 0, stemToFueling: 0 },
  turningDataSets: [], fishtails: [], emLogCalibration: [],
  accelDecelData: [
    { id: '1', date: '2025-01-01', description: 'old', fields: { type: 'Deceleration', from: '20', to: '10', time: '60', distance: '300' } },
    { id: '2', date: '2026-02-01', description: 'new', fields: { type: 'Deceleration', from: '25', to: '15', time: '70', distance: '350' } },
    { id: '3', date: '2026-03-01', description: 'accel', fields: { type: 'Acceleration', from: '5', to: '25', time: '120', distance: '900' } },
  ],
  compassSwing: [{ id: 'c', date: '2026-01-01', description: 'swing', fields: { d0: '1', d45: '2', d90: '1', d135: '0', d180: '-1', d225: '-2', d270: '-1', d315: '0' } }],
  info: { shipClass: '', pennant: '', builder: '', commissioned: '', status: '', displacement: '', length: '', beam: '', draught: '4.5 m', speed: 'over 30 knots', propulsion: '', complement: '', armament: '', sensors: '', aircraft: '', notes: '', wiki: '' },
  custom: [
    { id: 'a', group: 'particulars', label: 'Height of eye', value: '18', unit: 'm' },
    { id: 'b', group: 'particulars', label: 'Anchor cable', value: '11', unit: 'shackles' },
    { id: 'c', group: 'details', label: 'Height of eye', value: '99' },
  ],
};

const p = shipParams(base);
assert.equal(p.length, 142.5); assert.equal(p.stemToStandard, 48); assert.equal(p.draught, 4.5); assert.equal(p.maxSpeed, 30);
assert.equal(p.heightOfEye, 18); assert.equal(p.cableShackles, 11);                                   // a detail (not a particular) is ignored
assert.equal(p.decelMetresPerKnot, 35);                                                                 // the latest deceleration run: 350 m over 10 kn
assert.ok(p.swing && Math.abs(p.swing.A - 0) < 1e-9 + 1);                                               // all eight headings give coefficients
assert.deepEqual(shipParams(undefined), {});
// a ship with nothing recorded gives nothing, and zero is not a value
const bare = shipParams({ ...base, particulars: { ...base.particulars, lengthOverall: 0, stemToStandard: 0 }, custom: [], accelDecelData: [], compassSwing: [], info: undefined });
assert.equal(bare.length, undefined); assert.equal(bare.stemToStandard, undefined); assert.equal(bare.heightOfEye, undefined); assert.equal(bare.swing, undefined); assert.equal(bare.decelMetresPerKnot, undefined);
// the length falls back to the free-text detail, a height of eye in feet is converted
assert.equal(shipParams({ ...base, particulars: { ...base.particulars, lengthOverall: 0 }, info: { ...base.info!, length: '133 m' } }).length, 133);
near(shipParams({ ...base, custom: [{ id: 'x', group: 'particulars', label: 'H.O.E.', value: '60', unit: 'ft' }] }).heightOfEye!, 18.288);
assert.equal(firstNumber('about 12.5 kn'), 12.5); assert.equal(firstNumber('n/a'), undefined);

function near(a: number, b: number) { assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`); }
console.log('shipParams: all checks passed');
