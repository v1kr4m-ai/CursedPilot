// Run: node navyeo/layout.check.ts
import assert from 'node:assert/strict';
import * as l from './layout.ts';

const VW = 375, VH = 812;

// the icon is kept fully on screen
assert.deepEqual(l.clampPos({ x: -50, y: -50 }, VW, VH), { x: 8, y: 8 });
assert.deepEqual(l.clampPos({ x: 9999, y: 9999 }, VW, VH), { x: VW - l.ICON - 8, y: VH - l.ICON - 8 });
assert.deepEqual(l.clampPos({ x: 100, y: 200 }, VW, VH), { x: 100, y: 200 });
assert.deepEqual(l.defaultPos(VW, VH), { x: 375 - 56 - 16, y: 812 - 56 - 96 });
// even on a tiny screen the position stays valid
const tiny = l.clampPos({ x: 500, y: 500 }, 40, 40); assert.ok(Number.isFinite(tiny.x) && tiny.x >= 8);

// the panel is centred and always fits, wherever the icon is
let r = l.centredPanel(VW, VH);
assert.equal(r.width, 359); assert.equal(r.left, 8); assert.equal(r.maxHeight, VH - 16);              // phone: spans the screen with an 8 px margin
r = l.centredPanel(1200, 800); assert.equal(r.width, 380); assert.equal(r.left, (1200 - 380) / 2); assert.equal(r.maxHeight, 784);
r = l.centredPanel(300, 120); assert.ok(r.width > 0 && r.maxHeight >= l.PANEL_MIN_HEIGHT);               // absurdly small window: still sane
for (const [vw, vh] of [[375, 812], [320, 480], [1200, 800], [800, 360]]) {
  const q = l.centredPanel(vw, vh);
  assert.ok(q.left >= 8 && q.left + q.width <= vw - 8, `${vw}x${vh} horizontal`);
  assert.ok(q.maxHeight <= vh - 16 || q.maxHeight === l.PANEL_MIN_HEIGHT, `${vw}x${vh} vertical`);
}

// it grows from, and shrinks to, the icon: the origin is the icon centre in panel coordinates
const panel = l.centredPanel(VW, VH);
assert.deepEqual(l.growOrigin({ x: 303, y: 656 }, panel.left, 100), { x: 303 + 28 - 8, y: 656 + 28 - 100 });      // icon bottom-right
assert.deepEqual(l.growOrigin({ x: 8, y: 8 }, panel.left, 100), { x: 28, y: -64 });                              // icon top-left: origin lies outside the panel, above it

// dragging
assert.deepEqual(l.moved({ x: 100, y: 100 }, 30, -20, VW, VH), { x: 130, y: 80 });
assert.deepEqual(l.moved({ x: 100, y: 100 }, 5000, 5000, VW, VH), { x: VW - 64, y: VH - 64 });   // cannot be dragged off screen
assert.equal(l.isDrag(3, 3), false); assert.equal(l.isDrag(6, 0), true); assert.equal(l.isDrag(0, -7), true);

// stored position
assert.deepEqual(l.parsePos('{"x":10,"y":20}'), { x: 10, y: 20 });
for (const bad of [null, '', 'nope', '{"x":"a","y":1}', '{"x":1}', 'null']) assert.equal(l.parsePos(bad), null, String(bad));

console.log('navyeo layout: all checks passed');
