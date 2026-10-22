// Run: node tools/calMethods.check.ts
import assert from 'node:assert/strict';
import { CAL_METHODS } from './calMethods.ts';

assert.deepEqual(CAL_METHODS.map(t => t.id), ['radar', 'log', 'lubber', 'swing', 'echo']);
for (const t of CAL_METHODS) { assert.ok(t.cards.length > 0, t.id); for (const c of t.cards) assert.ok(c.title && c.points.length > 0 && c.points.every(p => p.length > 20), `${t.id}: ${c.title}`); }
const titles = CAL_METHODS.flatMap(t => t.cards.map(c => c.title)).join(' | ');
for (const k of ['Danbuoy', 'Measured mile', 'DGPS / GPS', 'Two-mark', 'Three-mark', 'Two-ship', 'Three-ship', 'HSA']) assert.match(titles, new RegExp(k, 'i'), k);
const text = JSON.stringify(CAL_METHODS);
for (const k of ['Bar check', 'Dry dock', 'Hand lead line', 'transits', 'Weir', 'reciprocal bearing', 'Flinders', 'toe-in']) assert.match(text, new RegExp(k, 'i'), k);
console.log('calMethods: all checks passed');
