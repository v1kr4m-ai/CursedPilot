// Run: node tools/recordDefaults.check.ts
import assert from 'node:assert/strict';
import { recordDefaults } from './recordDefaults.ts';
import type { Ship } from '../types.ts';

const base = { particulars: { lengthOverall: 150, breadthOverall: 17, displacement: 6000, stemToStandard: 60, stemToBridge: 48.25, stemToRas: 70, stemToFueling: 80 } } as Pick<Ship, 'particulars' | 'radarIndex' | 'radarBearing' | 'speedLog' | 'lubberLine' | 'echoSounder'>;
// no earlier record: only the ship's particulars help (the Jackstaff distance); other kinds start empty
assert.deepEqual(recordDefaults('lubberLine', base), { ahead: '48.3' });
assert.deepEqual(recordDefaults('radarIndex', base), {});
assert.deepEqual(recordDefaults('fishtails', base), {});
// an earlier record of the same kind supplies the radar, its scale and the method; the latest by date wins
const ship = { ...base, radarIndex: [
  { id: '1', date: '2026-01-01', description: '', fields: { radar_name: 'Old radar', scale: '3 nm', unit: 'yards', method: 'Two-mark', true: '1' } },
  { id: '2', date: '2026-06-01', description: '', fields: { radar_name: 'Nav radar 1', scale: '6 nm', unit: 'nm', method: 'HSA', ht1: '1' } },
] };
assert.deepEqual(recordDefaults('radarIndex', ship), { radar_name: 'Nav radar 1', scale: '6 nm', unit: 'nm', method: 'HSA' });   // readings are not carried over
// lubber line: the earlier distances win over the particulars
const lub = { ...base, lubberLine: [{ id: '1', date: '2026-02-02', description: '', fields: { repeater: 'Bridge wing, port', method: 'Toe-in angle', side: 'Port', offset: '6', ahead: '30' } }] };
assert.equal(recordDefaults('lubberLine', lub).ahead, '30'); assert.equal(recordDefaults('lubberLine', lub).offset, '6');
// the ship's own repeater data wins over an earlier record, and fills both distances
const own = { ...lub, particulars: { ...base.particulars, repeaterOffset: 5.5, repeaterToJackstaff: 42 } };
assert.equal(recordDefaults('lubberLine', own).offset, '5.5'); assert.equal(recordDefaults('lubberLine', own).ahead, '42');
assert.equal(recordDefaults('lubberLine', { ...base, particulars: { ...base.particulars, repeaterOffset: 5.5, repeaterToJackstaff: 42 } }).ahead, '42');
// a record kept before editing existed has no fields: ignored
assert.deepEqual(recordDefaults('echoSounder', { ...base, echoSounder: [{ id: '1', date: '2026-01-01', description: 'old', value: 'x' }] }), {});
console.log('recordDefaults: all checks passed');
