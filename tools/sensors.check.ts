// Run: node tools/sensors.check.ts
import assert from 'node:assert/strict';
import * as s from './sensors.ts';

const near = (a: number, b: number, tol = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
// phone flat: alpha is how far the phone's top is turned anticlockwise from north, so heading = 360 - alpha
near(s.compassHeading(0, 0, 0), 0); near(s.compassHeading(90, 0, 0), 270); near(s.compassHeading(270, 0, 0), 90); near(s.compassHeading(180, 0, 0), 180);
// held upright, the heading is the way the back camera looks
near(s.compassHeading(0, 90, 0), 0); near(s.compassHeading(90, 90, 0), 270); near(s.compassHeading(270, 90, 0), 90); near(s.compassHeading(180, 90, 0), 180);
for (const a of [0, 45, 135, 300]) near(s.compassHeading(a, 0, 0), (360 - a) % 360, 1e-9, `flat ${a}`);
near(s.compassHeading(40, 10, 8), s.compassHeading(40, 0, 0), 1e-9, 'a slight tilt does not move the heading of the top');
near(s.circularMean([359, 1]).mean, 0, 1e-9); near(s.circularMean([10, 20, 30]).mean, 20, 1e-9); near(s.circularMean([350, 10]).spread, 10, 0.1);
assert.ok(Number.isNaN(s.circularMean([]).mean));
near(s.toKnots(s.fromKnots(12, 'kmh'), 'kmh'), 12); near(s.fromKnots(10, 'kmh'), 18.52); near(s.fromKnots(10, 'ms'), 5.14444, 1e-4); near(s.msToKnots(5.14444), 10, 1e-4);
assert.ok(s.isSpeedUnit('mph') && !s.isSpeedUnit('furlong'));
// true and relative bearings: magnetic 090, variation 3 E -> 093; ship's head 060 -> 033 on the starboard bow; 350 head -> Red 100 ... etc.
near(s.trueFromMagnetic(90, 3), 93); near(s.trueFromMagnetic(358, 5), 3); near(s.trueFromMagnetic(2, -5), 357);
assert.deepEqual(s.relativeTo(93, 60), { rel360: 33, off: 33, side: 'Starboard' });
assert.deepEqual(s.relativeTo(10, 60), { rel360: 310, off: 50, side: 'Port' });
assert.deepEqual(s.relativeTo(240, 60), { rel360: 180, off: 180, side: 'Starboard' });
assert.deepEqual(s.relativeTo(60, 60), { rel360: 0, off: 0, side: 'Starboard' });
console.log('sensors: all checks passed');
