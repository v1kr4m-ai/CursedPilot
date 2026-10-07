// Run: node data/fishtailPlot.check.ts
import assert from 'node:assert/strict';
import * as p from './fishtailPlot.ts';

const pts = [{ x: 0, y: 0 }, { x: 10.4, y: 300.6 }, { x: 250, y: 420 }, { x: 400, y: 900 }];
const text = p.encodePlot(pts, 1000.2);
assert.equal(text, '{"p":[[0,0],[10,301],[250,420],[400,900]],"g":1000}');
const back = p.decodePlot(text)!;
assert.deepEqual(back, { points: [[0, 0], [10, 301], [250, 420], [400, 900]], guide: 1000 });

// untrusted input
for (const bad of [undefined, '', 'nope', '{}', '{"p":[[0,0]],"g":1}', '{"p":[[0,0],[1,"x"]],"g":1}', '{"p":[[0,0],[1,2]],"g":"1"}', '{"p":"abc","g":1}', '{"p":[[0,0],[1,2,3]],"g":1}'])
  assert.equal(p.decodePlot(bad as string | undefined), null, String(bad));
assert.equal(p.decodePlot(JSON.stringify({ p: Array.from({ length: 300 }, () => [0, 0]), g: 1 })), null);

// the drawing: numbers only, three marks, own path starts at the start point
const svg = p.plotSvg(back);
assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && !svg.includes('NaN') && !svg.includes('undefined'));
assert.equal((svg.match(/<circle/g) ?? []).length, 3); assert.ok(svg.includes('own ship') && svg.includes('guide'));
// a degenerate track (everything at one point) still draws
assert.ok(!p.plotSvg({ points: [[0, 0], [0, 0]], guide: 0 }).includes('NaN'));
// a track to port draws left of the start: the end mark's x is smaller than the start mark's x
const port = p.plotSvg({ points: [[0, 0], [-300, 200]], guide: 500 });
const cx = [...port.matchAll(/<circle cx="([\d.]+)"/g)].map(m => parseFloat(m[1]));
assert.ok(cx[1] < cx[0], `port end ${cx[1]} should be left of the start ${cx[0]}`);

console.log('fishtailPlot: all checks passed');
