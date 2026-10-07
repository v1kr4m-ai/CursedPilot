// Run: node data/fishtails.check.ts
import assert from 'node:assert/strict';
import * as f from './fishtails.ts';

// stations: x to starboard, y ahead
assert.equal(f.stationOf(0, 500).name, 'Ahead'); assert.equal(f.stationOf(400, 0).name, 'Abeam Stbd'); assert.equal(f.stationOf(-400, 10).name, 'Abeam Port');
assert.equal(f.stationOf(100, -100).name, 'Quarter Stbd'); assert.equal(f.stationOf(0, -9).name, 'Astern'); assert.equal(f.stationOf(-300, 300).name, 'Bow Port');
assert.deepEqual(f.stationOf(0.2, 0.2), { name: 'On guide', index: -1 });

// own ship 400 yd abeam to starboard and level with the guide: lateral 400, drop 0
const fields = f.fishtailFields({ kind: 'Half', angles: [60, -60], speed: 12, wheel: '15', lateral: 400.4, drop: 0, finalX: 400.4 });
assert.deepEqual(fields, { kind: 'Half', angle: '60', speed: '12', wheel: '15', side: 'Starboard', station: 'Abeam Stbd', stationIdx: '2', lateral: '400', drop: '0' });
const dis = f.fishtailFields({ kind: 'Distorted', angles: [-50, 90, -40], speed: 15, wheel: '20', lateral: 10, drop: -300, finalX: -10 });
assert.equal(dis.angle, '50/40'); assert.equal(dis.side, 'Port'); assert.equal(dis.station, 'Ahead');   // negative drop = ahead of the guide

const rec = (id: string, date: string, fields?: Record<string, string>, description = '', value?: string) => ({ id, date, description, value, fields });

// the track rides along when there is one
const withPlot = f.fishtailFields({ kind: 'Half', angles: [60, -60], speed: 12, wheel: '15', lateral: 1, drop: 1, finalX: 1, plot: '{"p":[[0,0],[1,1]],"g":2}' });
assert.equal(withPlot.graph, '{"p":[[0,0],[1,1]],"g":2}'); assert.ok(!('graph' in fields));
assert.equal(f.fishtailRow({ id: 'g', date: '2026-10-01', description: '', fields: withPlot }).graph, '{"p":[[0,0],[1,1]],"g":2}');

// new records read straight from their values
const a = f.fishtailRow(rec('a', '2026-10-01', fields));
assert.deepEqual([a.kind, a.angle, a.speed, a.wheel, a.side, a.station, a.lateral, a.drop], ['Half', '60', 12, 15, 'Starboard', 'Abeam Stbd', 400, 0]);

// records saved by the calculator before values were kept are read from their text
const old = f.fishtailRow(rec('o', '2026-09-01', undefined, 'Calculated full fishtail (15 kn, 20° wheel, Port)', 'Full fishtail 45° · guide 12 kn · drop 87 yd, lateral 412 yd'));
assert.deepEqual([old.kind, old.angle, old.speed, old.wheel, old.side, old.station, old.lateral, old.drop], ['Full', '45', 15, 20, 'Port', '-', 412, 87]);
const old2 = f.fishtailRow(rec('p', '2026-09-02', undefined, 'Calculated distorted fishtail (9 kn, 10° wheel, Starboard)', 'Distorted fishtail 50° / 90° / 40° · guide 12 kn · drop -20 yd, lateral 5 yd'));
assert.deepEqual([old2.kind, old2.angle, old2.drop], ['Distorted', '50/90/40', -20]);

assert.equal(f.fishtailRow(rec('q', '2026-09-03', undefined, 'Calculated half fishtail (12 kn, 15° wheel, starboard)', 'Half fishtail 60° / 60° · guide 12 kn · drop 9 yd, lateral 3 yd')).angle, '60');

// hand-typed ones keep what they have; nothing throws on junk
const hand = f.fishtailRow(rec('h', '2026-08-01', { speed: '10', rudder: '15', overshoot: '', cycle: '' }));
assert.deepEqual([hand.speed, hand.wheel, hand.lateral], [10, 15, null]);
const junk = f.fishtailRow(rec('j', '2026-08-02', undefined, 'something else'));
assert.deepEqual([junk.kind, junk.speed, junk.station], ['-', null, '-']);

// sorting
const mk = (id: string, date: string, speed: number | null, wheel: number | null, side: string, idx: number): f.FishtailRow =>
  ({ id, date, kind: 'Half', angle: '60', speed, wheel, side, station: '', stationIdx: idx, lateral: 0, drop: 0 });
const rows = [mk('1', '2026-01-01', 15, 20, 'Starboard', 2), mk('2', '2026-02-01', 9, 30, 'Port', 0), mk('3', '2026-03-01', 15, 10, 'Port', 6), mk('4', '2026-04-01', null, null, '', 99)];
const ids = (by: f.FishtailSort) => f.sortFishtails(rows, by).map(r => r.id).join('');
assert.equal(ids('speed'), '2314');      // 9, then the two 15s by wheel, no speed last
assert.equal(ids('wheel'), '3124');
assert.equal(ids('side'), '2314');   // Port rows (by speed), then Starboard, blank last
assert.deepEqual(f.sortFishtails(rows, 'side').map(r => r.side), ['Port', 'Port', 'Starboard', '']);
assert.equal(ids('station'), '2134');
assert.equal(ids('date'), '4321');       // newest first
assert.equal(rows[0].id, '1');           // input untouched

console.log('fishtails: all checks passed');
