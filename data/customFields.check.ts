// Run: node data/customFields.check.ts
import assert from 'node:assert/strict';
import * as c from './customFields.ts';
import type { CustomField } from '../types.ts';

// new fields are distinct, blank, and carry a unit only when they are particulars
const a = c.newField('particulars'), b = c.newField('details');
assert.notEqual(a.id, b.id); assert.equal(c.newField('details').id === c.newField('details').id, false);
assert.deepEqual([a.label, a.value, a.unit, b.unit], ['', '', '', undefined]);

const f = (id: string, group: 'particulars' | 'details', label: string, value: string, unit?: string): CustomField => ({ id, group, label, value, unit });
const ship = { custom: [f('1', 'details', 'Motto', 'Fortune favours'), f('2', 'particulars', 'Mast height', '38.5', 'm'), f('3', 'particulars', '', '7'), f('4', 'details', 'Call sign', 'VWXY')] };

// groups
assert.deepEqual(c.fieldsOf(ship, 'particulars').map(x => x.id), ['2', '3']); assert.deepEqual(c.fieldsOf(ship, 'details').map(x => x.id), ['1', '4']);
assert.deepEqual(c.fieldsOf({}, 'details'), []);
assert.deepEqual(c.shownFields(ship, 'particulars').map(x => x.id), ['2']);                        // no heading, not shown

// replacing one group leaves the other alone
const next = c.withGroup(ship, 'details', [f('9', 'details', 'Only', 'one')]);
assert.deepEqual(next.map(x => x.id), ['2', '3', '9']);
assert.deepEqual(c.withGroup(ship, 'particulars', []).map(x => x.id), ['1', '4']);
assert.deepEqual(c.withGroup({}, 'particulars', [f('x', 'particulars', 'A', '1')]).map(x => x.id), ['x']);

// tidy: rows with neither heading nor value are dropped; text trimmed; empty units removed
assert.deepEqual(c.tidy([f('1', 'particulars', '  Draught aft ', ' 6.1 ', ' m '), f('2', 'details', '  ', ''), f('3', 'particulars', '', '5', ''), f('4', 'details', 'Heading only', '')]).map(x => [x.id, x.label, x.value, x.unit]),
  [['1', 'Draught aft', '6.1', 'm'], ['3', '', '5', undefined], ['4', 'Heading only', '', undefined]]);

// display text
assert.equal(c.formatField(f('1', 'particulars', 'x', '38.5', 'm')), '38.5 m'); assert.equal(c.formatField(f('1', 'particulars', 'x', '', 'm')), ''); assert.equal(c.formatField(f('1', 'details', 'x', 'VWXY')), 'VWXY');

// untrusted input (a backup file) is cleaned
assert.equal(c.sanitizeFields('nope'), undefined); assert.equal(c.sanitizeFields(undefined), undefined);
const clean = c.sanitizeFields([f('1', 'details', 'A', 'b'), { id: 1, group: 'details', label: 'No id', value: 'v' }, { id: '1', group: 'particulars', label: 'Dup id', value: '2', unit: 5 }, { group: 'weird', label: 'x', value: 'y' }, { group: 'details', label: 7, value: 'y' }, null, 'str'])!;
assert.equal(clean.length, 3);
assert.equal(new Set(clean.map(x => x.id)).size, 3);                                                // ids made unique
assert.deepEqual(clean.map(x => x.label), ['A', 'No id', 'Dup id']); assert.equal(clean[2].unit, undefined);
assert.deepEqual(c.sanitizeFields([]), []);

console.log('customFields: all checks passed');
