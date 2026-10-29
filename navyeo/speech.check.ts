// Run: node navyeo/speech.check.ts
import assert from 'node:assert/strict';
import { speakable } from './speech.ts';

assert.equal(speakable('Steer 044° by compass'), 'Steer zero four four degrees by compass');
assert.equal(speakable('Steer 090° at 12 kn'), 'Steer zero niner zero degrees at 12 knots');
assert.equal(speakable('1° at 1 nm is 33.3 yd across (30.5 m)'), '1 degree at 1 nautical mile is 33.3 yards across, 30.5 metres');
assert.equal(speakable('CPA 0.82 nm in 14 min; relative speed 20 kn on 180°.'), 'CPA 0.82 nautical miles in 14 min. relative speed 20 knots on one eight zero degrees.');
assert.equal(speakable('2° at 3 cables is 20 yd'), '2 degrees at 3 cables is 20 yards');
assert.equal(speakable('1.5 t/h and 20 t of fuel'), '1.5 tonnes an hour and 20 tonnes of fuel');
assert.equal(speakable('L = R × angle / 60'), 'L = R times angle over 60');
assert.equal(speakable('1° 30.0′'), '1 degree 30.0 minutes');
assert.equal(speakable('nothing to change here'), 'nothing to change here');
console.log('speech: all checks passed');
