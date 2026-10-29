// Run: node components/selectFilter.check.ts
import assert from 'node:assert/strict';
import { filterItems } from './selectFilter.ts';

const it = (text: string, group = '') => ({ value: text, text, group, disabled: false });
const ports = [it('Mumbai'), it('Navi Mumbai (JNPT)'), it('Visakhapatnam'), it('Kochi'), it('Chennai', 'East coast')];
const names = (q: string) => filterItems(ports, q).map(i => i.text);
assert.deepEqual(names(''), ports.map(p => p.text));                        // nothing typed: the whole list
assert.deepEqual(names('VIS'), ['Visakhapatnam']);                          // any case
assert.deepEqual(names('mum'), ['Mumbai', 'Navi Mumbai (JNPT)']);
assert.deepEqual(names('jn'), ['Navi Mumbai (JNPT)']);                      // a word inside brackets
assert.deepEqual(names('ai'), ['Mumbai', 'Navi Mumbai (JNPT)', 'Chennai']); // inside a word, in list order
assert.deepEqual(names('east'), ['Chennai']);                               // the group's name counts
assert.deepEqual(names('navi mum'), ['Navi Mumbai (JNPT)']);                // every word must be there
assert.deepEqual(names('x'), []);
console.log('selectFilter: all checks passed');
