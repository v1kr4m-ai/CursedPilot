// Run: node tools/sunEphemeris.check.ts
import assert from 'node:assert/strict';
import * as s from './sunEphemeris.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);

// Julian day: Meeus examples 7.a
near(s.julianDay(1957, 10, 4.81), 2436116.31, 1e-6); near(s.julianDay(2000, 1, 1.5), 2451545.0, 1e-9); near(s.julianDay(1987, 1, 27), 2446822.5, 1e-9);
assert.deepEqual(s.calendarOf(2436116.31).slice(0, 2), [1957, 10]); near(s.calendarOf(2436116.31)[2] + s.calendarOf(2436116.31)[3], 4.81, 1e-6);

// Nutation, Meeus example 22.a: 1987 April 10, 0h TD: dpsi = -3.788", deps = +9.443"
const n = s.nutation((2446895.5 - 2451545) / 36525);
near(n.dpsi, -3.788, 0.001, 'dpsi'); near(n.deps, 9.443, 0.001, 'deps');
near(s.meanObliquity((2446895.5 - 2451545) / 36525), 23.4409463, 1e-6, 'eps0');

// Sidereal time, Meeus example 12.a: 1987 April 10 0h UT: 13h10m46.3668s; and 12.b: 19h21m00s UT: 8h34m57.0896s
near(s.gmst(2446895.5) / 15 * 3600, 13 * 3600 + 10 * 60 + 46.3668, 0.01, 'gmst 0h');
near(s.gmst(s.julianDay(1987, 4, 10, 19, 21, 0)) / 15 * 3600, 8 * 3600 + 34 * 60 + 57.0896, 0.01, 'gmst 19h21m');

// Sun, Meeus example 25.a: 1992 October 13, 0h TD: apparent RA 198.38083, Dec -7.78507, distance 0.99766 AU
const sun = s.sunAt(2448908.5, 0);
near(sun.ra, 198.38083, 0.0005, 'ra'); near(sun.dec, -7.78507, 0.0005, 'dec'); near(sun.r, 0.99766, 0.00001, 'r'); near(sun.sd, 15.9938 / 0.99766, 1e-3, 'sd');

// Greenwich hour angle = apparent sidereal time - RA; check it comes out on 0-360 and moves ~15 degrees an hour
const a = s.sunAt(s.julianDay(2018, 9, 10, 4, 15, 0)), b = s.sunAt(s.julianDay(2018, 9, 10, 5, 15, 0));
assert.ok(a.gha >= 0 && a.gha < 360);
near(((b.gha - a.gha + 360) % 360), 15.0, 0.05, 'gha rate');
// 10 Sep 2018 04:15 UT: the workbook this was checked against gives GHA 244.48, Dec +4.969 (the almanac gives dec 4 58.2'N for 04h)
near(a.gha, 244.48, 0.01, 'gha 2018'); near(a.dec, 4.969, 0.002, 'dec 2018');
// sun semi-diameter in September is a little under 15.9'
assert.ok(a.sd > 15.8 && a.sd < 16.0);
// equinox 2018: declination about zero around 23 Sep 01:54 UT
near(s.sunAt(s.julianDay(2018, 9, 23, 1, 54, 0)).dec, 0, 0.01, 'equinox');
console.log('sunEphemeris: all checks passed');
