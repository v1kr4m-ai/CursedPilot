// Run: node tools/tides.check.ts
import assert from 'node:assert/strict';
import * as td from './tides.ts';
import { julianDay } from './sunEphemeris.ts';

const near = (a: number, b: number, tol = 1e-6, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
const hw: td.Tide = { t: 0, h: 5 }, lw: td.Tide = { t: 6, h: 1 };       // 6 h fall of 4 m: each hour is a "sixth"

// rule of twelfths: 1/12, 2/12, 3/12, 3/12, 2/12, 1/12 of 4 m in successive hours
const twelfth = [4 / 12, 8 / 12, 12 / 12, 12 / 12, 8 / 12, 4 / 12];
let h = 5; twelfth.forEach((d, i) => { h -= d; near(td.heightAt(hw, lw, i + 1, 'twelfths'), h, 1e-9, `hour ${i + 1}`); });
near(td.heightAt(hw, lw, 3, 'twelfths'), 3, 1e-9);                      // half-tide at mid-time
near(td.heightAt(hw, lw, 3, 'cosine'), 3, 1e-9);
near(td.heightAt(hw, lw, 1, 'cosine'), 3 + 2 * Math.cos(Math.PI / 6), 1e-9);
near(td.heightAt(hw, lw, 0, 'cosine'), 5); near(td.heightAt(hw, lw, 6, 'cosine'), 1);
// rising tide, the other way round
near(td.heightAt({ t: 0, h: 1 }, { t: 6, h: 5 }, 2, 'twelfths'), 1 + 4 * 3 / 12, 1e-9);
// inverse
for (const m of ['twelfths', 'cosine'] as const) for (const t of [0.5, 1.7, 3, 4.2, 5.9]) near(td.timeAt(hw, lw, td.heightAt(hw, lw, t, m), m)!, t, 1e-6, `${m} inverse ${t}`);
assert.equal(td.timeAt(hw, lw, 6, 'cosine'), null); assert.equal(td.timeAt(hw, lw, 0, 'twelfths'), null);
// rate: fastest in the middle, nil at the turn, falling is negative
assert.ok(td.rateAt(hw, lw, 3, 'cosine') < td.rateAt(hw, lw, 0.05, 'cosine')); near(td.rateAt(hw, lw, 3, 'twelfths'), -1, 1e-6, 'twelfths mid rate');
near(td.rateAt(hw, lw, 3, 'cosine'), -2 * Math.PI / 6, 1e-4); assert.ok(td.rateAt({ t: 0, h: 1 }, { t: 6, h: 5 }, 3, 'cosine') > 0);

// Moon: new Moon 2024-04-08 18:21 UT, full Moon 2024-04-23 23:49 UT, first quarter 2024-04-15 19:13 UT
const jd = (d: number, hr: number, mi: number) => julianDay(2024, 4, d, hr, mi, 0);
let p = td.moonPhase(jd(8, 18, 21)); near(((p.elongation + 180) % 360) - 180, 0, 0.6, 'new Moon elongation'); assert.equal(p.kind, 'spring'); assert.equal(p.name, 'New Moon');
p = td.moonPhase(jd(23, 23, 49)); near(p.elongation, 180, 0.6, 'full Moon'); assert.equal(p.kind, 'spring'); assert.equal(p.name, 'Full Moon');
p = td.moonPhase(jd(15, 19, 13)); near(p.elongation, 90, 0.6, 'first quarter'); assert.equal(p.kind, 'neap'); assert.equal(p.name, 'first quarter');
p = td.moonPhase(jd(12, 0, 0)); assert.equal(p.kind, 'between'); assert.equal(p.trend, 'falling off');          // 3.7 days after the new Moon, running down to the neaps
console.log('tides: all checks passed');
