import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import * as nav from './navMath';
import { PREF, toolMemory } from './toolMemory';
import { Entry } from './entry';
import { BOX, BOX_INPUT, BOX_LABEL, boxTone } from './boxStyle';
export { BOX, BOX_INPUT, BOX_LABEL, boxTone } from './boxStyle';
import type { EntryKind } from './entry';
import { SensorField } from './SensorField';

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
export function useForm<K extends string>(id: string, keys: readonly K[], defaults?: Partial<Record<K, string>>) {
  const [v, setV] = useMemory<Record<K, string>>(`${id}:fields`, Object.fromEntries(keys.map(k => [k, ''])) as Record<K, string>);
  // `defaults` are the selected ship's own figures: a field left blank takes the ship's value, a typed value wins
  const eff = (k: string) => { const t = (v as Record<string, string>)[k] ?? ''; const d = (defaults as Record<string, string | undefined> | undefined)?.[k]; return t.trim() === '' && d !== undefined ? d : t; };
  const bind = (k: K) => ({ value: v[k] ?? '', onChange: (s: string) => setV(prev => ({ ...prev, [k]: s })), shipHint: defaults?.[k] });
  const n = (k: K) => toNum(eff(k));
  return { v: new Proxy(v, { get: (t, k) => eff(k as string) }) as Record<K, string>, bind, n };
}

/** Inside a field that has a value from the selected ship: what it is, and a way back to it after typing over it. */
export const ShipHint: React.FC<{ hint?: string; unit?: string; typed: boolean; onReset: () => void }> = ({ hint, unit, typed, onReset }) => hint === undefined ? null : (
  <span className="flex items-center justify-between gap-2 text-[9px] leading-tight font-bold text-emerald-600">
    <span>{typed ? 'Ship\'s value' : 'From the ship'}: {hint}{unit ? ` ${unit}` : ''}</span>
    {typed && <button type="button" onClick={onReset} className="underline underline-offset-2">use it</button>}
  </span>
);

export const Field: React.FC<{ label: string; unit?: string; value: string; onChange: (s: string) => void; hint?: string; text?: boolean; invalid?: boolean; kind?: EntryKind; wide?: boolean; sensor?: 'course' | 'speed'; units?: boolean; shipHint?: string }> = ({ label, unit, value, onChange, hint, text, invalid, kind, wide, sensor, units, shipHint }) => sensor || units ? (
  <SensorField label={label} unit={unit} value={value} onChange={onChange} invalid={invalid} sensor={sensor} units={units} />
) : kind ? (
  <Entry kind={kind} label={label} unit={unit} value={value} onChange={onChange} invalid={invalid} wide={wide} />
) : (
  <label className={`${BOX} ${boxTone(invalid, shipHint !== undefined && value.trim() === '')}`}>
    <span className={BOX_LABEL}>{label}{unit && ` (${unit})`}</span>
    <input type={text ? 'text' : 'number'} inputMode={text ? 'text' : 'decimal'} step="any" value={value} onChange={e => onChange(e.target.value)} placeholder={shipHint ?? hint} className={BOX_INPUT} />
    <ShipHint hint={shipHint} unit={unit} typed={value.trim() !== ''} onReset={() => onChange('')} />
  </label>
);

/** Small segmented choice, used where a tool has two modes. */
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`flex-1 py-1.5 rounded-xl text-xs font-bold border ${value === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
      ))}
    </div>
  );
}

/** A section of a tool. It folds up (and stays folded the way the user left it); `closed` starts it folded. */
export const Panel: React.FC<{ title: string; note?: string; children: React.ReactNode; closed?: boolean }> = ({ title, note, children, closed }) => (
  <Card title={title} note={note} closed={closed}>{children}</Card>
);

export const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

/** The last length unit used in a tool, remembered per tool (a preference: clear-all keeps it). */
export function useUnit(tool: string, fallback: nav.LengthUnit = nav.DEFAULT_DISTANCE_UNIT): [nav.LengthUnit, (u: nav.LengthUnit) => void] {
  const [raw, set] = useMemory<string>(`${PREF}${tool}`, fallback);
  return [nav.isLengthUnit(raw) ? raw : fallback, (u: nav.LengthUnit) => set(u)];
}

export const SELECT = 'px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400';

/** A number field with a length-unit dropdown beside it. */
export const LengthField: React.FC<{ label: string; value: string; onChange: (s: string) => void; unit: nav.LengthUnit; onUnit: (u: nav.LengthUnit) => void; hint?: string; shipHint?: string }> = ({ label, value, onChange, unit, onUnit, hint, shipHint }) => (
  <div className={`${BOX} ${boxTone(false, shipHint !== undefined && value.trim() === '')}`}>
    <span className={BOX_LABEL}>{label}</span>
    <div className="flex items-center gap-2">
      <input type="number" inputMode="decimal" step="any" value={value} placeholder={shipHint ?? hint} aria-label={label} onChange={e => onChange(e.target.value)} className={`${BOX_INPUT} min-w-0 flex-1`} />
      <select value={unit} onChange={e => onUnit(e.target.value as nav.LengthUnit)} aria-label={`${label} unit`} className="shrink-0 w-[4.2rem] h-6 -my-0.5 py-0 px-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 outline-none">
        {nav.LENGTH_UNIT_KEYS.map(k => <option key={k} value={k} title={nav.LENGTH_UNITS[k].label}>{nav.LENGTH_UNITS[k].short}</option>)}
      </select>
    </div>
    <ShipHint hint={shipHint} typed={value.trim() !== ''} onReset={() => onChange('')} />
  </div>
);

/** A unit dropdown for answers (or for a group of fields that share a unit). */
export const UnitPick: React.FC<{ label: string; unit: nav.LengthUnit; onChange: (u: nav.LengthUnit) => void }> = ({ label, unit, onChange }) => (
  <label className="flex items-center justify-between gap-3">
    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <select value={unit} onChange={e => onChange(e.target.value as nav.LengthUnit)} className={`${SELECT} py-1 text-xs w-40`}>
      {nav.LENGTH_UNIT_KEYS.map(k => <option key={k} value={k}>{nav.LENGTH_UNITS[k].label}</option>)}
    </select>
  </label>
);

export const fromNm = (nm: number, unit: nav.LengthUnit) => nav.formatLength(nav.convertLength(nm, 'nm', unit), unit);

/** Where NavYeo shows the results of the open tool: a header at the top of the tool that stays in view. Null outside NavYeo. */
export const ResultSlot = createContext<HTMLElement | null>(null);

/** An answer block. It appears in the result header at the top of the tool; `inline` keeps it where it is written (for lists that are not the answer). */
export const Result: React.FC<{ rows: [string, string][]; tone?: 'ok' | 'warn'; inline?: boolean }> = ({ rows, tone = 'ok', inline }) => {
  const slot = useContext(ResultSlot);
  const block = (
    <div className={`px-3 py-1.5 rounded-xl text-white text-[13px] leading-snug font-bold shadow-md ${tone === 'warn' ? 'bg-amber-600' : 'bg-blue-600'}`}>
      {rows.map(([k, val], i) => <div key={`${k}${i}`} className="flex justify-between gap-3"><span className="opacity-80 font-semibold">{k}</span><span className="text-right">{val}</span></div>)}
    </div>
  );
  return slot && !inline ? createPortal(block, slot) : block;
};

export const Warn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl text-xs font-bold">{children}</div>
);

export const bearing = (d: number) => `${Math.round(nav.norm360(d)).toString().padStart(3, '0')}°`;
export const hhmm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60).toString().padStart(2, '0')}m`;


/** Port / Starboard choice as two coloured buttons. */
export const SideToggle: React.FC<{ label: string; value: 'Port' | 'Starboard'; onChange: (v: 'Port' | 'Starboard') => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="shrink-0 text-[9px] font-bold text-slate-400 uppercase tracking-wider w-24 leading-tight">{label}</span>
    <div className="flex flex-1 gap-1">
      {(['Port', 'Starboard'] as const).map(sd => (
        <button type="button" key={sd} onClick={() => onChange(sd)} aria-pressed={value === sd}
          className={`flex-1 py-2 rounded-xl text-xs font-bold border ${value === sd ? (sd === 'Port' ? 'bg-red-600 border-red-600' : 'bg-green-600 border-green-600') + ' text-white' : 'bg-white text-slate-500 border-slate-200'}`}>{sd}</button>
      ))}
    </div>
  </div>
);

/** A section that folds up: a heading to tap, and the content under it. The way the user left it is remembered; the notes fold away under their own line. */
export const Card: React.FC<{ title: string; note?: string; children: React.ReactNode; closed?: boolean }> = ({ title, note, children, closed }) => {
  const [open, setOpen] = useMemory<boolean | null>(`${PREF}panel:${title}`, null);
  const isOpen = open ?? !closed;
  return (
    <details open={isOpen} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== isOpen) setOpen(o); }} className="group bg-slate-50 rounded-2xl border border-slate-200">
      <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        <span>{title}</span><span className="text-slate-400 transition-transform group-open:rotate-90" aria-hidden>›</span>
      </summary>
      <div className="px-3 pb-3 space-y-2">
        {children}
        {note && (
          <details className="text-[10px] text-slate-400 font-medium leading-relaxed">
            <summary className="cursor-pointer list-none font-bold text-blue-500">ⓘ About this</summary>
            <p className="pt-1">{note}</p>
          </details>
        )}
      </div>
    </details>
  );
};
