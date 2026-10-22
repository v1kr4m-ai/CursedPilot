// Run: node tools/calMethods.check.ts
import assert from 'node:assert/strict';
import { CAL_METHODS } from './calMethods.ts';

assert.deepEqual(CAL_METHODS.map(t => t.id), ['radar', 'log', 'lubber', 'swing', 'echo']);
for (const t of CAL_METHODS) { assert.ok(t.cards.length > 0, t.id); for (const c of t.cards) assert.ok(c.title && c.source && c.points.length > 0 && c.points.every(p => p.trim().length > 3), `${t.id}: ${c.title}`); }
// every Handbook chapter 8 paragraph from 1 to 31 is there, once, in order, plus the BR 45 paragraphs
const hb = CAL_METHODS.flatMap(t => t.cards).filter(c => c.source.startsWith('Handbook')).map(c => Number(/para (\d+)/.exec(c.source)![1]));
assert.deepEqual(hb, Array.from({ length: 31 }, (_, i) => i + 1));
const sources = CAL_METHODS.flatMap(t => t.cards.map(c => c.source)).join(' | ');
for (const k of ['1521a', '1521e', '1521f', '1521h', '1521i', '1522b', '0427']) assert.match(sources, new RegExp(k), k);
const text = JSON.stringify(CAL_METHODS);
// the methods and the figures that matter are in the books' own words
for (const k of ['Danbuoy Method', 'The Measured Mile Run', 'DGPS/ GPS Method', 'Two-Mark Method', 'Three-Ship Method', 'FLINDERS BAR', 'Weir', 'By Reciprocal Bearing', 'Bar Check', 'toe-in', 'Four Run Formula', 'Report every 05 meters']) assert.match(text, new RegExp(k, 'i'), k);
assert.match(text, /less than 30\u00b0/); assert.match(text, /3 Nm apart/); assert.match(text, /multiples of 6 kn/);
// no broken characters or stray footnote numbers left in the text
assert.ok(!/[\ufffd\u0008]/.test(text)); assert.ok(!/haIf|Iubber|\blf\b/.test(text));
console.log('calMethods: all checks passed');
