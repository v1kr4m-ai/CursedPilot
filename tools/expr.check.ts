// Run: node tools/expr.check.ts
import assert from 'node:assert/strict';
import { evaluate } from './expr.ts';

const ok = (src: string, vars: Record<string, number>, want: number, tol = 1e-9) => {
  const r = evaluate(src, vars);
  assert.ok('value' in r, `${src}: ${'error' in r ? r.error : ''}`);
  assert.ok(Math.abs((r as { value: number }).value - want) <= tol, `${src} = ${(r as { value: number }).value}, wanted ${want}`);
};
const bad = (src: string, vars: Record<string, number> = {}) => assert.ok('error' in evaluate(src, vars), `${src} should be refused`);

ok('1 + 2 * 3', {}, 7); ok('(1 + 2) * 3', {}, 9); ok('2 ^ 3 ^ 2', {}, 512); ok('-2 ^ 2', {}, -4); ok('10 / 4', {}, 2.5); ok('3 - -2', {}, 5);
ok('2 * pi', {}, 2 * Math.PI); ok('H / tan(A)', { H: 40, A: 45 }, 40, 1e-9); ok('H * cot(A)', { H: 42.12, A: 0.79 }, 42.12 / Math.tan((0.79 * Math.PI) / 180), 1e-9);
ok('1.5 * sqrt(d)', { d: 36 }, 9); ok('√(h) * 2.08', { h: 16 }, 8.32); ok('acos(0.5)', {}, 60, 1e-9); ok('H/1852/tan(A)', { H: 18.52, A: 45 }, 0.01, 1e-12);
ok('1e2 + .5', {}, 100.5);
bad(''); bad('1 +'); bad('(1 + 2'); bad('foo + 1'); bad('1 2'); bad('sin(', {}); bad('1 / 0'); bad('process.exit()'); bad('H ** 2', { H: 1 }); bad('sqrt(-1)');
// no way out to anything but the variables
bad('constructor'); bad('__proto__'); bad('toString');
import { names } from './expr.ts';
assert.deepEqual(names('d / s * 60'), ['d', 's']); assert.deepEqual(names('sqrt(h) + sin(A) * pi'), ['h', 'A']); assert.deepEqual(names('1.5 * √(depth)'), ['depth']); assert.deepEqual(names(''), []);
assert.deepEqual(names('a + a * b'), ['a', 'b']);
console.log('expr: all checks passed');
