// Run: node tools/tidePorts.check.ts
import assert from 'node:assert/strict';
import * as p from './tidePorts.ts';

const near = (a: number, b: number, tol = 1e-9, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not within ${tol} of ${b}`);
// nearest port: a position just off Mumbai and one off Chennai
assert.equal(p.nearestPort({ lat: 18.9, lon: 72.7 }, p.SEED_PORTS)!.port.name, 'Mumbai');
assert.equal(p.nearestPort({ lat: 13.0, lon: 80.5 }, p.SEED_PORTS)!.port.name, 'Chennai');
near(p.distanceNm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 60.04, 0.05, 'a degree of latitude');
assert.equal(p.nearestPort({ lat: 18, lon: 72 }, [{ name: 'No position' }]), null);

// a day's tides to a timeline, with the previous and next days either side
const day = (offset: number, tides: p.DayTide[]) => ({ offset, tides });
const tl = p.timeline([day(0, [{ time: '05:10', h: 4.2 }, { time: '11:30', h: 0.8 }, { time: '17:20', h: 4.5 }, { time: '23:40', h: 0.6 }]), day(-24, [{ time: '22:50', h: 0.7 }]), day(24, [{ time: '05:55', h: 4.3 }]), day(0, [{ time: 'junk', h: 1 }])]);
assert.equal(tl.length, 6); near(tl[0].t, -24 + 22 + 50 / 60); near(tl[1].t, 5 + 10 / 60); near(tl[5].t, 24 + 5 + 55 / 60);
assert.deepEqual(p.highWaters(tl), [false, true, false, true, false, true]);
assert.deepEqual(p.highWaters([{ t: 0, h: 1 }]), [false]);

// a secondary port: high water 25 min later and 0.3 m lower, low water 40 min later and 0.1 m lower
const sec: p.Port = { name: 'Sec', ref: 'Std', dtHw: 25, dtLw: 40, dhHw: -0.3, dhLw: -0.1 };
const sd = p.secondaryTides(tl, sec);
near(sd[1].t, 5 + 10 / 60 + 25 / 60); near(sd[1].h, 3.9); near(sd[2].t, 11.5 + 40 / 60); near(sd[2].h, 0.7);
near(p.secondaryTides(tl, { name: 'X', ref: 'Std' })[1].h, 4.2);                                   // no differences: unchanged

// the pair around a time, and the next high and low water
const pair = p.around(tl, 9)!; near(pair[0].h, 4.2); near(pair[1].h, 0.8);
assert.equal(p.around(tl, -30), null); assert.equal(p.around(tl, 40), null);
const nx = p.nextTides(tl, 9); near(nx.hw!.h, 4.5); near(nx.lw!.h, 0.8);
assert.equal(p.clockHours('0530'), 5.5); assert.equal(p.clockHours('25:00'), null); assert.equal(p.clockHours('05:30'), 5.5);
console.log('tidePorts: all checks passed');
