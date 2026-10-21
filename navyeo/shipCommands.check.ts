// Run: node navyeo/shipCommands.check.ts
import assert from 'node:assert/strict';
import { interpret } from './commands.ts';
import type { Context, Reply } from './commands.ts';

const ctx = (extra: Partial<Context> = {}): Context => ({ tables: [], unit: 'nm', ...extra });
const ask = (text: string, c: Context = ctx()): Extract<Reply, { kind: 'open' }> => {
  const r = interpret(text, c);
  assert.equal(r.kind, 'open', `${text} -> ${JSON.stringify(r)}`);
  return r as Extract<Reply, { kind: 'open' }>;
};

// Anchor: formulae 14.1 and 14.2, forged steel
{
  const r = ask('anchor depth 36 m');
  assert.equal(r.tool, 'Anchor'); assert.match(r.say, /9\.0 shackles, say 9/); assert.deepEqual(r.form?.values, { depth: '36' });
  assert.equal(r.memory?.['pref:anchor:depth'], 'metres');
  const f = ask('how many shackles for 16 fathoms'); assert.match(f.say, /8\.0 shackles/); assert.equal(f.memory?.['pref:anchor:depth'], 'fathoms');
  const b = ask('anchor depth 36 m bronze'); assert.match(b.say, /6\.0 shackles/); assert.equal(b.memory?.['anchor:type'], 'bronze');
  // the height of the tide adds to the depth: 30 + 6 = 36
  assert.match(ask('anchor depth 30 m tide 6').say, /9\.0 shackles/);
  // the circles, from a length: 155 m ship, 9 shackles veered and 10 available: safety = 10 x 27.432 + 155 + 185.2
  const c = ask('anchor depth 36 m length 155 stem 45 10 shackles available');
  assert.match(c.say, /safety circle 0\.33\d nm/); assert.deepEqual(c.form?.values, { depth: '36', len: '155', stem: '45', usable: '10' });
  // the selected ship supplies what is not typed
  const s = ask('anchor depth 36 m', ctx({ shipName: 'INS Test', ship: { length: 142.5, stemToStandard: 48, cableShackles: 11, cableType: 'bronze' } }));
  assert.match(s.say, /aluminium bronze\): 6\.0 shackles/); assert.match(s.say, /142\.5 m \(INS Test\)/); assert.match(s.say, /11 available/);
  assert.match(ask('anchor').say, /Give a depth/);
}

// Flying Corpen
{
  const r = ask('flying corpen wind 090 15 wod 25 ahead');
  assert.equal(r.tool, 'Flying Corpen'); assert.match(r.say, /Flying course 090° at 10 kn: 25 kn over the deck from right ahead/); assert.match(r.say, /Other: 270° at 40 kn/);
  assert.deepEqual(r.form?.values, { wf: '90', ws: '15', wod: '25', wang: '0' });
  const g = ask('helicopter true wind from 045 at 18 knots wod 28 green 10 course 000 speed 12');
  assert.match(g.say, /Flying course/); assert.match(g.say, /Green 10/); assert.match(g.say, /Alter (?:starboard|port) \d+° from 000°/); assert.equal(g.memory?.['fly:wside'], 'Starboard');
  assert.equal(ask('wind over deck 25 red 15 wind 270 20').memory?.['fly:wside'], 'Port');
  assert.match(ask('flying corpen wind 000 5 wod 25 green 40').say, /too light/);
  assert.match(ask('flying corpen wod 25').say, /Add the true wind/); assert.match(ask('flying corpen wind 090 15').say, /Add the wind over deck/);
}

// Battenberg: the BR 45(6) Example 4-1 triangle, 077 degrees
{
  const r = ask('battenberg guide course 030 speed 10 own speed 20 from red 90 4 nm to ahead 1 nm');
  assert.equal(r.tool, 'Battenberg'); assert.match(r.say, /Steer 077° at 20 kn/); assert.match(r.say, /on station in 16m 25s/); assert.match(r.say, /does not allow for the turn/);
  assert.deepEqual(r.form?.values, { gc: '30', gs: '10', ss: '20', a1: '90', d1: '4', a2: '0', d2: '1' }); assert.equal(r.memory?.['batt:side1'], 'Port');
  // with the ship's deceleration figure it says where to slow down
  const s = ask('taking station guide course 030 speed 10 own speed 20 from red 90 4 nm to ahead 1 nm', ctx({ ship: { decelMetresPerKnot: 30 } }));
  assert.match(s.say, /Reduce to the Guide's speed when she bears \d{3}° at/);
  assert.match(ask('battenberg guide course 030 speed 10 own speed 2 from red 90 4 nm to ahead 1 nm').say, /cannot make that track good/);
  assert.match(ask('battenberg').say, /Try "battenberg guide course/);
  assert.match(ask('stationing guide course 090 speed 12 own speed 20').say, /Add the stations/);
}

// Tides: the rule of twelfths, high water 06:00 4.8 m, low water 12:20 0.6 m, at 09:10 half way: 2.70 m
{
  const r = ask('tide hw 0600 4.8 lw 1220 0.6 at 0910');
  assert.equal(r.tool, 'Tides'); assert.match(r.say, /Height of tide at 09:10: 2\.70 m, ebbing/); assert.match(r.say, /rule of twelfths/);
  assert.deepEqual(r.form?.values, { t1: '06:00:00', h1: '4.8', t2: '12:20:00', h2: '0.6', tw: '09:10:00' }); assert.equal(r.memory?.['tide:first'], 'high');
  // low water first, flooding; the half-cosine curve
  const c = ask('tides lw 0200 0.5 hw 0820 4.5 height at 0510 cosine'); assert.match(c.say, /flooding/); assert.match(c.say, /half-cosine/); assert.equal(c.memory?.['tide:first'], 'low');
  assert.match(c.say, /2\.\d\d m/);
  assert.match(ask('tide hw 0600 4.8 lw 1220 0.6 at 1500').say, /outside the two tides/);
  assert.match(ask('tide hw 0600 4.8 lw 1220 0.6').say, /Add "at 0910"/);
  assert.match(ask('tides').say, /Try "tide hw 0600/);
}

// VSA: BR 45 Example 8-1 without the tide correction, 40 m at 0 47.4: 1.57 nm; with the corrected 42.12 m: 1.65 nm
{
  const r = ask('vsa height 42.12 m angle 0 47.4');
  assert.equal(r.tool, 'Distance Off & Horizon'); assert.match(r.say, /Distance off 1\.649 nm/); assert.deepEqual(r.form?.values, { elev: '42.12', angle: '0 47.4' });
  assert.match(ask('vsa height 40 m angle 0 46.2 ie 1.2').say, /Distance off 1\.56\d nm/);
  assert.match(ask('vsa').say, /Try "vsa height/);
}

// Rules and buoyage: opens at the right tab and search
{
  const e = ask('east cardinal buoy'); assert.equal(e.tool, 'Rules & Buoyage'); assert.equal(e.memory?.['ref:tab'], 'buoyage'); assert.equal(e.memory?.['ref:q'], 'east cardinal');
  const t = ask('what are the trawling lights'); assert.equal(t.memory?.['ref:tab'], 'lights'); assert.equal(t.memory?.['ref:q'], 'trawling');
  assert.equal(ask('fog signals').memory?.['ref:tab'], 'sound');
  const o = ask('colregs overtaking'); assert.equal(o.memory?.['ref:tab'], 'rules'); assert.equal(o.memory?.['ref:q'], 'overtaking');
  assert.equal(ask('buoyage').memory?.['ref:tab'], 'buoyage'); assert.equal(ask('safe water mark').memory?.['ref:q'], 'safe water');
}

// the older commands still go where they did
assert.equal(interpret('cpa own course 090 own speed 12 bearing 045 range 6 nm target course 270 speed 8', ctx()).kind, 'open');
assert.equal(ask('distance 12 nm speed 15').tool, 'Time / Speed / Distance');
assert.equal(ask('polaris').tool, 'Polaris Latitude');
console.log('shipCommands: all checks passed');
