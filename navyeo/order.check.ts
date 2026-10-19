// Run: node navyeo/order.check.ts
import assert from 'node:assert/strict';
import { arrange, moveTo, parseOrder, togglePin } from './order.ts';

const names = ['A', 'B', 'C', 'D', 'E'];
assert.deepEqual(arrange(names, { order: [], pinned: [] }), names);
assert.deepEqual(arrange(names, { order: ['C', 'A'], pinned: [] }), ['C', 'A', 'B', 'D', 'E']);          // saved order first, new ones after
assert.deepEqual(arrange(names, { order: ['C', 'A'], pinned: ['D'] }), ['D', 'C', 'A', 'B', 'E']);        // pinned in front
assert.deepEqual(arrange(['A', 'B'], { order: ['Z', 'B'], pinned: ['Y'] }), ['B', 'A']);                    // tools that no longer exist are dropped
assert.deepEqual(moveTo(names, 'D', 'B', []), ['A', 'D', 'B', 'C', 'E']);
assert.deepEqual(moveTo(names, 'A', 'C', []), ['B', 'C', 'A', 'D', 'E']);
assert.deepEqual(moveTo(names, 'A', 'A', []), names);
assert.deepEqual(moveTo(['P', 'A', 'B'], 'B', 'P', ['P']), ['P', 'B', 'A']);                               // an unpinned tile cannot pass a pinned one
assert.deepEqual(togglePin({ order: [], pinned: [] }, 'B').pinned, ['B']);
assert.deepEqual(togglePin({ order: [], pinned: ['B'] }, 'B').pinned, []);
assert.deepEqual(parseOrder('nonsense'), { order: [], pinned: [] });
assert.deepEqual(parseOrder('{"order":["A",3],"pinned":"x"}'), { order: ['A'], pinned: [] });
console.log('order: all checks passed');
