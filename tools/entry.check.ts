import assert from 'node:assert/strict';
import { KINDS } from './entryKinds.ts';
import { parseCoord, parseAngle } from './navMath.ts';
import { parseClock, parseStopwatch, parseZone, parseWatchError } from './sunSights.ts';

const k = KINDS;
// boxes -> text -> the parser the tools use
assert.equal(k.lat.out(['15', '20', '5'], 0), '15 20.5 N');
assert.equal(parseCoord(k.lat.out(['15', '20', '5'], 1), 'lat'), -(15 + 20.5 / 60));
assert.equal(parseCoord(k.lon.out(['078', '35', ''], 0), 'lon'), 78 + 35 / 60);
assert.equal(parseCoord(k.lon.out(['1', '', ''], 1), 'lon'), -1);
assert.equal(k.lat.out(['', '', ''], 1), '');
assert.equal(parseAngle(k.angle.out(['46', '12', '5'], 0)), 46 + 12.5 / 60);
assert.equal(parseClock(k.time.out(['9', '5', ''], 0)), 9 * 3600 + 5 * 60);
assert.equal(parseClock(k.time.out(['05', '42', '10'], 0)), 5 * 3600 + 42 * 60 + 10);
assert.equal(parseStopwatch(k.stopwatch.out(['0', '40'], 0)), 40);
assert.equal(parseZone(k.zone.out(['5', '30'], 0)), 5.5);
assert.equal(parseZone(k.zone.out(['3', '0'], 1)), -3);
assert.equal(parseWatchError(k.watch.out(['12'], 0)), 12);
assert.equal(parseWatchError(k.watch.out(['5'], 1)), -5);
// text -> boxes (remembered values and old typed forms still show)
assert.deepEqual(k.lat.parse('15 20 N'), { n: ['15', '20', ''], t: 0 });
assert.deepEqual(k.lon.parse("78°35.25'W"), { n: ['78', '35', '25'], t: 1 });
assert.deepEqual(k.time.parse('054210').n, ['05', '42', '10']);
assert.deepEqual(k.zone.parse('-3:30'), { n: ['3', '30'], t: 1 });
assert.deepEqual(k.watch.parse('5 fast'), { n: ['5'], t: 1 });
for (const [kind, s] of [['lat', '15 20.5 N'], ['lon', '78 35.25 W'], ['time', '05:42:10'], ['zone', '+5:30']] as const) assert.equal(k[kind].out(k[kind].parse(s).n, k[kind].parse(s).t), s);
console.log('entry ok');
