// Run: node navyeo/calcCommands.check.ts
import assert from 'node:assert/strict';
import { interpret, interpretWithPending } from './commands.ts';
import type { Context, Reply } from './commands.ts';
import type { Ship } from '../types.ts';

const ctx = (extra: Partial<Context> = {}): Context => ({ tables: [], unit: 'nm', ...extra });
const say = (text: string, c: Context = ctx()): Reply & { say: string } => interpret(text, c) as Reply & { say: string };
const open = (text: string, c: Context = ctx()) => { const r = interpret(text, c); assert.equal(r.kind, 'open', `${text} -> ${JSON.stringify(r)}`); return r as Extract<Reply, { kind: 'open' }>; };

// CPA: head-on, both 10 kn, 10 nm apart: they close at 20 kn, CPA 0, in 30 minutes
{
  const r = open('cpa own course 000 own speed 10 bearing 000 range 10 nm target course 180 speed 10');
  assert.equal(r.tool, 'CPA / TCPA'); assert.match(r.say, /CPA 0\.00 nm/); assert.match(r.say, /in 30 min/); assert.match(r.say, /relative speed 20 kn on 180°/); assert.match(r.say, /collision course/); assert.match(r.say, /close-quarters/);
  assert.deepEqual(r.form?.values, { oc: '0', os: '10', brg: '0', rng: '10', tc: '180', ts: '10' });
  // crossing: own 000 at 10, target 6 nm on the starboard beam (090) steering 270 at 10: relative velocity (-10,-10) from (6,0): closest when t = 0.3 h, CPA 6 / sqrt 2 = 4.24 nm
  const c = open('cpa my course 000 my speed 10 bearing 090 range 6 nm target course 270 target speed 10');
  assert.match(c.say, /CPA 4\.24 nm/); assert.match(c.say, /in 18 min/);
  // a ship going away: no closest point ahead
  assert.match(say('cpa own course 000 own speed 10 bearing 000 range 5 nm target course 000 speed 15').say, /opening/);
  // missing values are asked for, in a way the next reply can complete
  const m = interpret('cpa own course 090 own speed 12 bearing 045', ctx());
  assert.equal(m.kind, 'open'); assert.ok((m as { wait?: boolean }).wait); assert.match((m as { say: string }).say, /range, target course, target speed/);
}

// angle on the bow: bearing 045, target steering 270: we are on its port bow, 45 degrees (0-45+180-270 = -45)
{
  const r = open('atb bearing 045 target course 270'); assert.match(r.say, /45° red \(port\)/);
  const t = open('atb bearing 045 green 30'); assert.match(t.say, /Target course 195°/);                 // 045 + 180 - 30 = 195
}

// time, speed, distance
{
  assert.match(open('distance 12 nm speed 15').say, /Time 48 min/);
  assert.match(open('speed 12 kn for 90 min').say, /Distance 18\.00 nm/);
  assert.match(open('10 nm in 40 minutes').say, /Speed 15 kn/);
  assert.match(open('how long for 25 nm at 10 knots').say, /Time 2 h 30 min/);
}

// course to steer: track 000, 10 kn, current setting 090 at 2 kn: sin(a) = -0.2, so 11.54 degrees to port: 348.5; SOG 10 cos(11.54) = 9.80
{
  const r = open('course to steer track 000 speed 10 set 090 drift 2'); assert.match(r.say, /Steer 348°/); assert.match(r.say, /11\.5° to port/); assert.match(r.say, /9\.8 kn/);
  assert.match(say('course to steer track 000 speed 10 set 090').say, /the drift/);
  assert.match(say('course to steer track 000 speed 2 set 090 drift 5').say, /too strong/);
}

// compass and gyro: 045 compass, deviation 2 E, variation 3 W: 045 + 2 - 3 = 044
{
  assert.match(open('compass 045 dev 2 E var 3 W').say, /True 044°/);
  assert.match(open('true 090 var 3 W dev 2 E to compass').say, /Steer 091° by compass/);             // 090 - (-3) - 2 = 091
  assert.match(open('gyro 045 error 2 west').say, /True 043°/);
  assert.match(say('compass 045 var 3 W').say, /deviation/);
}

// regain track: off 2 cables, throw-off 10: run 2 x 60 / 10 = 12 cables; to regain in 20 min at 12 kn: 40 cables run, 3 x 60 / 40 = 4.5
{
  const r = open('off track 2 cables throw-off 10 speed 12'); assert.match(r.say, /after 12 cables/); assert.match(r.say, /At 12 kn that is 6 min/);
  assert.match(open('off track 3 cables regain in 20 minutes at 12 knots').say, /throw off 4\.5°/);
}

// Corpen with the figures typed: 12 kn, 5 cables astern (a stopwatch of 150 s), 90 degrees, advance 200, transfer 200, 60 s: along = 200 + 1000 - 400 = 800, across 200: 14.0 degrees, so the Guide bears 76 off the bow
{
  const r = open('corpen astern 5 cables speed 12 turn 90 to starboard advance 200 transfer 200 time 60'); assert.match(r.say, /bears 76° off your bow/); assert.match(r.say, /stopwatch 2 min 30 s/);
  assert.equal(r.form?.values.an, '90');
  // another angle, from the ship's own turning data
  const ship = { turningDataSets: [{ testSpeed: 12, wheelAngle: 20, turnSide: 'Starboard', data: [
    { id: 'a', turnAmount: 45, bearingMob: 0, angle: 0, rangeCables: 0, rangeYards: 0, advance: 500, transfer: 150, distToNewCourse: 0, time: '0:30', speed: 11 },
    { id: 'b', turnAmount: 90, bearingMob: 0, angle: 0, rangeCables: 0, rangeYards: 0, advance: 600, transfer: 380, distToNewCourse: 0, time: '1:00', speed: 9.5 },
  ] }] } as unknown as Pick<Ship, 'turningDataSets'>;
  const s = open('corpen astern 5 cables speed 12 turn 60', ctx({ shipName: 'INS Test', turning: ship }));
  assert.match(s.say, /INS Test's turning data/); assert.match(s.say, /off your bow on the starboard side/); assert.deepEqual([s.form?.values.adv, s.form?.values.tr, s.form?.values.tt], ['533.3', '226.7', '40']);
  assert.match(say('corpen astern 5 cables speed 12 turn 60').say, /no turning data/);
  assert.equal(interpret('corpen', ctx()).kind, 'open');                                           // no numbers: the tool is just opened
  assert.equal(interpret('regain track', ctx()).kind, 'open'); assert.equal(interpret('fuel', ctx()).kind, 'open');
}

// fuel, from the ship's fuel table: 14 kn = 1.0 t/h between rows at 12 (0.6) and 16 (1.4)? 12:0.6, 16:1.4 -> 14: 1.0
{
  const fuel = { regimes: [{ id: 'r1', name: 'Cruise', rows: [{ rpm: '', speed: '12', rate: '0.6' }, { rpm: '', speed: '16', rate: '1.4' }] }] };
  const c = ctx({ shipName: 'INS Test', fuel });
  assert.match(open('fuel for 280 nm at 14 knots', c).say, /1 t\/h at 14 kn[\s\S]*20 h 00 min and 20 t/);
  assert.match(open('how far on 30 tonnes at 14 knots', c).say, /30 t lasts 30 h 00 min and takes her 420 nm/);
  assert.match(say('fuel 30 tonnes', c).say, /At what speed/);
  assert.match(say('fuel for 100 nm at 14 knots').say, /no fuel data/);
}

// units and horizons
{
  assert.match(say('convert 5 nm to metres').say, /5 nautical miles = 9260 metres/);
  assert.match(say('12 knots in m/s').say, /6\.173 metre\/second/);
  assert.match(say('10 m to kn').say, /not the same kind/);
  assert.match(open('horizon eye 16 m').say, /visual 8\.3 nm/);                                      // 2.08 x sqrt 16
  assert.match(open('visible range eye 16 m target 25 m').say, /18\.7 nm/);                          // 2.08 x (4 + 5)
}

// radian rule: L = (R x angle) / 60, a mile of 2000 yards and a cable of 200: any one from the other two
{
  // the question put to NavYeo: "1 degree at 1 nm is?" gives 33 yards (2000 / 60)
  const y = open('1 degree at 1 nm is?'); assert.equal(y.tool, 'Radian Rule'); assert.match(y.say, /1° at 1 nm is 33\.3 yd across \(30\.5 m\)/); assert.deepEqual(y.form?.values, { range: '1', ang: '1' });
  assert.match(open('what is 2 degrees at 3 cables').say, /2° at 3 cables is 20\.0 yd|2° at 3 cables is 20 yd/);              // 3 cables = 600 yd; 600 x 2 / 60 = 20
  assert.match(open('1 degree at 5 cables').say, /1° at 5 cables is 16\.7 yd/);                                                // 1000 / 60
  assert.match(open('one degree at one nautical mile').say, /33\.3 yd/);                                                       // as it is spoken
  assert.match(open('1° at 1 nm').say, /radian rule: L = R × angle \/ 60/);
  assert.match(open('1 degree at 10 nm').say, /333 yd/);
  // the other two ways round
  assert.match(open('what angle does 100 yards subtend at 2 nm').say, /Angle 1\.50° \(1° 30\.0′\)/);                         // 100 yd at 4000 yd: 60 x 100 / 4000
  assert.match(open('33 yards subtends 1 degree: range').say, /at a range of 0\.99 nm/);                                      // 33 x 60 = 1980 yd
  const r = open('radian rule length 100 m angle 1 degree'); assert.equal(r.tool, 'Radian Rule'); assert.match(r.say, /subtends 1° at a range of 3\.28 nm \(32\.8 cables\)/); assert.match(r.say, /angle \/ 60/);
  assert.deepEqual(r.form?.values, { dist: '100', ang: '1' });
  const a = open('radian rule length 200 m range 6000 m'); assert.match(a.say, /Angle 2\.00° \(2° 0\.0′\)/);
  const b = open('radian rule range 1000 m angle 2 degrees'); assert.match(b.say, /2° at 1000 m is 33\.3 m across/);
  const c = open('what angle is subtended by 100 m at 5 cables'); assert.match(c.say, /Angle 6\.56°/);                       // 5 cables = 914.4 m: 60 x 100 / 914.4
  assert.deepEqual([c.memory?.['pref:radian:dist'], c.memory?.['pref:radian:range']], ['metres', 'cables']);
  assert.match(open('radian rule l = 50 yards r = 3000 yards').say, /Angle 1\.00°/);
  assert.match(open('radian rule range 2 nm angle 1.5 degrees').say, /1\.5° at 2 nm is 100 yd across/);
  // an angle of 30 minutes of arc at a range of 2 nm is 0.5 degree: 33.3 yd
  assert.match(open('30 minutes of arc at 2 nm').say, /0\.5° at 2 nm is 33\.3 yd/);
  assert.match(open('1 degree 30 minutes at 1 nm').say, /1\.5° at 1 nm is 50\.0 yd/);
  assert.match(say('radian rule length 100 m').say, /needs two of the three/); assert.ok((say('radian rule length 100 m') as { wait?: boolean }).wait);
  assert.match(say('radian rule length 100 m range 5 cables angle 2 degrees').say, /All three are given/);
  assert.equal(interpret('radian rule', ctx()).kind, 'open');                                                                 // no numbers: just the tool
  // other requests that have a degree and a distance are left alone
  for (const q of ['turn 90 degrees at 5 cables', 'anchor depth 30 m tide 2 at 5 cables 3 degrees', 'bearing 045 degrees at 6 nm', 'course 090 at 12 knots']) assert.ok(!/Radian|1 in 60|across/.test((interpret(q, ctx()) as { say: string }).say), q);
  // two goes: the missing value in the next reply, also as spoken
  const first = interpretWithPending('radian rule length 100 m', null, ctx()); assert.ok(first.pending);
  assert.match((interpretWithPending('angle 1 degree', first.pending, ctx()).reply as { say: string }).say, /at a range of 3\.28 nm/);
  assert.match(open('radian rule length one zero zero metres angle one degree').say, /at a range of 3\.28 nm/);
}

// positions: along 60N from 000 to 010E the rhumb line is 300 nm on 090; one position converts; a start with course and distance gives the end
{
  const r = open('distance and bearing from 60 00 n 000 00 e to 60 00 n 010 00 e');
  assert.equal(r.tool, 'Bearings & Positions'); assert.match(r.say, /Rhumb line \(Mercator sailing\) 300\.0 nm on a constant course 090°/); assert.match(r.say, /Great circle 29\d\.\d nm, initial course 08\d°, final 09\d°/);
  assert.equal(r.memory?.['bpu:tab'], 'dist'); assert.deepEqual(r.form?.values, { alat: '60', alon: '0', blat: '60', blon: '10' });
  assert.match(open('distance from 60 00 n 000 00 e to 60 00 n 010 00 e at 10 knots').say, /Rhumb line \(Mercator sailing\) 300\.0 nm \(30 h 00 min at 10 kn\)/);
  const c = open('convert 51 28.5 n 001 12 w to decimal'); assert.match(c.say, /51\.47500° N/); assert.match(c.say, /1\.20000° W/); assert.match(c.say, /001° 12\.000' W/); assert.equal(c.memory?.['bpu:tab'], 'latlong');
  assert.deepEqual(open('convert 12 30 s').form?.values, { lat: '-12.5' });
  const f = open('from 00 00 n 000 00 e course 000 distance 600 nm'); assert.match(f.say, /10° 00\.000' N, 000° 00\.000' E/); assert.equal(f.memory?.['pos:mode'], 'from');
  assert.match(open('from 60 00 n 000 00 e course 090 distance 300 nm').say, /010° 00\.000' E/);
  assert.match(open('from 00 00 n 000 00 e course 000 distance 600 nm great circle').say, /^Great circle/);
  assert.match(say('distance between 60 00 n 000 00 e and 60 00 n 000 00 e').say, /same/);
  assert.equal(interpret('rhumb line', ctx()).kind, 'open');                                                // no numbers: the tool opens (on its distance tab)
  assert.equal((interpret('rhumb line', ctx()) as Extract<Reply, { kind: 'open' }>).memory?.['bpu:tab'], 'dist');
  assert.equal(interpret('range 6 n miles', ctx()).kind, 'say');                                           // "6 n miles" is not a latitude
}

// an unfinished request is completed by the next short reply, and a new request replaces it
{
  const a = interpretWithPending('cpa own course 000 own speed 10 bearing 000 range 10 nm', null, ctx());
  assert.equal(a.reply.kind, 'open'); assert.ok(a.pending);
  const b = interpretWithPending('target course 180 speed 10', a.pending, ctx());
  assert.equal(b.reply.kind, 'open'); assert.match((b.reply as { say: string }).say, /CPA 0\.00 nm/); assert.equal(b.pending, null);
  // answer in two goes
  const c = interpretWithPending('course to steer track 000 speed 10', null, ctx()); assert.ok(c.pending);
  const d = interpretWithPending('set 090 drift 2', c.pending, ctx()); assert.match((d.reply as { say: string }).say, /Steer 348°/);
  // a different, understood request is not mixed with the old one
  const e = interpretWithPending('distance 12 nm speed 15', c.pending, ctx()); assert.match((e.reply as { say: string }).say, /Time 48 min/); assert.equal(e.pending, null);
  // nothing understood and nothing pending: the usual help
  assert.ok((interpretWithPending('blah', null, ctx()).reply as { unknown?: boolean }).unknown);
}
console.log('calcCommands: all checks passed');

// Battenberg, joining from ahead and station changes are one tool with three tabs
{
  const tabs: [string, string][] = [['battenberg', 'batt'], ['taking station', 'batt'], ['station from bows', 'bows'], ['joining from ahead', 'bows'], ['round the clock', 'changes'], ['reversing the order', 'changes']];
  for (const [q, tab] of tabs) { const r = interpret(q, ctx()) as Extract<Reply, { kind: 'open' }>; assert.equal(r.kind, 'open', q); assert.equal(r.tool, 'Battenberg & Stationing', q); assert.equal(r.memory?.['stn:tab'], tab, q); }
}
console.log('stationing tabs: ok');
