// Run: node tools/toolMemory.check.ts
import assert from 'node:assert/strict';
import { createMemory, PREF } from './toolMemory.ts';

const fake = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

// values are remembered and survive a "restart" (a new store over the same storage)
const s = fake();
let mem = createMemory(s);
assert.equal(mem.get('a', 'x'), 'x'); assert.ok(mem.isEmpty());
mem.set('a', '12'); mem.set('b', { k: 1 });
assert.equal(mem.get('a', 'x'), '12');
mem = createMemory(s);
assert.equal(mem.get('a', 'x'), '12'); assert.deepEqual(mem.get('b', null), { k: 1 });

// every change notifies subscribers and yields a new snapshot object; no-op writes do not
let calls = 0; const off = mem.subscribe(() => { calls++; });
const before = mem.snapshot();
mem.set('a', '12'); assert.equal(calls, 0); assert.equal(mem.snapshot(), before);           // same value: nothing happens
mem.set('a', '13'); assert.equal(calls, 1); assert.notEqual(mem.snapshot(), before);
off(); mem.set('a', '14'); assert.equal(calls, 1);                                          // unsubscribed

// clear all
mem.clear(); assert.ok(mem.isEmpty()); assert.equal(mem.get('a', 'gone'), 'gone');
assert.equal(createMemory(s).get('a', 'gone'), 'gone');                                      // and stays cleared after a restart
calls = 0; mem.subscribe(() => { calls++; }); mem.clear(); assert.equal(calls, 0);          // clearing an empty store is quiet

// bad storage never breaks anything
const bad = { getItem: () => '{not json', setItem: () => { throw new Error('quota'); } };
const m2 = createMemory(bad); m2.set('x', 1); assert.equal(m2.get('x', 0), 1);               // still works in memory when saving fails
assert.ok(createMemory({ getItem: () => '[1,2]', setItem: () => undefined }).isEmpty());     // an array is not a store
assert.ok(createMemory(null).isEmpty());

// preferences (like a tool's length unit) are remembered but are not "entries": clear-all leaves them alone
const s3 = fake(); const p = createMemory(s3);
p.set(`${PREF}tsd:unit`, 'yards'); assert.ok(p.isEmpty());                                   // nothing to clear yet
p.set('tsd:fields', { d: '5' }); assert.ok(!p.isEmpty());
let notified = 0; p.subscribe(() => { notified++; });
p.clear(); assert.equal(p.get(`${PREF}tsd:unit`, 'cables'), 'yards'); assert.equal(p.get('tsd:fields', null), null); assert.equal(notified, 1);
assert.equal(createMemory(s3).get(`${PREF}tsd:unit`, 'cables'), 'yards');                    // and the preference survives a restart
p.clear(); assert.equal(notified, 1);                                                        // clearing again is quiet

console.log('toolMemory: all checks passed');
