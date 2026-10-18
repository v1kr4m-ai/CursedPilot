// Run: node tools/sightForm.check.ts
import assert from 'node:assert/strict';
import * as f from './sightForm.ts';
import * as t from './sunSights.ts';
import { sunAt } from './sunEphemeris.ts';
import { sightFormsHtml } from '../services/sightFormHtml.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
const row = (form: f.SightForm, n: number) => form.rows.find(r => r.n === n)!;

const cond: t.Conditions = { hoeM: 12, ieMin: 3.1, offArc: true, limb: 'LL', tempC: 10, pressMb: 1010 };
const header = { from: 'Cochin', to: 'Visakhapatnam' };
const j1 = t.zoneToJd(2018, 9, 10, 9, 15, 0, 5), j2 = t.zoneToJd(2018, 9, 10, 11, 45, 0, 5);

// ---- the example from the Sun Run workbook
const c: t.Common = { dr: { lat: 15 + 20 / 60, lon: 78 + 35 / 60 }, course: 100, speed: 10, cond };
const { set, result } = f.srsForms(c, { jd: j1, sextantDeg: 52 + 15 / 60 }, { jd: j2, sextantDeg: 79 + 30 / 60 }, 5, header);
assert.equal(set.forms.length, 2);
for (const form of set.forms) {
  assert.deepEqual(form.rows.map(r => r.n), Array.from({ length: 37 }, (_, i) => i + 1));
  assert.equal(form.header.from, 'Cochin'); assert.equal(form.header.co, '100°'); assert.equal(form.header.spd, '10'); assert.equal(form.header.he, '12 m');
}
const f1 = set.forms[0];
assert.equal(row(f1, 1).value, "15° 20.0' N"); assert.equal(row(f1, 1).value2, "78° 35.0' E");
assert.equal(row(f1, 2).value, '15° N'); assert.equal(row(f1, 3).value, 'Sun L.L.');
assert.equal(row(f1, 4).value, '10 Sep 2018'); assert.equal(row(f1, 4).value2, '09h 15m'); assert.equal(row(f1, 5).value, '−5');
assert.equal(row(f1, 6).value2, '04h 15m'); assert.equal(row(f1, 9).value, '04h 15m 00s');
assert.match(row(f1, 10).value, /^\d+° \d\d\.\d'$/); assert.equal(row(f1, 11).value, "3° 45.0'");   // 15 minutes of time
// GHA is the tabulated value plus the increment, and agrees with the Sun's calculated GHA
const g = sunAt(j1).gha;
{
  const [d1, m1] = row(f1, 10).value.match(/\d+(\.\d+)?/g)!.map(Number), [d2, m2] = row(f1, 13).value.match(/\d+(\.\d+)?/g)!.map(Number);
  near(d1 * 60 + m1 + 3 * 60 + 45, d2 * 60 + m2, 0.05, 'GHA = tabulated GHA + increment');
  near(d2 + m2 / 60, g, 0.02, 'GHA against the calculated Sun');
}
assert.equal(row(set.forms[0], 18).value.startsWith('−') || row(set.forms[0], 18).value.startsWith('+'), true);
assert.match(row(f1, 15).value, /^\d+°$/); assert.match(row(f1, 16).value, /^\d+°$/);
assert.ok(['same', 'contrary'].includes(row(f1, 19).value2!)); assert.equal(row(f1, 19).value2, 'same');
assert.match(row(f1, 33).value2!, /^(to|from)$/); assert.match(row(f1, 34).value, /^\d+\.\d° T$/);
assert.equal(row(f1, 35).value, '25.0 nm');
// the second form carries the observed position and its time
const f2 = set.forms[1];
assert.match(row(f2, 36).value, /N$/); assert.match(row(f2, 36).value2!, /E$/); assert.equal(row(f2, 37).value, '1145 (−5)');
assert.equal(row(f2, 35).value, '—');

// the first and second altitude differences add up to the difference times the increment: 19.3' x 58.2' / 60 = 18.7'
assert.equal(row(f1, 21).value2, "d +19.3'"); assert.equal(row(f1, 22).value, "+9.7'"); assert.equal(row(f1, 23).value, "+9.0'"); assert.equal(row(f1, 24).value, "+18.7'");

// the form method and the direct method agree
assert.ok(set.fixForm && set.fixDirect);
near(f.distNm(set.fixForm!, set.fixDirect!), 0, 0.4, 'form fix against the direct fix (nm)');
near(f.distNm(set.fixForm!, result.fix!), 0, 0.4, 'form fix against the direct fix (nm)');
assert.deepEqual(set.warnings, []);
// plotting data is given for both lines
assert.equal(set.plot.length, 2); assert.equal(set.plot[0].ap.lat, 15); assert.ok(Math.abs(set.plot[0].ap.lon - c.dr.lon) <= 0.5);

// ---- lines add up as on paper: the whole-degree rules hold for many times and positions
function check(dr: t.Pos, jd: number, sext: number, zone: number, limb: 'LL' | 'UL' = 'LL') {
  const out = f.sunSightForm({ header, dr, course: 90, speed: 10, cond: { ...cond, limb }, zone, jd, sextantDeg: sext, runNm: null, title: 't' });
  const k = out.calc;
  assert.equal(Math.abs(k.ap.lat) % 1, 0, 'chosen latitude is whole');
  near(Math.abs(k.ap.lon - dr.lon), 0, 0.5001, 'chosen longitude is within half a degree of the DR');
  const lha = ((k.gha + k.ap.lon) % 360 + 360) % 360;
  near(lha - Math.round(lha), 0, 1e-9, 'LHA is a whole number of degrees');
  near(Math.abs(k.hcCorr - k.hcExact) * 60, 0, 0.2, 'tabulated altitude interpolated like the book against the exact formula (minutes)');
  near((k.ho - k.hcCorr) * 60, k.intercept, 0.11, 'intercept is True Alt minus Corr. Tab. Alt.');
  const dec = f.dm10(0); void dec;
  return out;
}
const times = [[2018, 3, 21, 7, 5, 30], [2018, 6, 21, 10, 40, 10], [2018, 9, 10, 14, 59, 59], [2018, 12, 21, 16, 20, 5], [2019, 1, 15, 8, 0, 0]];
const places: t.Pos[] = [{ lat: 15.33, lon: 78.58 }, { lat: -34.2, lon: 151.1 }, { lat: 40.6, lon: -40.3 }, { lat: -8.2, lon: -120.9 }, { lat: 0.2, lon: 3.3 }, { lat: -0.3, lon: -179.8 }, { lat: 55.0, lon: 179.7 }];
for (const [y, mo, d, h, mi, s] of times) for (const p of places) check(p, t.zoneToJd(y, mo, d, h, mi, s, 0), 40, 0);

// contrary names: a southern observer with the Sun north of the equator
const south = check({ lat: -20.4, lon: 100.2 }, t.zoneToJd(2018, 7, 1, 3, 30, 0, 0), 30, 0);
assert.equal(south.form.rows[18].value2, 'contrary'); assert.match(south.form.rows[1].value, /S$/);
// upper limb takes the semi-diameter off
const ul = check(c.dr, j1, 52.25, 5, 'UL'), ll = check(c.dr, j1, 52.25, 5, 'LL');
assert.ok(ul.calc.ho < ll.calc.ho); near((ll.calc.ho - ul.calc.ho) * 60, 2 * sunAt(j1).sd, 0.15);

// ---- simulated ships: the forms recover the true position (north and south, east and west)
function sextantFor(ho: number, jd: number, cd: t.Conditions): number {
  const s = sunAt(jd); let x = ho;
  for (let i = 0; i < 6; i++) x += ho - t.trueAltitude(x, cd, s).ho;
  return x;
}
const altAt = (p: t.Pos, jd: number) => t.reduce(sunAt(jd), p).hc;
for (const start of [{ lat: 15.3, lon: 78.55 }, { lat: -33.9, lon: 151.2 }, { lat: 35.1, lon: -45.4 }]) {
  const course = 100, speed = 12, a = t.zoneToJd(2018, 9, 10, 9, 0, 0, 0) - (start.lon / 15) / 24, b = a + 2.5 / 24;
  const end = t.rhumb(start, course, speed * 2.5);
  const dr: t.Pos = { lat: start.lat + 0.1, lon: start.lon - 0.12 };
  const sim = f.srsForms({ dr, course, speed, cond }, { jd: a, sextantDeg: sextantFor(altAt(start, a), a, cond) }, { jd: b, sextantDeg: sextantFor(altAt(end, b), b, cond) }, 0, header);
  assert.ok(sim.set.fixForm, JSON.stringify(sim.set.warnings));
  near(f.distNm(sim.set.fixForm!, end), 0, 0.6, `form fix error at ${start.lat},${start.lon} (nm)`);
}

// ---- Sun run Merpass forms
const north: t.Pos = { lat: 15.3, lon: 78.55 };
let tm = j1 + 0.2;
for (let i = 0; i < 10; i++) tm = t.meridianPassageJd(t.rhumb(north, 100, 10 * (tm - j1) * 24).lon, tm);
const trueM = t.rhumb(north, 100, 10 * (tm - j1) * 24);
const merHo = 90 - Math.abs(trueM.lat - sunAt(tm).dec);
const sm = f.srmForms({ dr: { lat: north.lat - 5 / 60, lon: north.lon + 8 / 60 }, course: 100, speed: 10, cond },
  { jd: j1, sextantDeg: sextantFor(altAt(north, j1), j1, cond) }, sextantFor(merHo, tm, cond), 5, header, tm);
assert.equal(sm.set.forms.length, 2); assert.equal(sm.set.forms[1].rows.length, 37);
const mf = sm.set.forms[1];
assert.match(row(mf, 34).value, /N$/); assert.match(row(mf, 36).value, /N$/); assert.match(row(mf, 36).value2!, /E$/); assert.match(row(mf, 37).value, /\(−5\)$/);
assert.match(row(mf, 32).label, /Zenith distance/);
assert.ok(sm.set.fixForm); near(f.distNm(sm.set.fixForm!, trueM), 0, 0.5, 'merpass form fix error (nm)');
near(f.distNm(sm.set.fixForm!, sm.set.fixDirect!), 0, 0.4, 'merpass form against direct (nm)');
assert.deepEqual(sm.set.warnings, []);

// ---- deck watch: lines 7 and 8
{
  const slow = f.srsForms(c, { jd: j1, sextantDeg: 52 + 15 / 60 }, { jd: j2, sextantDeg: 79 + 30 / 60 }, 5, { ...header, dweSec: 12 }).set.forms[0];
  assert.equal(row(slow, 7).value, '04h 14m 48s'); assert.equal(row(slow, 8).value, '+12s'); assert.equal(row(slow, 8).note, 'slow'); assert.equal(row(slow, 9).value, '04h 15m 00s');
  const fast = f.srsForms(c, { jd: j1, sextantDeg: 52 + 15 / 60 }, { jd: j2, sextantDeg: 79 + 30 / 60 }, 5, { ...header, dweSec: -5 }).set.forms[0];
  assert.equal(row(fast, 7).value, '04h 15m 05s'); assert.equal(row(fast, 8).value, '−5s'); assert.equal(row(fast, 8).note, 'fast');
  const zero = f.srsForms(c, { jd: j1, sextantDeg: 52 + 15 / 60 }, { jd: j2, sextantDeg: 79 + 30 / 60 }, 5, { ...header, dweSec: 0 }).set.forms[1];
  assert.equal(row(zero, 7).value, '06h 45m 00s'); assert.equal(row(zero, 8).value, 'nil');
  assert.equal(row(f1, 7).value, ''); assert.equal(row(f1, 8).value, 'nil');                                 // no error given: blank watch, nil error
  const over = f.srsForms({ ...c }, { jd: t.zoneToJd(2018, 9, 10, 5, 29, 58, 5.5), sextantDeg: 40 }, { jd: t.zoneToJd(2018, 9, 10, 7, 29, 58, 5.5), sextantDeg: 60 }, 5.5, { ...header, dweSec: 20 }).set.forms[0];
  assert.equal(row(over, 7).value, '23h 59m 38s');                                                           // the watch reading wraps past midnight
}

// ---- the printable page
const html = sightFormsHtml({ ...set, forms: set.forms.map(x => ({ ...x, header: { ...x.header, from: '<Evil> & "Co"' } })) }, { title: 'Sun run Sun', ship: 'INS <Test>' }, new Date('2018-09-10T10:00:00Z'));
assert.ok(html.includes('&lt;Evil&gt; &amp; &quot;Co&quot;') && !html.includes('<Evil>') && !html.includes('<Test>') && html.includes('INS &lt;Test&gt;'));
assert.equal((html.match(/<section class="form">/g) ?? []).length, 2); assert.equal((html.match(/SIGHT FORM \(NP 98\)/g) ?? []).length, 2);
for (let n = 1; n <= 37; n++) assert.equal((html.match(new RegExp(`<td class="n">${n}</td>`, 'g')) ?? []).length, 2, `line ${n} appears on both forms`);
assert.ok(html.includes('Plotting data and cross-check') && html.includes('By direct calculation from the DR') && html.includes('Prepared 2018-09-10'));
assert.ok(html.includes('Section 5: Sight Reduction Tables') && html.includes('Corr. Tab. Alt.'));
const noFix = sightFormsHtml({ ...set, fixForm: null, fixDirect: null, warnings: ['<b>x</b>'] }, { title: 't' });
assert.ok(noFix.includes('the lines do not cross') && noFix.includes('&lt;b&gt;x&lt;/b&gt;'));

// zone description and text helpers
assert.equal(f.zoneDescription(5.5), '−5:30'); assert.equal(f.zoneDescription(-3), '+3'); assert.equal(f.zoneDescription(0), '+0'); assert.equal(f.zoneDescription(5), '−5');
assert.equal(f.dm10(14130), "23° 33.0'"); assert.equal(f.dm10(0), "0° 00.0'"); assert.equal(f.dm10(-605), "−1° 00.5'");

console.log('sightForm: all checks passed');
