import assert from 'node:assert/strict';
import { KINDS, coordKind } from './entryKinds.ts';
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
// the three ways of writing a position: each reads what the others wrote, and gives the parser the same place
{
  const D = coordKind('lat', 'd'), DMS = coordKind('lat', 'dms'), DM = coordKind('lat', 'dm'), LD = coordKind('lon', 'd');
  assert.equal(D.out(['12', '50833'], 0), '12.50833 N');
  assert.ok(Math.abs(parseCoord(D.out(['12', '50833'], 1), 'lat')! + 12.50833) < 1e-9);
  assert.equal(DMS.out(['12', '30', '30'], 0), '12 30 30 N');
  assert.equal(parseCoord(DMS.out(['12', '30', '30'], 0), 'lat'), 12 + 30 / 60 + 30 / 3600);
  assert.deepEqual(DMS.parse('12 30.5 N'), { n: ['12', '30', '30'], t: 0 });        // from degrees and minutes
  assert.deepEqual(DMS.parse('12.508333 S'), { n: ['12', '30', '30'], t: 1 });      // from decimal degrees
  assert.deepEqual(D.parse('12 30 30 N'), { n: ['12', '50833'], t: 0 });           // from seconds
  assert.deepEqual(D.parse('12.5'), { n: ['12', '5'], t: 0 });                     // as typed
  assert.deepEqual(DM.parse('12.5 N'), { n: ['12', '30', ''], t: 0 });
  assert.deepEqual(LD.parse('-72.75'), { n: ['72', '75'], t: 1 });                 // a minus sign is west
  assert.deepEqual(DMS.parse('0.99999 N'), { n: ['1', '0', '0'], t: 0 });         // rounding carries up
  assert.equal(D.out(['', ''], 0), '');
}
console.log('entry ok');
