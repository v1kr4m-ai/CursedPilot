// Run: node tools/bodies.check.ts
import assert from 'node:assert/strict';
import * as b from './bodies.ts';
import { gast, julianDay } from './sunEphemeris.ts';
import { MOON_B, MOON_LR } from './moonData.ts';
import { VSOP } from './planetData.ts';

const near = (a: number, b2: number, tol: number, what = '') => assert.ok(Math.abs(a - b2) <= tol, `${what} ${a} is not within ${tol} of ${b2}`);

// Moon: Meeus example 47.a, 1992 April 12 at 0h TD: lambda 133.162655, beta -3.229126, distance 368409.7 km,
// apparent RA 134.688470, Dec +13.768368, horizontal parallax 0.991990
const g = b.moonGeometric(2448724.5);
near(g.lon, 133.162655, 2e-5, 'lon'); near(g.lat, -3.229126, 2e-5, 'lat'); near(g.distance, 368409.7, 0.2, 'distance');
const m = b.moonApparent(2448724.5);
near(m.ra, 134.68847, 2e-5, 'ra'); near(m.dec, 13.768368, 2e-5, 'dec'); near(m.hp, 0.99199, 1e-5, 'hp'); near(m.sd, 0.2725076 * Math.sin(m.hp * Math.PI / 180) * 180 / Math.PI, 2e-4, 'semi-diameter');

// Venus: Meeus example 33.a, 1992 December 20 at 0h TD: apparent RA 21h04m41.454s, Dec -18 53 16.84"
const v = b.planetApparent('Venus', 2448976.5);
near(v.ra, (21 + 4 / 60 + 41.454 / 3600) * 15, 0.0004, 'Venus RA'); near(v.dec, -(18 + 53 / 60 + 16.84 / 3600), 0.0004, 'Venus Dec');

// planets as they were: Mars at opposition on 2018 July 27 (0.386 AU, magnitude -2.8, RA about 20h33m, Dec -25.5)
const mars = b.bodyAt('Mars', julianDay(2018, 7, 27, 0, 0, 0));
near(mars.distance, 0.3863, 0.003, 'Mars distance'); near(mars.mag, -2.8, 0.15, 'Mars magnitude'); near(mars.ra / 15, 20.55, 0.05, 'Mars RA hours'); near(mars.dec, -25.5, 0.1, 'Mars Dec');
near(mars.hp * 3600, 8.794 / 0.3863, 0.1, 'Mars parallax');
// the Moon two thirds of a day after new moon (new on 2018 Sep 9 18:01 UT) is a few degrees east of the Sun
const moon = b.bodyAt('Moon', julianDay(2018, 9, 10, 0, 0, 0));
near(moon.ra - 168.43, 4.4, 1.5, 'Moon east of the Sun'); near(moon.hp * 60, 60.2, 0.4, 'Moon HP'); near(moon.sd * 60, 16.4, 0.15, 'Moon SD');
// Jupiter and Saturn are in Libra and Sagittarius in September 2018 and a long way off; Venus is the brightest
const jup = b.bodyAt('Jupiter', julianDay(2018, 9, 10, 0, 0, 0)), sat = b.bodyAt('Saturn', julianDay(2018, 9, 10, 0, 0, 0)), ven = b.bodyAt('Venus', julianDay(2018, 9, 10, 0, 0, 0));
near(jup.ra / 15, 15.08, 0.1, 'Jupiter RA'); near(jup.dec, -16.5, 0.3, 'Jupiter Dec'); near(sat.ra / 15, 18.18, 0.1, 'Saturn RA'); near(sat.dec, -22.7, 0.3, 'Saturn Dec');
assert.ok(ven.mag < jup.mag && jup.mag < sat.mag, 'Venus brighter than Jupiter brighter than Saturn');

// GHA is the sidereal time less the right ascension, and runs on at about 15.04 degrees an hour for a planet (the almanac uses 15 and a v correction), 14.3 for the Moon
const t0 = julianDay(2018, 9, 10, 4, 0, 0);
for (const name of b.BODY_NAMES) {
  const p = b.bodyAt(name, t0), q = b.bodyAt(name, t0 + 1 / 24);
  near(p.gha, (gast(t0) - p.ra + 720) % 360, 1e-9, `${name} GHA`);
  const rate = (q.gha - p.gha + 360) % 360;
  near(rate, name === 'Moon' ? 14.3 : 15.04, name === 'Moon' ? 0.35 : 0.08, `${name} hourly change of GHA`);
}
assert.ok(b.isBodyName('Jupiter') && b.isBodyName('Moon') && !b.isBodyName('Sirius') && !b.isBodyName('Sun'));

// the data tables are whole
assert.equal(MOON_LR.length, 60); assert.equal(MOON_B.length, 60); assert.deepEqual(Object.keys(VSOP), ['earth', 'venus', 'mars', 'jupiter', 'saturn']);
for (const k of Object.keys(VSOP)) for (const s of [VSOP[k].L, VSOP[k].B, VSOP[k].R]) assert.ok(s[0].length >= 5 && s[0].every(t => t.length === 3));

console.log('bodies: all checks passed');
