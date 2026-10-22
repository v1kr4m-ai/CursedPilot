// Run: node tools/turnLookup.check.ts
import assert from 'node:assert/strict';
import { lookupTurn } from './turnLookup.ts';
import type { Ship, TurningDataSet } from '../types.ts';

const near = (a: number, b: number, tol = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const row = (id: string, turnAmount: number, advance: number, transfer: number, time: string, speed: number | string) => ({ id, turnAmount, bearingMob: 0, angle: 0, rangeCables: 0, rangeYards: 0, advance, transfer, distToNewCourse: 0, time, speed });
const set = (testSpeed: number, wheelAngle: number, turnSide: 'Port' | 'Starboard', data: ReturnType<typeof row>[]): TurningDataSet => ({ testSpeed, wheelAngle, turnSide, data });
const ship = { turningDataSets: [
  set(12, 15, 'Starboard', [row('a', 30, 300, 100, '0:30', 11.5), row('b', 90, 450, 300, '1:10', 10.5)]),
  set(12, 30, 'Starboard', [row('a', 30, 200, 80, '0:20', 11), row('b', 90, 300, 220, '0:50', 9.5)]),
  set(18, 15, 'Starboard', [row('a', 30, 420, 150, '0:25', 16.5), row('b', 90, 640, 440, '1:00', 15.5)]),
  set(12, 15, 'Port', [row('a', 90, 400, 280, '1:05', '')]),
] } as Pick<Ship, 'turningDataSets'>;

// 12 kn, 60 degrees, the largest wheel recorded (30): midway between the 30 and 90 degree rows
const a = lookupTurn(ship, 'Starboard', 12, 60)!;
near(a.advance, 250); near(a.transfer, 150); near(a.seconds, 35); near(a.loss!, 1.75); assert.equal(a.wheel, 30); assert.deepEqual(a.wheels, [15, 30]); assert.equal(a.interpolatedSpeed, false);
// a chosen wheel: 15 degrees at 12 kn, 60 degrees -> advance 375, transfer 200, 50 s, 1.0 kn lost
const b = lookupTurn(ship, 'Starboard', 12, 60, 15)!;
near(b.advance, 375); near(b.transfer, 200); near(b.seconds, 50); near(b.loss!, 1.0); assert.equal(b.wheel, 15);
// 15 kn lies halfway between 12 and 18: the 15 degree wheel sets are averaged
const c = lookupTurn(ship, 'Starboard', 15, 60, 15)!;
near(c.advance, (375 + 530) / 2); near(c.transfer, (200 + 295) / 2); near(c.seconds, (50 + 42.5) / 2, 1e-9, 'time'); near(c.loss!, (1.0 + 2.0) / 2); assert.equal(c.interpolatedSpeed, true);
// outside the recorded speeds the nearest is used, and a turn beyond the table is flagged
assert.equal(lookupTurn(ship, 'Starboard', 25, 60, 15)!.speed, 18); assert.equal(lookupTurn(ship, 'Starboard', 5, 60, 15)!.speed, 12);
assert.equal(lookupTurn(ship, 'Starboard', 12, 120, 15)!.outsideTurn, true); assert.equal(lookupTurn(ship, 'Starboard', 12, 60, 15)!.outsideTurn, false);
// the side matters; a row with no speed after the turn gives no loss; no data gives nothing
const port = lookupTurn(ship, 'Port', 12, 90)!; assert.equal(port.loss, undefined); near(port.advance, 400);
assert.equal(lookupTurn({ turningDataSets: [] } as Pick<Ship, 'turningDataSets'>, 'Port', 12, 90), null); assert.equal(lookupTurn(undefined, 'Port', 12, 90), null);
console.log('turnLookup: all checks passed');
