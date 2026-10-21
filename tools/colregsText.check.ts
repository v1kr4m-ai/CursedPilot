// Run: node tools/colregsText.check.ts
import assert from 'node:assert/strict';
import { RULE_TEXT } from './colregsText.ts';
import { groupedRules, ruleLabel } from './colregsInfo.ts';

const rules = RULE_TEXT.filter(r => r.kind === 'rule');
assert.deepEqual(rules.map(r => r.n), Array.from({ length: 41 }, (_, i) => i + 1));   // every Rule, 1 to 41, in order
for (const r of RULE_TEXT) assert.ok(r.blocks.length && r.blocks.every(b => b[2].trim().length > 3 || b[0] === 2 || b[1]), `rule ${r.n} empty`);
const text = (n: number) => RULE_TEXT.find(r => r.n === n)!.blocks.map(b => b[2]).join(' ');
assert.match(text(14), /alter her course to starboard/);
assert.match(text(15), /keep out of the way/);
assert.match(text(21), /225 degrees/); assert.match(text(21), /112.5 degrees/); assert.match(text(21), /135 degrees/);
assert.match(text(27), /two all-round red lights/); assert.match(text(35), /2 minutes/);
assert.match(text(39), /Audit means/); assert.match(text(40), /Code for Implementation/); assert.match(text(41), /periodic audits/);
assert.ok(RULE_TEXT.some(r => r.kind === 'annex' && r.n === 'IV'));
assert.equal(RULE_TEXT.find(r => r.n === 39)!.part, 'F');
assert.match(ruleLabel(13), /Part B.*Section II/); assert.match(ruleLabel(23), /Part C/); assert.match(ruleLabel(34), /Part D/);
assert.deepEqual(groupedRules().map(g => g.key), ['A', 'BI', 'BII', 'BIII', 'C', 'D', 'E', 'F', 'Annex']);
for (const r of RULE_TEXT) for (const b of r.blocks) assert.ok(!b[2].includes('\ufffd'), `rule ${r.n} has a bad character`);
console.log('colregsText: all checks passed');
