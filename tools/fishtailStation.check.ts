// Run: node tools/fishtailStation.check.ts
import assert from 'node:assert/strict';
import { fishtailAdvice, fishtailSummary, nearestStation } from './fishtailStation.ts';

const adv = (offFrom: number, offTo: number, rF = 1, rT = 1) => fishtailAdvice({ offFrom, offTo, rangeFromNm: rF, rangeToNm: rT });

// stations by angle off the bow
assert.equal(nearestStation(0), 'Ahead'); assert.equal(nearestStation(40), 'Bow (45)'); assert.equal(nearestStation(-95), 'Abeam'); assert.equal(nearestStation(130), 'Quarter'); assert.equal(nearestStation(175), 'Astern');

// from ahead to the bow, beam, quarter, astern: a fishtail; the book's solution where para 0429 has one
{
  const a = adv(0, 180)!; assert.equal(a.from, 'Ahead'); assert.equal(a.to, 'Astern'); assert.equal(a.solution?.para, '0429a'); assert.match(a.solution!.text[0], /90 degree fishtail/);
  assert.equal(adv(0, 90)!.solution?.para, '0429b'); assert.equal(adv(0, -90)!.solution?.para, '0429b');         // port or starboard
  const b = adv(0, 45)!; assert.equal(b.to, 'Bow (45)'); assert.equal(b.solution, null); assert.ok(b.nearby.length > 0);   // not in the book: the nearest changes are given
  assert.ok(b.nearby.every(n => n.from === 'Ahead' || n.to === 'Bow (45)'));
  assert.equal(adv(0, 135)!.solution, null); assert.ok(adv(0, 135)!.nearby.length > 0);
}
// from the beam to the quarter or astern
{
  const a = adv(90, 180)!; assert.equal(a.solution?.para, '0429e'); assert.equal(a.solution?.warning, true);
  const q = adv(-90, -135)!; assert.equal(q.from, 'Abeam'); assert.equal(q.to, 'Quarter'); assert.equal(q.solution, null); assert.ok(q.nearby.length > 0);
  assert.equal(adv(45, 90)!.solution?.para, '0429c'); assert.equal(adv(45, 135)!.solution?.para, '0429d');
}
// from one beam to the other
{ const a = adv(90, -90)!; assert.equal(a.opposite, true); assert.equal(a.solution?.para, '0429h'); assert.equal(adv(90, 90.5), null); }
// to a station further ahead, or the same one, or a small change of bearing: no fishtail
assert.equal(adv(180, 0), null); assert.equal(adv(90, 0), null); assert.equal(adv(135, 90), null); assert.equal(adv(90, 100), null); assert.equal(adv(10, 25), null); assert.equal(adv(60, 45), null);
// small ranges
assert.equal(adv(0, 90, 0.5, 0.3)!.small, true); assert.equal(adv(0, 90, 4, 3)!.small, false); assert.equal(fishtailAdvice({ offFrom: 0, offTo: 90, rangeFromNm: 3, rangeToNm: 3, smallNm: 5 })!.small, true);
// the plain-words summary
assert.match(fishtailSummary(adv(0, 180, 0.5, 0.5)!), /Ahead to Astern is a change made by fishtail, as the ranges are small.*0429a.*90 degree fishtail/);
assert.match(fishtailSummary(adv(0, 45)!), /no solution for that pair; the nearest is/);
console.log('fishtailStation: all checks passed');
