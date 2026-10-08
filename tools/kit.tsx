import React, { useCallback, useSyncExternalStore } from 'react';
import * as nav from './navMath';
import { PREF, toolMemory } from './toolMemory';

// ---- shared bits ------------------------------------------------------------------------------

export const toNum = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

/** State that is remembered between uses (and across restarts) under `key`, until NavYeo's clear-all is pressed. */
export function useMemory<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const all = useSyncExternalStore(toolMemory.subscribe, toolMemory.snapshot);
  const value = key in all ? (all[key] as T) : initial;
  const set = useCallback((v: T | ((prev: T) => T)) => {
    const prev = toolMemory.get<T>(key, initial);
    toolMemory.set(key, typeof v === 'function' ? (v as (p: T) => T)(prev) : v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, set];
}

/** Text state for a set of number fields; `bind('speed')` gives Field its value/onChange. `id` names the tool for the memory. */
export function useForm<K extends string>(id: string, keys: readonly K[]) {
  const [v, setV] = useMemory<Record<K, string>>(`${id}:fields`, Object.fromEntries(keys.map(k => [k, ''])) as Record<K, string>);
  const bind = (k: K) => ({ value: v[k] ?? '', onChange: (s: string) => setV(prev => ({ ...prev, [k]: s })) });
  const n = (k: K) => toNum(v[k] ?? '');
  return { v: new Proxy(v, { get: (t, k) => (t as Record<string, string>)[k as string] ?? '' }) as Record<K, string>, bind, n };
}

export const Field: React.FC<{ label: string; unit?: string; value: string; onChange: (s: string) => void; hint?: string; text?: boolean; invalid?: boolean }> = ({ label, unit, value, onChange, hint, text, invalid }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}{unit && ` (${unit})`}</span>
    <input type={text ? 'text' : 'number'} inputMode={text ? 'text' : 'decimal'} step="any" value={value} onChange={e => onChange(e.target.value)} placeholder={hint}
      className={`w-full p-3 rounded-xl border bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400 ${invalid ? 'border-red-400' : 'border-slate-200'}`} />
  </label>
);

/** Small segmented choice, used where a tool has two modes. */
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${value === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
      ))}
    </div>
  );
}

export const Panel: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
    {children}
    {note && <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{note}</p>}
  </div>
);

export const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

/** The last length unit used in a tool, remembered per tool (a preference: clear-all keeps it). */
export function useUnit(tool: string, fallback: nav.LengthUnit = nav.DEFAULT_DISTANCE_UNIT): [nav.LengthUnit, (u: nav.LengthUnit) => void] {
  const [raw, set] = useMemory<string>(`${PREF}${tool}`, fallback);
  return [nav.isLengthUnit(raw) ? raw : fallback, (u: nav.LengthUnit) => set(u)];
}

export const SELECT = 'p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400';

/** A number field with a length-unit dropdown beside it. */
export const LengthField: React.FC<{ label: string; value: string; onChange: (s: string) => void; unit: nav.LengthUnit; onUnit: (u: nav.LengthUnit) => void; hint?: string }> = ({ label, value, onChange, unit, onUnit, hint }) => (
  <div className="block space-y-1">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <div className="flex gap-2">
      <input type="number" inputMode="decimal" step="any" value={value} placeholder={hint} aria-label={label} onChange={e => onChange(e.target.value)}
        className="min-w-0 flex-1 p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
      <select value={unit} onChange={e => onUnit(e.target.value as nav.LengthUnit)} aria-label={`${label} unit`} className={`${SELECT} w-[5.5rem] shrink-0`}>
        {nav.LENGTH_UNIT_KEYS.map(k => <option key={k} value={k} title={nav.LENGTH_UNITS[k].label}>{nav.LENGTH_UNITS[k].short}</option>)}
      </select>
    </div>
  </div>
);

/** A unit dropdown for answers (or for a group of fields that share a unit). */
export const UnitPick: React.FC<{ label: string; unit: nav.LengthUnit; onChange: (u: nav.LengthUnit) => void }> = ({ label, unit, onChange }) => (
  <label className="flex items-center justify-between gap-3">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <select value={unit} onChange={e => onChange(e.target.value as nav.LengthUnit)} className={`${SELECT} py-2 text-xs w-40`}>
      {nav.LENGTH_UNIT_KEYS.map(k => <option key={k} value={k}>{nav.LENGTH_UNITS[k].label}</option>)}
    </select>
  </label>
);

export const fromNm = (nm: number, unit: nav.LengthUnit) => nav.formatLength(nav.convertLength(nm, 'nm', unit), unit);

export const Result: React.FC<{ rows: [string, string][]; tone?: 'ok' | 'warn' }> = ({ rows, tone = 'ok' }) => (
  <div className={`p-3 rounded-xl text-white text-sm font-bold space-y-1 ${tone === 'warn' ? 'bg-amber-600' : 'bg-blue-600'}`}>
    {rows.map(([k, val]) => <div key={k} className="flex justify-between gap-3"><span className="opacity-80 font-semibold">{k}</span><span>{val}</span></div>)}
  </div>
);

export const Warn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl text-xs font-bold">{children}</div>
);

export const bearing = (d: number) => `${Math.round(nav.norm360(d)).toString().padStart(3, '0')}°`;
export const hhmm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60).toString().padStart(2, '0')}m`;

