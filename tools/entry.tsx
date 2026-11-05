import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { COORD_FORMATS, KINDS, coordKind } from './entryKinds';
import type { CoordFormat } from './entryKinds';
import { BOX, BOX_LABEL, boxTone } from './boxStyle';
import { PREF, toolMemory } from './toolMemory';
export type { EntryKind } from './entryKinds';
import type { EntryKind } from './entryKinds';

/** How latitudes and longitudes are typed everywhere (decimal degrees, degrees and minutes, or with seconds); remembered, degrees and minutes at first. */
const FMT_KEY = `${PREF}coordfmt`;
function useCoordFormat(): [CoordFormat, (f: CoordFormat) => void] {
  const all = useSyncExternalStore(toolMemory.subscribe, toolMemory.snapshot);
  return [(all[FMT_KEY] as CoordFormat) ?? 'dm', f => toolMemory.set(FMT_KEY, f)];
}

export const Entry: React.FC<{ kind: EntryKind; label: string; unit?: string; value: string; onChange: (s: string) => void; invalid?: boolean; wide?: boolean }> = ({ kind, label, unit, value, onChange, invalid, wide }) => {
  const coord = kind === 'lat' || kind === 'lon';
  const [fmt, setFmt] = useCoordFormat();
  const k = coord ? coordKind(kind, fmt) : KINDS[kind];
  const [local, setLocal] = useState(() => k.parse(value));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // pick up a change made elsewhere (clear-all, a remembered value, another way of writing it), but not our own echo
  useEffect(() => { if (k.out(local.n, local.t) !== value) setLocal(k.parse(value)); }, [value]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLocal(k.parse(value)); }, [fmt]);   // eslint-disable-line react-hooks/exhaustive-deps

  const push = (n: string[], t: 0 | 1) => { setLocal({ n, t }); onChange(k.out(n, t)); };
  const edit = (i: number, raw: string) => {
    const p = k.parts[i], clean = raw.replace(p.dec ? /[^\d.]/g : /\D/g, '').slice(0, p.len);
    push(local.n.map((x, j) => (j === i ? clean : x)), local.t);
    if (clean.length === p.len && !p.dec) refs.current[i + 1]?.focus();
  };
  const back = (i: number, e: React.KeyboardEvent) => { if (e.key === 'Backspace' && local.n[i] === '' && i > 0) refs.current[i - 1]?.focus(); };

  return (
    <div className={`${BOX} ${boxTone(invalid)} ${wide ? 'col-span-2' : ''}`} role="group" aria-label={label}>
      <span className={`${BOX_LABEL} flex items-center gap-2`}>
        <span>{label}{unit && ` (${unit})`}</span>
        {coord && (
          <span className="ml-auto flex gap-0.5" role="radiogroup" aria-label="Write it as">
            {COORD_FORMATS.map(([f, name]) => (
              <button type="button" key={f} role="radio" aria-checked={fmt === f} onClick={() => setFmt(f)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold normal-case tracking-normal ${fmt === f ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{name}</button>
            ))}
          </span>
        )}
      </span>
      <div className="flex items-center gap-1 py-0.5">
        {k.parts.map((p, i) => (
          <React.Fragment key={i}>
            <input ref={el => { refs.current[i] = el; }} value={local.n[i] ?? ''} placeholder={p.ph} inputMode={p.dec || (coord && fmt === 'd' && i === 1) ? 'decimal' : 'numeric'} aria-label={`${label} part ${i + 1}`}
              onChange={e => edit(i, e.target.value)} onKeyDown={e => back(i, e)} onFocus={e => e.target.select()}
              style={{ width: `${p.len * 0.8 + 1.1}rem` }} className="min-w-0 py-0.5 text-center rounded-md bg-slate-50 text-sm font-bold text-slate-900 outline-none focus:bg-blue-50" />
            {p.suffix && <span className="text-sm font-bold text-slate-400">{p.suffix}</span>}
          </React.Fragment>
        ))}
        {k.toggle && (
          <div className="ml-auto flex gap-1">
            {k.toggle.map((t, i) => (
              <button type="button" key={t} onClick={() => push(local.n, i as 0 | 1)} aria-pressed={local.t === i}
                className={`px-2 py-0.5 rounded-md text-xs font-bold border ${local.t === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{t}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
