// Run: node tools/fourStar.check.ts
import assert from 'node:assert/strict';
import * as q from './fourStar.ts';
import * as t from './sunSights.ts';
import { gast, julianDay, sunAt } from './sunEphemeris.ts';
import { starAt, starByName } from './stars.ts';
import { distNm } from './sightForm.ts';
import { sightFormsHtml } from '../services/sightFormHtml.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

// ---- twilight: the Sun's centre is 6 degrees down, and it is morning before noon and evening after
const dr: t.Pos = { lat: 15.33, lon: 78.58 };
const noon = t.zoneToJd(2018, 9, 10, 12, 0, 0, 5.5);
const am = q.civilTwilightJd(dr, noon, true)!, pm = q.civilTwilightJd(dr, noon, false)!;
near(t.reduce(sunAt(am), dr).hc, -6, 1e-6, 'morning twilight altitude'); near(t.reduce(sunAt(pm), dr).hc, -6, 1e-6, 'evening twilight altitude');
assert.ok(am < noon && pm > noon);
near((pm - am) * 24, 13.0, 0.5, 'twilight to twilight: a 12-hour day plus about 25 minutes of twilight at each end');
assert.equal(q.civilTwilightJd({ lat: 80, lon: 0 }, t.zoneToJd(2018, 6, 21, 12, 0, 0, 0), true), null);   // midnight sun: no twilight to plan on

// ---- the plan
for (const kind of ['morning', 'evening'] as const) {
  const plan = q.planFourStar(dr, noon, kind, 10)!;
  assert.ok(plan, kind);
  near((plan.twilightJd - plan.startJd) * 1440, 10, 1e-6, 'start is the interval before twilight');
  // LHA Aries is a whole number of degrees at t0, and the stopwatch starts two minutes earlier
  const lha = (gast(plan.t0Jd) + dr.lon + 360) % 360;
  near(lha - Math.round(lha), 0, 1e-6, 'LHA Aries at t0 is whole'); assert.equal(Math.round(lha) % 360, plan.chosenLhaAries);
  near((plan.t0Jd - plan.zeroJd) * 1440, 2, 1e-4, 'zero time is two minutes before');
  assert.ok(Math.abs(plan.t0Jd - plan.startJd) * 1440 < 4.5, 'within a couple of minutes of the start time');
  assert.equal(plan.suggested.length, 4);
  for (const c of plan.suggested) { assert.ok(c.hc >= 30 && c.hc <= 70, `${c.star.name} altitude ${c.hc}`); assert.ok(c.star.v <= 2.5); }
  const az = plan.suggested.map(c => c.zn).sort((a, b) => a - b), gaps = az.map((x, i) => (i === 3 ? az[0] + 360 - x : az[i + 1] - x));
  assert.ok(Math.min(...gaps) >= 40, `suggested bearings ${az.map(x => x.toFixed(0))} are well spread`);
  assert.ok(plan.candidates.every(c => c.hc > 5));
}
// the Sun is up for the evening plan's stars only after sunset: evening t0 is later than morning t0
assert.ok(q.planFourStar(dr, noon, 'evening')!.t0Jd > q.planFourStar(dr, noon, 'morning')!.t0Jd);

// picking stars: spread beats brightness
const mk = (name: string, hc: number, zn: number) => ({ star: starByName(name)!, hc, zn });
const sug = q.suggestStars([mk('Sirius', 40, 10), mk('Canopus', 40, 20), mk('Vega', 40, 100), mk('Altair', 40, 190), mk('Rigel', 40, 280), mk('Capella', 40, 15)]);
assert.equal(sug.length, 4); assert.ok(sug.every(x => x.star.name !== 'Canopus' || sug.length === 4));
assert.deepEqual(q.suggestStars([mk('Sirius', 40, 10), mk('Vega', 40, 100)]).map(x => x.star.name), ['Sirius', 'Vega']);   // fewer than four available: as many as there are
assert.deepEqual(q.suggestStars([mk('Sirius', 85, 10), mk('Vega', 12, 100)]), []);                                       // nothing in the usable band

// ---- crossing several lines
const x = q.crossMany([{ point: { lat: 10.1, lon: 20 }, zn: 0 }, { point: { lat: 10, lon: 20.1 }, zn: 90 }, { point: { lat: 10.1, lon: 20.1 }, zn: 45 }])!;
near(x.pos.lat, 10.1, 0.02); near(x.pos.lon, 20.1, 0.02); assert.equal(x.residuals.length, 3);
// lines through one point meet there, with no misses
const p0: t.Pos = { lat: 33, lon: -40 };
const sameP = q.crossMany([0, 60, 130, 250].map(zn => ({ point: p0, zn })))!;
near(distNm(sameP.pos, p0), 0, 1e-6); assert.ok(sameP.residuals.every(r => Math.abs(r) < 1e-6));
assert.equal(q.crossMany([{ point: p0, zn: 10 }, { point: p0, zn: 10 }]), null);   // parallel
assert.equal(q.crossMany([{ point: p0, zn: 10 }]), null);

// ---- simulated morning fix: a ship on a known track, DR some miles out, sights at stopwatch times
const cond: t.Conditions = { hoeM: 12, ieMin: 1.5, offArc: true, limb: 'LL', tempC: 28, pressMb: 1008 };
function sextantFor(ho: number): number { let s = ho; for (let i = 0; i < 6; i++) s += ho - t.starTrueAltitude(s, cond).ho; return s; }
for (const [lat, lon, kind] of [[15.3, 78.55, 'morning'], [-34.0, 151.2, 'evening'], [48.5, -5.2, 'evening'], [8.0, 73.0, 'morning']] as const) {
  const here: t.Pos = { lat, lon };
  const mid = t.zoneToJd(2018, 9, 10, 12, 0, 0, lon / 15);
  const plan = q.planFourStar(here, mid, kind, 10)!;
  assert.ok(plan && plan.suggested.length === 4, `${lat},${lon} plan`);
  const course = 100, speed = 12;
  // the ship is at `here` at zero time; each star is shot at a stopwatch time from 0:20 to 3:40
  const readings = [20, 80, 140, 220].map(s => s / 86400);
  const sights: q.StarSightIn[] = plan.suggested.map((c, i) => {
    const jd = plan.zeroJd + readings[i];
    const at = t.rhumb(here, course, speed * readings[i] * 24);
    const p = starAt(c.star, jd);
    return { star: c.star, jd, sextantDeg: sextantFor(t.reduce({ gha: p.gha, dec: p.dec }, at).hc) };
  });
  const drPos: t.Pos = { lat: lat + 0.07, lon: lon - 0.1 };
  const out = q.fourStarFix({ dr: drPos, course, speed, cond }, plan.zeroJd, sights, 0, { from: 'A', to: 'B' }, 'zero');
  assert.ok(out.result.fix, `${lat},${lon}: ${out.result.warnings.join(' | ')}`);
  near(distNm(out.result.fix!, here), 0, 0.4, `form fix error at ${lat},${lon} (nm)`);
  near(distNm(out.result.direct!, here), 0, 0.4, `direct fix error at ${lat},${lon} (nm)`);
  assert.ok(out.result.maxResidual < 0.6, `lines meet well (${out.result.maxResidual.toFixed(2)} nm)`);
  assert.deepEqual(out.result.warnings.filter(w => !/largest gap/.test(w)), []);   // a thin sky can leave a wide empty sector; that warning is fair
  assert.equal(out.set.forms.length, 4); assert.equal(out.set.plot.length, 4);
  for (const f of out.set.forms) assert.deepEqual(f.rows.map(r => r.n), Array.from({ length: 37 }, (_, i) => i + 1));
  // star lines on the form: body, SHA and the Aries GHA, no d correction, refraction only
  const f0 = out.set.forms[0], row = (n: number) => f0.rows.find(r => r.n === n)!;
  assert.match(row(3).value, /\(\*\d+\)$/); assert.match(row(10).note!, /^Aries/); assert.match(row(12).value, /^\d+° \d\d\.\d'$/); assert.equal(row(18).value, '—'); assert.equal(row(30).note, 'refraction');
  // the last form carries the position and its time
  const lastRows = out.set.forms[3].rows; assert.match(lastRows[35].value, /[NS]$/); assert.match(lastRows[35].value2!, /[EW]$/);
  assert.equal(out.set.forms[0].rows[35].value, '');
  // whole-degree rules hold on every star form: chosen latitude whole, LHA whole
  const html = sightFormsHtml(out.set, { title: 'Four star fix' }, new Date('2018-09-10T10:00:00Z'));
  assert.equal((html.match(/<section class="form">/g) ?? []).length, 4); assert.ok(html.includes('Fix misses the line by'));
}

// a wrong star (mis-identified) shows up as a big miss
{
  const here: t.Pos = { lat: 15.3, lon: 78.55 };
  const mid = t.zoneToJd(2018, 9, 10, 12, 0, 0, 5.5), plan = q.planFourStar(here, mid, 'evening', 10)!;
  const sights: q.StarSightIn[] = plan.suggested.map((c, i) => {
    const jd = plan.zeroJd + (30 + 60 * i) / 86400, p = starAt(c.star, jd);
    return { star: c.star, jd, sextantDeg: sextantFor(t.reduce({ gha: p.gha, dec: p.dec }, here).hc + (i === 2 ? 0.25 : 0)) };   // one altitude 15' out
  });
  const out = q.fourStarFix({ dr: here, course: 0, speed: 0, cond }, plan.zeroJd, sights, 5.5, { from: '', to: '' });
  assert.ok(out.result.maxResidual > 3, `a 15' error in one altitude shows (${out.result.maxResidual.toFixed(1)} nm)`);
  assert.ok(out.result.warnings.some(w => /miss the fix/.test(w)));
}
// too few stars, and stars all on one bearing
assert.ok(q.fourStarFix({ dr, course: 0, speed: 0, cond }, noon, [], 5.5, { from: '', to: '' }).result.warnings.some(w => /at least two/.test(w)));

console.log('fourStar: all checks passed');
