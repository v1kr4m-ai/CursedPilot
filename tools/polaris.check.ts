// Run: node tools/polaris.check.ts
import assert from 'node:assert/strict';
import * as p from './polaris.ts';
import * as t from './sunSights.ts';
import { gast, julianDay } from './sunEphemeris.ts';
import { POLARIS, starAt } from './stars.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);

// the class example: 3 June 2017, ZT 1915 (zone -5), DR 08 15N 78 43E, sextant 8 20.2', IE +1.5', HoE 25 ft.
// The notes work it from the almanac: GHA Aries 1415 = 105 58.5', LHA Aries 184 41.5', a0 1 29.9', a1 0.5', a2 1.0',
// apparent altitude 8 16.8', correction -6.3', true altitude 8 10.5', latitude 8 41.9' N.
const cond: t.Conditions = { hoeM: 25 * 0.3048, ieMin: 1.5, offArc: true, limb: 'LL', tempC: 10, pressMb: 1010 };
const jd = julianDay(2017, 6, 3, 14, 15, 0);
near(gast(julianDay(2017, 6, 3, 14, 0, 0)), 102 + 12.9 / 60, 0.005, 'GHA Aries at 1400 against the almanac (102 12.9)');
const r = p.polarisLatitude({ jd, lon: 78 + 43 / 60, sextantDeg: 8 + 20.2 / 60, cond });
near(r.lhaAries, 184 + 41.5 / 60, 0.02, 'LHA Aries'); near(r.apparent, 8 + 16.8 / 60, 0.01, 'apparent altitude'); near(r.ho, 8 + 10.5 / 60, 0.01, 'true altitude');
near(r.lat, 8 + 41.9 / 60, 0.003, 'latitude (8 41.9 N in the notes)');
near(r.sumA, 89.9 + 0.5 + 1.0, 0.3, 'a0 + a1 + a2 against the almanac values in the notes (1 29.9 + 0.5 + 1.0)');
assert.deepEqual(r.warnings, []);

// Polaris's own place for the date: declination climbs about 15" a year from 89 15 50.8" in 2000, and its SHA is about 317 deg
const pl = starAt(POLARIS, jd);
near(pl.dec, 89.3324, 0.01, 'Polaris declination 2017'); near(pl.sha, 317.0, 0.5, 'Polaris SHA 2017'); near(r.p, 90 - pl.dec, 1e-12);

// the series terms and the exact correction agree to a few tenths of a minute; the exact one is what is used
assert.ok(Math.abs(60 + r.first + r.second - r.sumA) < 0.3, `series ${60 + r.first + r.second} against exact ${r.sumA}`);

// round trip: a ship at a known latitude, sextant reading made from the exact altitude, any LHA
function sextantFor(ho: number, c: t.Conditions): number { let s = ho; for (let i = 0; i < 6; i++) s += ho - t.starTrueAltitude(s, c).ho; return s; }
for (const lat of [5, 12.3, 30, 45.5, 60, 72]) for (const lon of [-170, -40, 0, 80, 151]) for (const hr of [0, 5, 9, 14, 20]) {
  const j = julianDay(2018, 3, 10, hr, 20, 0), pl2 = starAt(POLARIS, j);
  const lha = (pl2.gha + lon + 360) % 360, ho = Math.asin(Math.sin(lat * Math.PI / 180) * Math.sin(pl2.dec * Math.PI / 180) + Math.cos(lat * Math.PI / 180) * Math.cos(pl2.dec * Math.PI / 180) * Math.cos(lha * Math.PI / 180)) * 180 / Math.PI;
  const out = p.polarisLatitude({ jd: j, lon, sextantDeg: sextantFor(ho, cond), cond });
  near(out.lat, lat, 2e-4, `round trip at ${lat},${lon},${hr}h`);
}

// off the northern hemisphere: a warning, not a latitude to trust
assert.ok(p.polarisLatitude({ jd, lon: 78, sextantDeg: -3, cond }).warnings.some(w => /not above the horizon/.test(w)));
assert.ok(p.polarisLatitude({ jd, lon: 78, sextantDeg: 3, cond }).warnings.some(w => /too low/.test(w)));

console.log('polaris: all checks passed');
