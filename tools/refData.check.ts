// Run: node tools/refData.check.ts
import assert from 'node:assert/strict';
import * as r from './refData.ts';

// the buoyage: every mark has what a navigator needs, the ids are distinct, and the four cardinals are there with their topmarks
assert.equal(new Set(r.BUOYS.map(b => b.id)).size, r.BUOYS.length);
for (const b of r.BUOYS) { assert.ok(b.name && b.colour && b.light && b.meaning && b.topmarkText, b.id); assert.ok(b.paint.kind === 'bands' ? b.paint.bands.length > 0 && Math.abs(b.paint.bands.reduce((a, x) => a + x[1], 0) - 1) < 1e-9 : b.paint.colours.length === 2, `${b.id} paint`); }
const by = (id: string) => r.BUOYS.find(b => b.id === id)!;
assert.deepEqual(['north', 'east', 'south', 'west'].map(id => by(id).topmark), ['two-cones-up', 'two-cones-base', 'two-cones-down', 'two-cones-point']);
assert.match(by('east').light, /VQ\(3\) every 5 s/); assert.match(by('south').light, /VQ\(6\) \+ LFl every 10 s/); assert.match(by('west').light, /VQ\(9\) every 10 s/);
assert.equal(by('port').colour, 'Red'); assert.equal(by('stbd').colour, 'Green'); assert.equal(by('port').topmark, 'can'); assert.equal(by('stbd').topmark, 'cone-up');
assert.equal(by('isolated').topmark, 'two-spheres'); assert.equal(by('safe').topmark, 'sphere'); assert.equal(by('special').topmark, 'x');
assert.ok(r.BUOYAGE_NOTES.some(n => /Region A/.test(n) && /RED marks to PORT/.test(n)));
// the lights: the arcs and the distances the Rules give
assert.ok(r.LIGHT_TYPES.find(l => l.title === 'Masthead light')!.lines[0].includes('225'));
assert.ok(r.LIGHT_TYPES.find(l => l.title === 'Sidelights')!.lines[0].includes('112.5'));
assert.ok(r.LIGHT_TYPES.find(l => l.title === 'Sternlight')!.lines[0].includes('135'));
assert.deepEqual(r.VISIBILITY.map(v => v.masthead.split(' ')[0]), ['6', '5', '2']); assert.deepEqual(r.VISIBILITY.map(v => v.side.split(' ')[0]), ['3', '2', '1']);
// each kind of vessel the Rules light is covered
for (const k of ['Power-driven', 'Sailing', 'Towing', 'Trawling', 'Not under command', 'Restricted in ability', 'Constrained', 'Pilot', 'At anchor', 'Aground']) assert.ok(r.VESSEL_LIGHTS.some(v => v.title.includes(k)), k);
assert.ok(r.VESSEL_LIGHTS.find(v => v.title.startsWith('Trawling'))!.lines[0].includes('green over white'));
assert.ok(r.VESSEL_LIGHTS.find(v => v.title.startsWith('Restricted in ability'))!.lines[0].includes('red, white, red'));
// sound signals
assert.ok(r.SOUND_MANOEUVRING.find(s => s.title === 'One short blast')!.lines[0].includes('starboard'));
assert.ok(r.SOUND_MANOEUVRING.find(s => s.title === 'Two short blasts')!.lines[0].includes('port'));
assert.ok(r.SOUND_FOG.find(s => s.title.startsWith('Power-driven vessel making way'))!.lines[0].includes('2 minutes'));
assert.ok(r.SOUND_FOG.find(s => s.title === 'At anchor')!.lines[0].includes('1 minute'));
// the rules, in the order of their numbers, and every row has text
for (const rows of [r.SHAPES, r.SOUND_FOG, r.SOUND_MANOEUVRING, r.VESSEL_LIGHTS, r.LIGHT_TYPES]) for (const row of rows) assert.ok(row.title.trim() && row.lines.length && row.lines.every(l => l.trim().length > 5), row.title);
for (const row of [...r.VESSEL_LIGHTS, ...r.SOUND_FOG, ...r.SOUND_MANOEUVRING, ...r.LIGHT_TYPES, ...r.SHAPES]) assert.ok(row.rule !== undefined, `${row.title} has no rule`);
assert.ok(r.VESSEL_LIGHTS.filter(v => v.pic).length >= 12);
console.log('refData: all checks passed');
