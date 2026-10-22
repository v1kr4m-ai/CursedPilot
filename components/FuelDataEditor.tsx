import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FuelData, FuelRegime, points, templateData } from '../tools/fuel';

// The ship's fuel data template: engine regimes, each with rows of RPM, speed and fuel consumption. The user fills it in whenever the figures
// are to hand and edits it any time; the Fuel Planning tool in NavYeo works on whatever is filled in.

const cell = 'w-full p-2 rounded-lg bg-white border border-slate-200 outline-none text-sm font-bold text-slate-900 focus:border-blue-400';
const uid = () => Math.random().toString(36).slice(2, 9);

const FuelDataEditor: React.FC<{ data?: FuelData; onChange: (d: FuelData) => void }> = ({ data, onChange }) => {
  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500 font-medium leading-snug">No fuel data yet. Start from the template, fill in the regimes you have (the names are only suggestions), and add the rest later. The Fuel Planning tool in NavYeo uses what is filled in.</p>
        <button onClick={() => onChange(templateData())} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Start from the template</button>
      </div>
    );
  }
  const setRegime = (id: string, patch: Partial<FuelRegime>) => onChange({ ...data, regimes: data.regimes.map(r => r.id === id ? { ...r, ...patch } : r) });
  const setRow = (r: FuelRegime, i: number, key: 'rpm' | 'speed' | 'rate', v: string) => setRegime(r.id, { rows: r.rows.map((row, j) => j === i ? { ...row, [key]: v } : row) });
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 font-medium leading-snug">For each engine regime enter the RPM, the speed it gives (knots) and the fuel it burns (tonnes an hour). A row counts once it has a speed and a rate.</p>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fuel capacity (tonnes, optional)</span>
        <input type="number" inputMode="decimal" step="any" value={data.capacity ?? ''} onChange={e => onChange({ ...data, capacity: e.target.value })} className={cell} />
      </label>
      {data.regimes.map(r => (
        <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <input type="text" value={r.name} onChange={e => setRegime(r.id, { name: e.target.value })} aria-label="Regime name" placeholder="Engine regime, e.g. 01 Cruise gas turbine" className={cell} />
            <button onClick={() => { if (confirm(`Delete the regime "${r.name || 'unnamed'}"?`)) onChange({ ...data, regimes: data.regimes.filter(x => x.id !== r.id) }); }} aria-label="Delete regime" className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_28px] gap-1.5 text-[10px] font-bold text-slate-400 uppercase px-0.5"><span>RPM</span><span>Speed kn</span><span>Fuel t/h</span><span /></div>
          {r.rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-1.5 items-center">
              <input type="text" inputMode="decimal" aria-label="RPM" value={row.rpm} onChange={e => setRow(r, i, 'rpm', e.target.value)} className={cell} />
              <input type="number" inputMode="decimal" step="any" aria-label="Speed" value={row.speed} onChange={e => setRow(r, i, 'speed', e.target.value)} className={cell} />
              <input type="number" inputMode="decimal" step="any" aria-label="Fuel rate" value={row.rate} onChange={e => setRow(r, i, 'rate', e.target.value)} className={cell} />
              <button onClick={() => setRegime(r.id, { rows: r.rows.filter((_, j) => j !== i) })} aria-label="Delete row" className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button onClick={() => setRegime(r.id, { rows: [...r.rows, { rpm: '', speed: '', rate: '' }] })} className="flex items-center gap-1 text-xs font-bold text-blue-600"><Plus size={14} /> Add a row</button>
            <span className="text-[10px] font-semibold text-slate-400">{points(r).length} usable {points(r).length === 1 ? 'row' : 'rows'}</span>
          </div>
        </div>
      ))}
      <button onClick={() => onChange({ ...data, regimes: [...data.regimes, { id: uid(), name: '', rows: Array.from({ length: 4 }, () => ({ rpm: '', speed: '', rate: '' })) }] })} className="flex items-center gap-1 text-xs font-bold text-blue-600"><Plus size={14} /> Add a regime</button>
    </div>
  );
};

export default FuelDataEditor;
