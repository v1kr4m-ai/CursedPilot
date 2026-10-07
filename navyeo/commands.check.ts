// Run: node navyeo/commands.check.ts
import assert from 'node:assert/strict';
import * as c from './commands.ts';

// two tables: 15 kn 20 wheel starboard (turn, advance, transfer, time) and 12 kn 15 wheel starboard
const rows = (k: number): c.TurnRow[] => [0, 60, 90, 180].map(t => ({ turn: t, advance: t === 0 ? 0 : 200 * k + t, transfer: t * k, time: t * 2 }));
const ctx: c.Context = { shipName: 'INS Test', unit: 'yards', tables: [
  { speed: 15, wheel: 20, side: 'Starboard', rows: rows(2) },
  { speed: 12, wheel: 15, side: 'Starboard', rows: rows(1) },
  { speed: 12, wheel: 15, side: 'Port', rows: rows(1) },
] };
const say = (t: string, x: c.Context = ctx) => { const r = c.interpret(t, x); assert.equal(r.kind, 'say', `${t} -> ${JSON.stringify(r)}`); return (r as { say: string }).say; };
const open = (t: string, x: c.Context = ctx) => { const r = c.interpret(t, x); assert.equal(r.kind, 'open', `${t} -> ${JSON.stringify(r)}`); return r as Extract<c.Reply, { kind: 'open' }>; };

// reciprocal
assert.equal(say('reciprocal of 075'), 'Reciprocal of 075 is 255.'); assert.equal(say('what is the reciprocal of 200?'), 'Reciprocal of 200 is 020.');

// interpolation of the table
assert.deepEqual(c.lookupTurn(rows(1), 90), { turn: 90, advance: 290, transfer: 90, time: 180 });
const mid = c.lookupTurn(rows(1), 75)!; assert.equal(mid.transfer, 75); assert.equal(c.lookupTurn(rows(1), 200), null);

// answers from the ship's data, in yards here
assert.match(say('tactical diameter at 15 kn 20 wheel'), /Tactical diameter.*15 kn, 20° wheel, starboard: 360 yd/);
assert.match(say('advance at 12 kn 15 wheel 90 turn'), /advance 290 yd/);
assert.match(say('what is the transfer at 12 kn 15 wheel for a 90 degree turn port'), /transfer 90 yd/);
assert.match(say('wheel over for 90 degrees at 15 kn 20 wheel'), /Wheel over 490 yd/);                          // advance - transfer/tan(90) = advance
assert.match(say('wheel over for 60 degrees at 12 kn 15 wheel'), /Wheel over .* yd before the turning point for a 60° alteration/);
// missing pieces are asked for, not guessed
assert.match(say('advance for a 90 turn'), /At what speed\? Recorded: 12, 15 kn/);
assert.match(say('advance 90 turn at 12 kn'), /advance|wheel/i);                                              // one wheel at 12 kn: used
assert.match(say('transfer at 99 kn'), /No turning data at 99 kn/);
assert.match(say('advance at 15 kn 20 wheel 300 turn'), /outside what is recorded/);
assert.match(say('tactical diameter at 15 kn 20 wheel', { ...ctx, tables: [] }), /need turning data/);
assert.match(say('advance at 15 kn 25 wheel 90 turn'), /No turning data at 15 kn with 25° wheel/);
assert.match(say('advance at 15 kn 20 wheel port 90 turn'), /No port turning data/);

// CPA
let r = open('cpa own course 090 own speed 12 bearing 045 range 6 nm target course 270 speed 8');
assert.equal(r.tool, 'CPA / TCPA'); assert.deepEqual(r.form, { id: 'cpa', values: { oc: '90', os: '12', rng: '6', brg: '45', tc: '270', ts: '8' } });
assert.deepEqual(r.memory, { 'pref:cpa:unit': 'nm' });
r = open('cpa'); assert.equal(r.form, undefined);
r = open('cpa contact bearing 120 range 3 cables'); assert.deepEqual(r.form!.values, { brg: '120', rng: '3' }); assert.deepEqual(r.memory, { 'pref:cpa:unit': 'cables' });

// ATB
r = open('atb bearing 045 green 30'); assert.deepEqual(r.form, { id: 'atb', values: { brg: '45', angle: '30' } }); assert.deepEqual(r.memory, { 'atb:mode': 'course', 'atb:side': 'Starboard' });
r = open('angle on the bow bearing 200 angle 40 port'); assert.deepEqual(r.memory, { 'atb:mode': 'course', 'atb:side': 'Port' }); assert.equal((r.form!.values as Record<string, string>).angle, '40');
r = open('atb bearing 100 course 270'); assert.deepEqual(r.form!.values, { brg: '100', course: '270' }); assert.deepEqual(r.memory, { 'atb:mode': 'angle' });

// time speed distance
r = open('distance 12 nm speed 15'); assert.equal(r.tool, 'Time / Speed / Distance'); assert.deepEqual(r.form, { id: 'tsd', values: { d: '12', s: '15' } }); assert.deepEqual(r.memory, { 'pref:tsd:unit': 'nm' });
r = open('tsd distance 5 cables in 30 minutes'); assert.deepEqual(r.form!.values, { d: '5', t: '30' });
r = open('speed 12 kn for 2 hours'); assert.deepEqual(r.form!.values, { s: '12', t: '120' });

// just open a tool
assert.equal(open('williamson').tool, 'Man Overboard Turn'); assert.equal(open('open hsa').tool, 'Horizontal Sextant Angle (HSA)');
assert.equal(open('compass').tool, 'Compass Conversion'); assert.equal(open('convert units').tool, 'Unit Converter'); assert.equal(open('wheel over').tool, 'Wheel-over Point');
assert.equal(open('course to steer').tool, 'Course to Steer');

// spoken digits
assert.equal(c.normaliseSpoken('Reciprocal of zero seven five'), 'reciprocal of 075'); assert.equal(c.normaliseSpoken('speed twelve point five knots'), 'speed twelve point 5 knots');   // spelt-out tens are left alone
assert.equal(c.normaliseSpoken('speed 12 point 5 knots'), 'speed 12.5 knots'); assert.equal(c.normaliseSpoken('bearing zero four five range six'), 'bearing 045 range 6');
assert.equal(c.normaliseSpoken('range one cable'), 'range 1 cable'); assert.equal(c.normaliseSpoken('Wheel over'), 'wheel over');
assert.equal(say('reciprocal of two seven zero'), 'Reciprocal of 270 is 090.');
r = open('cpa own course zero nine zero own speed one two bearing zero four five range six nm'); assert.deepEqual(r.form!.values, { oc: '90', os: '12', rng: '6', brg: '45' });

// nonsense: says so
assert.match(say('what is the meaning of life'), /did not understand/); assert.match(say('   '), /Type a request/);

// every tool name it can open exists in the registry
import { readFileSync } from 'node:fs';
const registry = readFileSync(new URL('../tools/NavTools.tsx', import.meta.url), 'utf8');
const src = readFileSync(new URL('./commands.ts', import.meta.url), 'utf8');
for (const m of src.matchAll(/(?:\], |tool: )'([A-Z][^']+)'/g)) assert.ok(registry.includes(`name: '${m[1]}'`), `unknown tool "${m[1]}"`);

console.log('commands: all checks passed');
