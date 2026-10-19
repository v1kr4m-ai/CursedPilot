import React from 'react';
import { evaluate, names } from './expr';
import { Card, Field, Result, Warn, useMemory } from './kit';
import { PREF } from './toolMemory';

// "My own formula" for a tool: the user types a formula in the names the tool offers (its inputs and answers, in the units
// shown) and the tool works it out. The formula is kept on the phone for next time, and survives clear-all.

export interface FormulaVar { name: string; label: string; value: number | null }

const show = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toPrecision(5) : String(Math.round(v * 10000) / 10000));

export const OwnFormula: React.FC<{ id: string; vars: FormulaVar[]; unitHint?: string }> = ({ id, vars, unitHint }) => {
  const [expr, setExpr] = useMemory<string>(`${PREF}ownf:${id}:expr`, '');
  const [unit, setUnit] = useMemory<string>(`${PREF}ownf:${id}:unit`, unitHint ?? '');
  const [title, setTitle] = useMemory<string>(`${PREF}ownf:${id}:title`, '');
  const have: Record<string, number> = {};
  vars.forEach(v => { if (v.value !== null && Number.isFinite(v.value)) have[v.name] = v.value; });

  const used = names(expr);
  const missing = vars.filter(v => used.includes(v.name) && !(v.name in have));
  const r = expr.trim() === '' || missing.length ? null : evaluate(expr, have);

  return (
    <Card title="My own formula" closed note="Use the names below with + − * / ^ ( ), sqrt( ), sin( ), cos( ), tan( ), cot( ), asin( ), acos( ), atan( ), ln( ), log( ), exp( ), abs( ) and pi. Angles are in degrees. The formula is kept for next time.">
      <Field label="Formula" text hint="e.g. d / s * 60" value={expr} onChange={setExpr} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name of the answer" text hint="Result" value={title} onChange={setTitle} />
        <Field label="Unit" text hint="e.g. min" value={unit} onChange={setUnit} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {vars.map(v => (
          <button type="button" key={v.name} onClick={() => setExpr(expr + (expr && !/[\s(+\-*/^]$/.test(expr) ? ' ' : '') + v.name)}
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-600 active:scale-95" title={`Add ${v.name} to the formula`}>
            <span className="text-blue-600">{v.name}</span> = {v.value === null ? '—' : show(v.value)} <span className="text-slate-400 font-medium">{v.label}</span>
          </button>
        ))}
      </div>
      {missing.length > 0 && <p className="text-xs font-medium text-slate-500">Enter {missing.map(m => m.label).join(', ')} above first.</p>}
      {r && 'error' in r && <Warn>{r.error}</Warn>}
      {r && 'value' in r && <Result rows={[[title.trim() || 'Result', `${show(r.value)}${unit.trim() ? ` ${unit.trim()}` : ''}`]]} />}
    </Card>
  );
};
