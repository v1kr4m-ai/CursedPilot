// A small, safe formula evaluator for the user-defined formulas: numbers, names, + - * / ^, brackets, a few functions.
// No eval and no access to anything but the variables passed in. `node tools/expr.check.ts` checks it.

export type Vars = Record<string, number>;

const FUNCS: Record<string, (x: number) => number> = {
  sin: x => Math.sin((x * Math.PI) / 180), cos: x => Math.cos((x * Math.PI) / 180), tan: x => Math.tan((x * Math.PI) / 180),
  cot: x => 1 / Math.tan((x * Math.PI) / 180),
  asin: x => (Math.asin(x) * 180) / Math.PI, acos: x => (Math.acos(x) * 180) / Math.PI, atan: x => (Math.atan(x) * 180) / Math.PI,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
};
const CONSTS: Vars = { pi: Math.PI };
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);       // not "constructor", "__proto__" and the like

/** Evaluates the formula (angles in degrees in sin, cos, tan, cot and what asin, acos, atan give back). Returns the number, or an error message. */
export function evaluate(src: string, vars: Vars): { value: number } | { error: string } {
  const toks = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_]\w*|\S/g) ?? [];
  let i = 0;
  const fail = (m: string): never => { throw new Error(m); };
  const peek = () => toks[i];
  const expect = (t: string) => { if (toks[i] !== t) fail(`Expected "${t}"`); i++; };

  // expr = term (('+'|'-') term)* ; term = unary (('*'|'/') unary)* ; unary = '-' unary | power ; power = atom ('^' unary)?
  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = toks[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term(): number {
    let v = unary();
    while (peek() === '*' || peek() === '/') { const op = toks[i++]; const r = unary(); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function unary(): number {
    if (peek() === '-') { i++; return -unary(); }
    if (peek() === '+') { i++; return unary(); }
    return power();
  }
  function power(): number {
    const base = atom();
    if (peek() === '^') { i++; return Math.pow(base, unary()); }
    return base;
  }
  function atom(): number {
    const t = toks[i++];
    if (t === undefined) return fail('The formula ends too soon');
    if (/^[\d.]/.test(t)) { const n = parseFloat(t); return Number.isFinite(n) ? n : fail(`"${t}" is not a number`); }
    if (t === '(') { const v = expr(); expect(')'); return v; }
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === '(' && own(FUNCS, t.toLowerCase())) { i++; const v = expr(); expect(')'); return FUNCS[t.toLowerCase()](v); }
      if (own(vars, t)) return vars[t];
      if (own(CONSTS, t.toLowerCase())) return CONSTS[t.toLowerCase()];
      return fail(`Unknown name "${t}"`);
    }
    return fail(`Unexpected "${t}"`);
  }
  try {
    if (!toks.length) return { error: 'Enter a formula' };
    const v = expr();
    if (i < toks.length) return { error: `Unexpected "${toks[i]}"` };
    return Number.isFinite(v) ? { value: v } : { error: 'The formula gives no number for these values' };
  } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
}

/** The names a formula uses (not the functions and constants), so a tool can say which of its values are still missing. */
export function names(src: string): string[] {
  const text = src.replace(/√/g, 'sqrt'), out: string[] = [], re = /[A-Za-z_]\w*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[0], low = t.toLowerCase(), next = text.slice(re.lastIndex).trimStart()[0];
    if ((own(FUNCS, low) && next === '(') || own(CONSTS, low) || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}
