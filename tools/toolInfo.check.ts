// Run: node tools/toolInfo.check.ts - every NavYeo tool must have an explanation, and every explanation a tool.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOL_INFO } from './toolInfo.ts';

const registry = readFileSync(new URL('./NavTools.tsx', import.meta.url), 'utf8');
const toolNames = [...registry.matchAll(/\{ name: '([^']+)', short:/g)].map(m => m[1]);
assert.ok(toolNames.length >= 11, `found only ${toolNames.length} tools in NavTools.tsx`);

for (const name of toolNames) assert.ok(TOOL_INFO[name], `no explanation for "${name}"`);
for (const name of Object.keys(TOOL_INFO)) assert.ok(toolNames.includes(name), `explanation "${name}" matches no tool`);

for (const [name, i] of Object.entries(TOOL_INFO)) {
  assert.ok(i.concept.length > 40, `${name}: concept too short`);
  assert.ok(i.steps.length >= 1 && i.steps.every(s => s.trim().length > 10), `${name}: steps`);
  assert.ok(i.formulas.length >= 1 && i.formulas.every(s => s.trim().length > 3), `${name}: formulas`);
  assert.ok(i.limits.length >= 1 && i.limits.every(s => s.trim().length > 10), `${name}: limits`);
}

// the formulas quoted must be the ones the code uses: spot-check against navMath
const math = readFileSync(new URL('./navMath.ts', import.meta.url), 'utf8');
assert.ok(/2\.08 \* Math\.sqrt/.test(math) && /2\.21 \* Math\.sqrt/.test(math), 'horizon constants changed');
assert.ok(/advance - transfer \/ Math\.tan/.test(math), 'wheel-over formula changed');
assert.ok(TOOL_INFO['Distance Off & Horizon'].formulas.join(' ').includes('2.08') && TOOL_INFO['Distance Off & Horizon'].formulas.join(' ').includes('2.21'));
assert.ok(TOOL_INFO['Wheel-over Point'].formulas[0].includes('Advance − Transfer / tan(turn)'));
assert.ok(/baseline \/ 2 \/ Math\.tan\(rad\(angle \/ 2\)\)/.test(math) && TOOL_INFO['Horizontal Sextant Angle (HSA)'].formulas.join(' ').includes('tan(α / 2)'));

// the unit dropdowns and the object-length mode are explained
const lengthTools = ['Time / Speed / Distance', 'CPA / TCPA', 'Course to Steer', 'Distance Off & Horizon', 'Horizontal Sextant Angle (HSA)', 'Wheel-over Point', 'Radian Rule'];
for (const n of lengthTools) assert.ok(TOOL_INFO[n].limits.join(' ').includes('cables (the default)'), `${n}: no note on length units`);
assert.ok(TOOL_INFO['Horizontal Sextant Angle (HSA)'].steps.join(' ').includes('Object length mode') && TOOL_INFO['Horizontal Sextant Angle (HSA)'].formulas.join(' ').includes('Object length ='));
assert.ok(/objectLengthFromBearings[\s\S]*2 \* distance \* Math\.tan\(rad\(angle \/ 2\)\)/.test(math), 'object length formula changed');

console.log(`toolInfo: ${toolNames.length} tools explained, all checks passed`);
