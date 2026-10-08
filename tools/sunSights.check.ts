// Run: node tools/sunSights.check.ts
import assert from 'node:assert/strict';
import * as t from './sunSights.ts';
import { sunAt } from './sunEphemeris.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
/** distance in nautical miles between two close positions */
const dist = (a: t.Pos, b: t.Pos) => Math.hypot((a.lat - b.lat) * 60, (a.lon - b.lon) * 60 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180));

// ---- Mercator sailing
near(t.meridionalParts(0), 0, 1e-9); near(t.meridionalParts(30), -t.meridionalParts(-30), 1e-9);
assert.ok(t.meridionalParts(60) > 4500 && t.meridionalParts(60) < 4540);
let p = t.rhumb({ lat: 10, lon: 20 }, 0, 60); near(p.lat, 11, 1e-9); near(p.lon, 20, 1e-9);
p = t.rhumb({ lat: 0, lon: 20 }, 90, 60); near(p.lat, 0, 1e-9); near(p.lon, 21, 1e-6);
p = t.rhumb({ lat: 60, lon: 20 }, 90, 60); near(p.lon, 22, 1e-6);                          // a mile east is two minutes of longitude at 60 degrees
p = t.rhumb({ lat: 15, lon: 78 }, 100, 25); assert.ok(p.lat < 15 && p.lon > 78.4);
const back = t.rhumb(p, 280, 25); near(back.lat, 15, 1e-3); near(back.lon, 78, 2e-3);       // there and back (Mercator is exact on a rhumb; the small gap is the cosine of a different latitude)

// ---- altitude corrections
const sun = { sd: 15.9, r: 1 };
const std = { hoeM: 0, ieMin: 0, offArc: true, limb: 'LL' as const, tempC: 10, pressMb: 1010 };
near(t.dipMinutes(16), -0.0293 * 4 * 60, 1e-9);
near(t.trueAltitude(30, std, sun).corr.ie, 0, 1e-12);
assert.equal(t.trueAltitude(30, { ...std, ieMin: 3, offArc: true }, sun).corr.ie, 3); assert.equal(t.trueAltitude(30, { ...std, ieMin: 3, offArc: false }, sun).corr.ie, -3);
// lower limb adds the semi-diameter, upper limb takes it off
const ll = t.trueAltitude(40, std, sun), ul = t.trueAltitude(40, { ...std, limb: 'UL' }, sun);
near(ll.ho - ul.ho, (2 * 15.9) / 60, 1e-9);
// refraction at 45 degrees is about 1 minute and bigger when cold and high pressure; low sun refracts more
near(t.refractionMinutes(45, 10, 1010), -0.97, 0.05); assert.ok(t.refractionMinutes(45, -10, 1030) < t.refractionMinutes(45, 30, 1000));
assert.ok(t.refractionMinutes(5, 10, 1010) < -8 && t.refractionMinutes(5, 10, 1010) > -12);
// lower limb Sun correction at 40 degrees is about +15 minutes
near(ll.corr.total, 14.85, 0.05);

// ---- simulation: a ship on a known track, sextant readings made from the exact positions
const cond: t.Conditions = { hoeM: 12, ieMin: 3.1, offArc: true, limb: 'LL', tempC: 10, pressMb: 1010 };
/** the sextant reading that corrects back to the true altitude `ho` */
function sextantFor(ho: number, jd: number): number {
  const s = sunAt(jd);
  let x = ho;
  for (let i = 0; i < 6; i++) x += ho - t.trueAltitude(x, cond, s).ho;
  return x;
}
const altAt = (pos: t.Pos, jd: number) => t.reduce(sunAt(jd), pos).hc;

const course = 100, speed = 10;
const j1 = t.zoneToJd(2018, 9, 10, 9, 15, 0, 5), j2 = t.zoneToJd(2018, 9, 10, 11, 45, 0, 5);
const true1: t.Pos = { lat: 15.30, lon: 78.55 }, true2 = t.rhumb(true1, course, speed * (j2 - j1) * 24);
const dr1: t.Pos = { lat: true1.lat + 6 / 60, lon: true1.lon - 9 / 60 };      // DR about 10 miles out
const srs = t.srs({ dr: dr1, course, speed, cond }, { jd: j1, sextantDeg: sextantFor(altAt(true1, j1), j1) }, { jd: j2, sextantDeg: sextantFor(altAt(true2, j2), j2) });
assert.ok(srs.fix, 'srs fix'); assert.deepEqual(srs.warnings, []);
near(dist(srs.fix!, true2), 0, 0.3, 'srs fix error (nm)');
near(srs.run, 25, 1e-5); near(srs.runHours, 2.5, 1e-6); near(srs.cut, Math.abs(srs.first.red.zn - srs.second.red.zn) > 90 ? 180 - Math.abs(srs.first.red.zn - srs.second.red.zn) : Math.abs(srs.first.red.zn - srs.second.red.zn), 1e-9);

// the same readings with the DR a long way off still give the right fix (the method corrects for it)
const far = t.srs({ dr: { lat: true1.lat - 0.2, lon: true1.lon + 0.25 }, course, speed, cond }, { jd: j1, sextantDeg: sextantFor(altAt(true1, j1), j1) }, { jd: j2, sextantDeg: sextantFor(altAt(true2, j2), j2) });
near(dist(far.fix!, true2), 0, 1.0, 'srs fix error with a poor DR (nm)');

// the example from the Sun Run workbook, checked against an exact solution of the two altitude circles
const wbDr: t.Pos = { lat: 15 + 20 / 60, lon: 78 + 35 / 60 };
const wb = t.srs({ dr: wbDr, course: 100, speed: 10, cond }, { jd: j1, sextantDeg: 52 + 15 / 60 }, { jd: j2, sextantDeg: 79 + 30 / 60 });
{
  let q = { ...wb.dr2 };
  const f = (x: t.Pos) => [t.reduce(wb.first.sun, t.rhumb(x, 280, wb.run)).hc - wb.first.ho, t.reduce(wb.second.sun, x).hc - wb.second.ho];
  for (let i = 0; i < 20; i++) {
    const e = 1e-5, f0 = f(q), fa = f({ lat: q.lat + e, lon: q.lon }), fb = f({ lat: q.lat, lon: q.lon + e });
    const a = (fa[0] - f0[0]) / e, b = (fb[0] - f0[0]) / e, c = (fa[1] - f0[1]) / e, d = (fb[1] - f0[1]) / e, det = a * d - b * c;
    q = { lat: q.lat - (d * f0[0] - b * f0[1]) / det, lon: q.lon - (-c * f0[0] + a * f0[1]) / det };
  }
  near(dist(wb.fix!, q), 0, 0.3, 'workbook example vs exact solution (nm)');
}

// nonsense inputs are reported, not turned into positions
assert.ok(t.srs({ dr: dr1, course, speed, cond }, { jd: j2, sextantDeg: 50 }, { jd: j1, sextantDeg: 50 }).warnings.some(w => /later/.test(w)));
const same = t.srs({ dr: dr1, course, speed: 0, cond }, { jd: j1, sextantDeg: 52 }, { jd: j1 + 1e-6, sextantDeg: 52 });
assert.equal(same.fix, null); assert.ok(same.warnings.some(w => /almost the same/.test(w)));
assert.ok(t.srs({ dr: dr1, course, speed, cond }, { jd: j1, sextantDeg: 52.25 }, { jd: j1 + 0.01, sextantDeg: 5 }).warnings.some(w => /unreliable|Check/.test(w)));

// ---- meridian passage
const mp = t.meridianPassageJd(78.5, j1);
near(((sunAt(mp).gha + 78.5 + 540) % 360) - 180, 0, 1e-3, 'LHA at meridian passage');
assert.ok(mp > j1 && mp - j1 < 0.5);
// a ship going east meets the Sun sooner than one standing still
const dr0: t.Pos = { lat: 15.3, lon: 78.55 };
const still = t.srm({ dr: dr0, course: 90, speed: 0, cond }, { jd: j1, sextantDeg: 52 }, 70);
const east = t.srm({ dr: dr0, course: 90, speed: 15, cond }, { jd: j1, sextantDeg: 52 }, 70);
assert.ok(east.mpJd < still.mpJd);

// simulation: true track, the first sight at 09:15 and the meridian altitude at the true time of passage
const t1: t.Pos = { lat: 15.30, lon: 78.55 };
let tm = j1 + 0.2;
for (let i = 0; i < 10; i++) tm = t.meridianPassageJd(t.rhumb(t1, course, speed * (tm - j1) * 24).lon, tm);
const trueM = t.rhumb(t1, course, speed * (tm - j1) * 24);
const merHo = 90 - Math.abs(trueM.lat - sunAt(tm).dec);
const dr: t.Pos = { lat: t1.lat - 5 / 60, lon: t1.lon + 8 / 60 };
const common = { dr, course, speed, cond };
const withTime = t.srm(common, { jd: j1, sextantDeg: sextantFor(altAt(t1, j1), j1) }, sextantFor(merHo, tm), tm);
assert.deepEqual(withTime.warnings, []); near(dist(withTime.fix!, trueM), 0, 0.3, 'srm fix error with the observed time (nm)');
near(withTime.lat, trueM.lat, 0.003, 'latitude from the meridian altitude');
// without an observed time the worked-out time is used; a DR out by 8' of longitude is only half a minute of time
const noTime = t.srm(common, { jd: j1, sextantDeg: sextantFor(altAt(t1, j1), j1) }, sextantFor(merHo, tm));
assert.equal(noTime.usedObservedTime, false); near(Math.abs(noTime.mpJd - tm) * 86400, 32, 15, 'merpass time error (s)');
near(dist(noTime.fix!, trueM), 0, 1.0, 'srm fix error without the observed time (nm)');
// sun north of the observer: latitude = dec - zd
const north = t.srm({ dr: { lat: 5, lon: 78.5 }, course: 90, speed: 10, cond }, { jd: t.zoneToJd(2018, 6, 21, 8, 30, 0, 5.5), sextantDeg: 45 }, 80);
assert.ok(north.lat > 5 && north.drMp.lat === 5);   // sun at +23 declination, observer at 5N: zenith distance is to the north
// a first sight made with the Sun nearly on the meridian gives no longitude
const noon = t.srm({ dr: dr0, course: 90, speed: 5, cond }, { jd: mp - 0.001, sextantDeg: 74 }, 74);
assert.equal(noon.fix, null); assert.ok(noon.warnings.some(w => /due north or south/.test(w)));

// ---- typed values
assert.equal(t.parseClock('09:15'), 9 * 3600 + 15 * 60); assert.equal(t.parseClock('9 15 30'), 9 * 3600 + 15 * 60 + 30); assert.equal(t.parseClock('091530'), 33330);
assert.equal(t.parseClock('11:40:25'), 11 * 3600 + 40 * 60 + 25); assert.equal(t.parseClock('0915'), 9 * 3600 + 15 * 60);
for (const bad of ['', '25:00', '9:61', '12:00:61', 'noon', '9', '9:15:30:10']) assert.equal(t.parseClock(bad), null, bad);
assert.deepEqual(t.parseIsoDate('2018-09-10'), [2018, 9, 10]); assert.equal(t.parseIsoDate('2018-02-30'), null); assert.equal(t.parseIsoDate('10/09/2018'), null); assert.deepEqual(t.parseIsoDate('2020-02-29'), [2020, 2, 29]);
assert.equal(t.parseZone('5.5'), 5.5); assert.equal(t.parseZone('+5:30'), 5.5); assert.equal(t.parseZone('-3'), -3); assert.equal(t.parseZone('5'), 5); assert.equal(t.parseZone('0'), 0);
assert.equal(t.parseZone('20'), null); assert.equal(t.parseZone('abc'), null); assert.equal(t.parseZone(''), null);

console.log('sunSights: all checks passed');
