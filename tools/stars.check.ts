// Run: node tools/stars.check.ts
import assert from 'node:assert/strict';
import * as s from './stars.ts';
import { gast, julianDay } from './sunEphemeris.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);

// Meeus example 23.a: theta Persei on 2028 November 13.19 TD. J2000 RA 2h44m11.986s, Dec +49 13 42.48, motion +0.03425 s and -0.0895" a year.
// Apparent place (with nutation and aberration): RA 2h46m14.390s = 41.559958 deg, Dec +49 21 07.45 = 49.352069 deg.
const p = s.apparentFromJ2000(41.04994167, 49.22846667, (0.03425 * 15) / 3600, -0.0895 / 3600, 2462088.69);
near(p.ra, 41.559958, 0.0003, 'apparent RA'); near(p.dec, 49.352069, 0.0003, 'apparent Dec');

// the catalogue
assert.equal(s.STARS.length, 57);
assert.deepEqual(s.STARS.map(x => x.no), Array.from({ length: 57 }, (_, i) => i + 1));
assert.equal(new Set(s.STARS.map(x => x.name)).size, 57); assert.equal(new Set(s.STARS.map(x => x.hip)).size, 57);
assert.equal(s.STARS[0].name, 'Alpheratz'); assert.equal(s.STARS[17].name, 'Sirius'); assert.equal(s.STARS[36].name, 'Arcturus'); assert.equal(s.STARS[56].name, 'Markab');
assert.equal(s.STARS[48].name, 'Vega'); assert.equal(s.STARS[55].name, 'Fomalhaut'); assert.equal(s.STARS[16].name, 'Canopus');
for (const x of s.STARS) { assert.ok(x.ra0 >= 0 && x.ra0 < 360 && Math.abs(x.dec0) <= 90 && x.v < 3.3, x.name); }
// the almanac's list runs in right ascension (two stars about 3 minutes of arc apart can swap)
for (let i = 1; i < 57; i++) assert.ok(s.STARS[i].ra0 > s.STARS[i - 1].ra0 - 0.1, `${s.STARS[i].name} follows ${s.STARS[i - 1].name} in right ascension`);
assert.equal(s.starByName(' sirius ')!.no, 18); assert.equal(s.starByName('nobody'), undefined);

// 2018 values against what the Nautical Almanac gives (to a few minutes of arc; I know them as SHA 258 27, Dec S16 44 for Sirius)
const j2018 = julianDay(2018, 9, 10, 4, 15, 0);
const sirius = s.starAt(s.starByName('Sirius')!, j2018);
near(sirius.sha, 258.45, 0.1, 'Sirius SHA'); near(sirius.dec, -16.74, 0.05, 'Sirius Dec');
const vega = s.starAt(s.starByName('Vega')!, j2018);
near(vega.sha, 80.65, 0.1, 'Vega SHA'); near(vega.dec, 38.80, 0.05, 'Vega Dec');
const arcturus = s.starAt(s.starByName('Arcturus')!, j2018);
near(arcturus.sha, 145.9, 0.1, 'Arcturus SHA'); near(arcturus.dec, 19.1, 0.05, 'Arcturus Dec');

// GHA of a star = GHA Aries + SHA, on 0-360, and Aries moves a little over 15 degrees an hour
near(sirius.gha, (gast(j2018) + sirius.sha) % 360, 1e-9);
const later = s.starAt(s.starByName('Sirius')!, j2018 + 1 / 24);
near((later.ariesGha - sirius.ariesGha + 360) % 360, 15.0411, 0.001, 'Aries rate');
near(later.sha, sirius.sha, 0.0001, 'SHA hardly moves in an hour');
// precession and a large proper motion show over the decades: Arcturus loses about 0.26 degree of declination in 50 years (16.6" a year of precession, 2.0" of its own motion)
near(s.starAt(s.starByName('Arcturus')!, julianDay(2000, 1, 1.5)).dec - s.starAt(s.starByName('Arcturus')!, julianDay(2050, 1, 1.5)).dec, 0.26, 0.02, 'Arcturus Dec change in 50 years');

console.log('stars: all checks passed');
