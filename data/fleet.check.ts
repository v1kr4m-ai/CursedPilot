// Run: node data/fleet.check.ts
import assert from 'node:assert/strict';
import * as f from './fleet.ts';
import { CATALOG, CLASSES, NAVY_CATEGORIES } from './indianNavy.ts';
import type { Ship } from '../types.ts';

// ---- catalogue integrity
assert.ok(CATALOG.length > 120, `only ${CATALOG.length} ships`);
const ids = CATALOG.map(c => c.id);
assert.equal(new Set(ids).size, ids.length, 'catalogue ids must be unique');
const pennants = CATALOG.filter(c => c.pennant).map(c => c.pennant);
assert.equal(new Set(pennants).size, pennants.length, `pennants must be unique: ${pennants.filter((p, i) => pennants.indexOf(p) !== i)}`);
for (const c of CATALOG) {
  assert.ok((NAVY_CATEGORIES as readonly string[]).includes(c.cls.category), `${c.name}: bad category`);
  assert.match(c.commissioned, /^\d{4}(-\d{2})?$/, `${c.name}: bad date ${c.commissioned}`);
  assert.ok(c.cls.loa > 0 && c.cls.breadth > 0 && c.cls.tons > 0, `${c.name}: missing numbers`);
  assert.ok(c.cls.name && c.cls.displacement && c.cls.length, `${c.name}: missing class text`);
}
for (const cat of NAVY_CATEGORIES.filter(c => c !== 'Other')) assert.ok(CATALOG.some(c => c.cls.category === cat), `no ships in ${cat}`);
assert.ok(Object.keys(CLASSES).every(k => CATALOG.some(c => c.cls === CLASSES[k])), 'a class has no ships');

// ---- converting and merging
const kolkata = f.catalogToShip(CATALOG.find(c => c.name === 'Kolkata')!);
assert.equal(kolkata.name, 'INS Kolkata'); assert.equal(kolkata.type, 'Destroyers'); assert.equal(kolkata.info!.pennant, 'D63');
assert.equal(kolkata.particulars.lengthOverall, 163); assert.ok(kolkata.info!.wiki.includes('INS_Kolkata_(D63)'));
assert.equal(f.catalogToShip(CATALOG.find(c => c.name === 'INSV Mhadei')!).name, 'INSV Mhadei');

const custom: Ship = { id: 'mine', name: 'My Boat', type: 'Destroyer', particulars: { lengthOverall: 1, breadthOverall: 1, displacement: 1, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 }, turningDataSets: [], accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: [] };
const edited = { ...kolkata, name: 'INS Kolkata (edited)', info: { ...kolkata.info!, speed: '99 kn' } };
const merged = f.mergeCatalog([custom, edited]);
assert.equal(merged.length, CATALOG.length + 1);
assert.equal(merged.find(s => s.id === kolkata.id)!.name, 'INS Kolkata (edited)');                 // edits survive
assert.equal(merged.find(s => s.id === 'mine')!.type, 'Destroyers');                               // legacy category updated
assert.equal(f.mergeCatalog(merged).length, merged.length);                                       // idempotent
assert.equal(f.normalizeCategory('NOPVs'), 'Offshore Patrol Vessels'); assert.equal(f.normalizeCategory('Weird'), 'Other');

// ---- dates
assert.equal(f.formatCommissioned('2014-08'), 'Aug 2014'); assert.equal(f.formatCommissioned('2008'), '2008'); assert.equal(f.formatCommissioned('1 Jan 1990'), '1 Jan 1990');
assert.equal(f.commissionedKey('2014-08'), '2014-08'); assert.equal(f.commissionedKey('2008'), '2008-00');
assert.equal(f.commissionedKey('Commissioned 5 Mar 1999'), '1999-03'); assert.equal(f.commissionedKey('unknown'), '');

// ---- pins
let m = f.defaultMeta();
for (const id of ['a', 'b', 'c', 'd', 'e']) { const r = f.togglePin(m, id); assert.ok(r.ok); m = r.meta; }
assert.deepEqual(m.pinned, ['a', 'b', 'c', 'd', 'e']);
const sixth = f.togglePin(m, 'f'); assert.equal(sixth.ok, false); assert.deepEqual(sixth.meta.pinned, m.pinned);        // cap of 5
const unpinned = f.togglePin(m, 'c'); assert.ok(unpinned.ok); assert.deepEqual(unpinned.meta.pinned, ['a', 'b', 'd', 'e']);
assert.ok(f.togglePin(unpinned.meta, 'f').ok);                                                                         // a slot is free again

// ---- usage and My Ship
m = f.recordUse(f.recordUse(f.defaultMeta(), 'x', 100), 'x', 200);
assert.equal(m.usage.x, 2); assert.equal(m.lastUsed.x, 200);
assert.equal(f.setMyShip(m, 'x').myShipId, 'x');
const pr = f.pruneMeta({ ...m, pinned: ['x', 'gone'], myShipId: 'gone' }, [{ ...custom, id: 'x' }]);
assert.deepEqual(pr.pinned, ['x']); assert.equal(pr.myShipId, null);

// ---- ordering
const mk = (id: string, name: string, type: string, commissioned = ''): Ship => ({ ...custom, id, name, type, info: commissioned ? { ...kolkata.info!, commissioned, pennant: id.toUpperCase(), shipClass: 'Test class' } : undefined });
const fleet = [mk('s1', 'INS Zeta', 'Frigates', '2010-01'), mk('s2', 'INS Alpha', 'Destroyers', '2020-05'), mk('s3', 'INS Mid', 'Frigates', '2015'), mk('s4', 'INS Beta', 'Submarines'), mk('s5', 'INS Gamma', 'Destroyers', '1990-02')];
const names = (g: f.ShipGroup[]) => g.flatMap(x => x.ships.map(s => s.name));

let o = f.orderShips(fleet, { ...f.defaultMeta(), sort: 'category' }, '');
assert.deepEqual(o.groups.map(g => g.title), ['Destroyers', 'Frigates', 'Submarines']);                 // category order, not alphabetical
assert.deepEqual(names(o.groups), ['INS Alpha', 'INS Gamma', 'INS Mid', 'INS Zeta', 'INS Beta']);

const base = f.defaultMeta();
assert.deepEqual(names(f.orderShips(fleet, { ...base, sort: 'name' }, '').groups), ['INS Alpha', 'INS Beta', 'INS Gamma', 'INS Mid', 'INS Zeta']);
assert.deepEqual(names(f.orderShips(fleet, { ...base, sort: 'used', usage: { s3: 5, s1: 2 } }, '').groups).slice(0, 2), ['INS Mid', 'INS Zeta']);
assert.deepEqual(names(f.orderShips(fleet, { ...base, sort: 'recent', lastUsed: { s5: 10, s2: 99 } }, '').groups).slice(0, 2), ['INS Alpha', 'INS Gamma']);
assert.deepEqual(names(f.orderShips(fleet, { ...base, sort: 'newest' }, '').groups), ['INS Alpha', 'INS Mid', 'INS Zeta', 'INS Gamma', 'INS Beta']);   // undated last

// pinned come first in pin order and are not repeated below; filters apply to them too
o = f.orderShips(fleet, { ...base, sort: 'name', pinned: ['s5', 's1'] }, '');
assert.deepEqual(o.pinned.map(s => s.name), ['INS Gamma', 'INS Zeta']); assert.deepEqual(names(o.groups), ['INS Alpha', 'INS Beta', 'INS Mid']);
o = f.orderShips(fleet, { ...base, pinned: ['s5', 's1'], category: 'Frigates' }, ''); assert.deepEqual(o.pinned.map(s => s.name), ['INS Zeta']);
o = f.orderShips(fleet, { ...base, sort: 'name' }, 'TEST CLASS'); assert.equal(names(o.groups).length, 4);                    // search by class
o = f.orderShips(fleet, { ...base, sort: 'name' }, 's2'); assert.deepEqual(names(o.groups), ['INS Alpha']);                    // search by pennant
o = f.orderShips(fleet, { ...base, sort: 'name' }, 'zzz'); assert.deepEqual([o.pinned.length, o.groups.length], [0, 0]);

// ---- untrusted meta (storage, backup files) is cleaned
const dirty = f.sanitizeMeta({ pinned: ['a', 'a', 7, 'b', 'c', 'd', 'e', 'f'], usage: { x: 3, y: 'no', z: NaN }, lastUsed: [], myShipId: 5, sort: 'bogus', category: 9 });
assert.deepEqual(dirty.pinned, ['a', 'b', 'c', 'd', 'e']);                 // strings only, no repeats, capped at 5
assert.deepEqual(dirty.usage, { x: 3 }); assert.deepEqual(dirty.lastUsed, {}); assert.equal(dirty.myShipId, null);
assert.equal(dirty.sort, 'category'); assert.equal(dirty.category, null);
assert.deepEqual(f.sanitizeMeta(null), f.defaultMeta()); assert.deepEqual(f.sanitizeMeta('x'), f.defaultMeta());
const good = { ...f.defaultMeta(), pinned: ['a'], usage: { a: 2 }, lastUsed: { a: 9 }, myShipId: 'a', sort: 'used' as const, category: 'Frigates' };
assert.deepEqual(f.sanitizeMeta(JSON.parse(JSON.stringify(good))), good);   // a valid one survives a round trip unchanged

console.log('fleet: all checks passed');
