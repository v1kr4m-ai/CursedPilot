// Run: node tools/rasApproach.check.ts   (worked against the bridge's own surge sheets: SKBDL and light jackstay, SDA as Guide, SNY approaching)
import assert from 'node:assert/strict';
import * as r from './rasApproach.ts';

const near = (a: number, b: number, tol: number, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);

// SKBDL with SDA: SDA's bridge 32.8 m from her stem and 69 m from her stern (101.8 m); SNY's bridge 32.4 m from her stem; 42 m apart; surge 25 yd a knot
const sda: r.Dims = { bridge: 32.8, length: 101.8 }, sny: r.Dims = { bridge: 32.4, ras: 24.6 };
const skbdl = (approachSpeed: number) => r.plan({ evolution: 'SKBDL', guide: sda, approach: sny, guideSpeed: 12, approachSpeed, surgeYdPerKnot: 25, separationM: 42, standbyYd: 500 })!;
const at18 = skbdl(18);
near(at18.advantage, 6, 1e-9); near(at18.surgeYd, 150, 1e-9); near(at18.surgeM, 137.16, 1e-9);              // 25 x 6 = 150 yd = 137.16 m
near(at18.pointToStern, 69, 1e-9);
near(at18.xM, 35.76, 1e-9, 'x = surge - 69 - 32.4');                                                          // the sheet: x = 137.16 - 101.4 = 35.76 m
near(at18.thetaDeg, 58.34, 0.03, 'theta = atan((32.4 + 35.76) / 42)');                                       // the sheet: 58.34 deg at 18 kn
const at16 = skbdl(16);                                                                                        // 4 kn: 100 yd = 91.44 m, so x is negative: overlapping
near(at16.xM, 91.44 - 101.4, 1e-9); assert.ok(at16.xM < 0);
near(at16.thetaDeg, Math.atan((32.4 + 91.44 - 101.4) / 42) * 180 / Math.PI, 1e-9);

// light jackstay with SDA (RAS points): SDA's RAS point 73.95 m from her stern, SNY's 24.6 m from her stem; at 4 kn advantage
const sdaRas: r.Dims = { bridge: 32.8, ras: 101.8 - 73.95, length: 101.8 };
const jack = r.plan({ evolution: 'RASAP', guide: sdaRas, approach: sny, guideSpeed: 12, approachSpeed: 16, surgeYdPerKnot: 25, separationM: 42, standbyYd: 500 })!;
near(jack.pointToStern, 73.95, 1e-9);
near(jack.xM, 91.44 - 73.95 - 24.6, 1e-9);                                                                    // the sheet: x = 91 - 98.55 = -7.55 m (overlap)
near(jack.thetaDeg, Math.atan((jack.xM + 32.4) / 42) * 180 / Math.PI, 1e-9);                                  // the sheet: atan(25 / 42) = 30.5 deg
near(jack.thetaDeg, 31.06, 0.05);

// several speed advantages at once, as on the sheet
const table = r.sweep({ evolution: 'RASAP', guide: sdaRas, approach: sny, guideSpeed: 12, approachSpeed: 16, surgeYdPerKnot: 25, separationM: 42, standbyYd: 500 }, [4, 5, 6]);
assert.deepEqual(table.map(t => Math.round(t.plan!.surgeYd)), [100, 125, 150]);
assert.ok(table[0].plan!.thetaDeg < table[1].plan!.thetaDeg && table[1].plan!.thetaDeg < table[2].plan!.thetaDeg);   // a bigger surge: start slowing further back, her stern further forward

// from own radar, 20 m from her stem: her stern at x + 20 along and 42 m across
assert.equal(at18.radar, undefined);
const withRadar = r.plan({ evolution: 'SKBDL', guide: sda, approach: { ...sny, radar: 20 }, guideSpeed: 12, approachSpeed: 18, surgeYdPerKnot: 25, separationM: 42, standbyYd: 500 })!;
near(withRadar.radar!.rangeM, 35.76 + 20, 1e-9);   // along the ship from the radar, not the slant across to her near(withRadar.radar!.thetaDeg, Math.atan2(55.76, 42) * 180 / Math.PI, 1e-9);

// the final station and the run in
near(at18.stemOffsetM, 32.4 - 32.8, 1e-9);                                                                     // bridges abreast: SNY's stem 0.4 m astern of SDA's
near(at18.runYd, 350, 1e-9); near(at18.runMinutes, 350 / 200, 1e-9); assert.equal(at18.atOnce, false);       // from 500 yd: 6 kn is 200 yd a minute
assert.equal(r.plan({ evolution: 'SKBDL', guide: sda, approach: sny, guideSpeed: 12, approachSpeed: 18, surgeYdPerKnot: 25, separationM: 42, standbyYd: 100 })!.atOnce, true);

// different points: with the points abreast the approach ship's stem is (her point - the Guide's point) ahead
const g: r.Dims = { bridge: 40, ras: 70, fuel: 90, breadth: 16, length: 150 }, a: r.Dims = { bridge: 45, ras: 60, fuel: 80, breadth: 14 };
const base = { guide: g, approach: a, guideSpeed: 12, approachSpeed: 18, surgeYdPerKnot: 33, separationM: 42, standbyYd: 500 };
near(r.plan({ ...base, evolution: 'RASAP' })!.stemOffsetM, -10, 1e-9);
near(r.plan({ ...base, evolution: 'SKBDL' })!.stemOffsetM, 5, 1e-9);
near(r.plan({ ...base, evolution: 'UNREP' })!.pointToStern, 60, 1e-9);

// missing figures are named (the Guide's length is needed for her point to her stern); no speed advantage gives no plan
assert.deepEqual(r.plan({ ...base, evolution: 'UNREP', guide: { bridge: 40 } })!.missing, ["the Guide's fuelling point", "the Guide's length"]);
assert.equal(r.plan({ ...base, evolution: 'RASAP', approachSpeed: 10 }), null);
// the bearing is taken from right ahead and given as a true bearing (both ships on the Guide's course): 90 - theta toward her side
near(at18.aheadDeg, 90 - 58.34, 0.03);
near(r.trueFromAhead(31.66, 0, 'Starboard'), 31.66, 1e-9); near(r.trueFromAhead(31.66, 0, 'Port'), 328.34, 1e-9); near(r.trueFromAhead(40, 350, 'Starboard'), 30, 1e-9);
// own bridge and radar and the Guide's stern are on the centre lines, the rigs on the inner edges: across = the gap between the sides + half of each breadth
const wide = r.plan({ evolution: 'SKBDL', guide: { ...sda, breadth: 12 }, approach: { ...sny, breadth: 14, radar: 20 }, guideSpeed: 12, approachSpeed: 18, surgeYdPerKnot: 25, separationM: 42, standbyYd: 500 })!;
near(wide.acrossM, 42 + 7 + 6, 1e-9);
near(wide.thetaDeg, Math.atan2(35.76 + 32.4, 55) * 180 / Math.PI, 1e-9); near(wide.radar!.aheadDeg, 90 - Math.atan2(55.76, 55) * 180 / Math.PI, 1e-9);
near(at18.acrossM, 42, 1e-9);   // no breadths given: the gap alone, as the sheets work it
console.log('rasApproach: all checks passed');
