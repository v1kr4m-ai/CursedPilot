// Run: node tools/riseSet.check.ts
import assert from 'node:assert/strict';
import * as r from './riseSet.ts';
import * as t from './sunSights.ts';
import { calendarOf } from './sunEphemeris.ts';

const near = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
/** UT clock of a Julian day in minutes since midnight */
const utMin = (jd: number) => calendarOf(jd + 1e-9)[3] * 1440;

// Greenwich-ish (London 51.48N 0.0): 2018 March 20: sunrise about 06:00 and sunset 18:12 UT; June 21: 03:43 and 20:21 UT
const london: t.Pos = { lat: 51.48, lon: 0 };
const mar = r.sunTimes(london, t.zoneToJd(2018, 3, 20, 12, 0, 0, 0));
near(utMin(mar.rise!), 6 * 60 + 1, 4, 'equinox sunrise'); near(utMin(mar.set!), 18 * 60 + 13, 4, 'equinox sunset');
near(mar.riseBearing!, 90, 2.5, 'equinox sunrise bearing'); near(mar.setBearing!, 270, 2.5, 'equinox sunset bearing');
const jun = r.sunTimes(london, t.zoneToJd(2018, 6, 21, 12, 0, 0, 0));
near(utMin(jun.rise!), 3 * 60 + 43, 4, 'solstice sunrise'); near(utMin(jun.set!), 20 * 60 + 21, 4, 'solstice sunset');
near(jun.riseBearing!, 49, 2, 'solstice sunrise bearing (about 049)'); near(jun.setBearing!, 311, 2, 'solstice sunset bearing (about 311)');
near(jun.dec, 23.43, 0.02, 'declination at the solstice');
assert.ok(jun.civil[0] !== null && jun.nautical[0] !== null); assert.equal(jun.astronomical[0], null); assert.equal(jun.astronomical[1], null);   // no astronomical twilight at 51N in June

// the day goes in order, at 15N on 10 September
const dr: t.Pos = { lat: 15.33, lon: 78.58 };
const d = r.sunTimes(dr, t.zoneToJd(2018, 9, 10, 12, 0, 0, 5.5));
const order = [d.astronomical[0], d.nautical[0], d.civil[0], d.rise, d.meridianPassage, d.set, d.civil[1], d.nautical[1], d.astronomical[1]] as number[];
assert.ok(order.every(x => x !== null)); for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `event ${i} follows event ${i - 1}`);
near((d.set! - d.rise!) * 24, 12.2, 0.25, 'day length at 15N in September');
// local mean time of meridian passage is close to noon (equation of time under a quarter of an hour)
near(utMin(d.meridianPassage) / 60 + dr.lon / 15, 12, 0.25, 'LMT of meridian passage');

// as seen from a height of eye the Sun rises earlier and sets later, by a minute or so
const high = r.sunTimes(dr, t.zoneToJd(2018, 9, 10, 12, 0, 0, 5.5), r.dipDegrees(12));
assert.ok(high.rise! < d.rise! && high.set! > d.set!); near((d.rise! - high.rise!) * 1440, 0.5, 0.5, 'minutes earlier from 12 m');
near(r.dipDegrees(16), 0.0293 * 4, 1e-12);

// midnight sun: no rise or set, but meridian passage and the declination are there
const arctic = r.sunTimes({ lat: 80, lon: 0 }, t.zoneToJd(2018, 6, 21, 12, 0, 0, 0));
assert.equal(arctic.rise, null); assert.equal(arctic.set, null); assert.equal(arctic.riseBearing, null); assert.ok(arctic.meridianPassage > 0);

// amplitude and compass error
assert.equal(r.amplitude(80, 'rise'), 'E 10.0° N'); assert.equal(r.amplitude(100, 'rise'), 'E 10.0° S');
assert.equal(r.amplitude(260, 'set'), 'W 10.0° S'); assert.equal(r.amplitude(280, 'set'), 'W 10.0° N'); assert.equal(r.amplitude(90, 'rise'), 'E 0.0° S');
assert.equal(r.compassError(100, 98), 2); assert.equal(r.compassError(350, 10), -20); assert.equal(r.compassError(5, 355), 10); near(r.compassError(100.5, 98), 2.5, 1e-9);
const bearing = r.sunBearing(dr, d.rise!);
near(bearing.hc, -50 / 60, 0.001, 'altitude at rising'); near(bearing.zn, d.riseBearing!, 1e-9);

console.log('riseSet: all checks passed');
