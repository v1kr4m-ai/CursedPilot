import React, { useState } from 'react';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { SimpleRecord } from '../types';
import { coefficients, deviationTable, formatDev, readDeviations, worst } from '../tools/compassSwing';

/** Deviation curve: heading across, deviation up (East positive). Axis spans at least +-2 degrees. */
const Curve: React.FC<{ points: { heading: number; dev: number }[] }> = ({ points }) => {
  const W = 320, H = 150, L = 30, R = 8, T = 8, B = 20;
  const m = Math.max(2, Math.ceil(Math.max(...points.map(p => Math.abs(p.dev)))));
  const x = (h: number) => L + (h / 360) * (W - L - R);
  const y = (d: number) => T + ((m - d) / (2 * m)) * (H - T - B);
  const path = [...points, { heading: 360, dev: points[0].dev }].map((p, i) => `${i ? 'L' : 'M'}${x(p.heading).toFixed(1)},${y(p.dev).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Deviation curve">
      {[-m, 0, m].map(d => <g key={d}><line x1={L} x2={W - R} y1={y(d)} y2={y(d)} stroke="#cbd5e1" strokeDasharray={d ? '3 3' : undefined} /><text x={L - 4} y={y(d) + 3} textAnchor="end" fontSize="9" fill="#64748b">{d > 0 ? '+' : ''}{d}</text></g>)}
      {[0, 90, 180, 270, 360].map(h => <text key={h} x={x(h)} y={H - 6} textAnchor="middle" fontSize="9" fill="#64748b">{String(h % 360).padStart(3, '0')}</text>)}
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

/** Compass swing records. Ones with deviation on all eight headings open to show the coefficients, the curve and a card every 15 degrees. */
const CompassSwingList: React.FC<{ items: SimpleRecord[]; onAdd: () => void; onEdit: (r: SimpleRecord) => void; onDelete: (id: string) => void }> = ({ items, onAdd, onEdit, onDelete }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={onAdd} aria-label="Add Compass Swing record" className="flex items-center gap-1 p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={16} /><span className="text-[11px] font-bold pr-1">Add</span></button>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-xs text-slate-400 italic">No records found.</p>}
        {items.map(r => {
          const c = coefficients(readDeviations(r.fields));
          const isOpen = open === r.id && !!c;
          const w = c && worst(c);
          return (
            <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{r.date}</span>
                <span className="flex items-center gap-1">
                  <button onClick={() => onEdit(r)} aria-label="Edit record" className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => onDelete(r.id)} aria-label="Delete record" className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </span>
              </div>
              <p className="text-sm text-slate-900 font-bold">{r.value || r.description}</p>
              {r.value && r.description && <p className="text-xs text-slate-500 mt-1">{r.description}</p>}
              {c && (
                <button onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600">
                  Deviation card <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
              {isOpen && c && w && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {(['A', 'B', 'C', 'D', 'E'] as const).map(k => (
                      <div key={k} className="bg-white rounded-lg border border-slate-100 py-1.5"><div className="text-[10px] font-bold text-slate-400">{k}</div><div className="text-xs font-bold text-slate-900">{formatDev(c[k])}</div></div>
                    ))}
                  </div>
                  <div className="bg-white rounded-lg border border-slate-100 p-2"><Curve points={deviationTable(c, 5)} /></div>
                  <div className="grid grid-cols-4 gap-1">
                    {deviationTable(c, 15).map(p => (
                      <div key={p.heading} className="bg-white rounded-lg border border-slate-100 px-2 py-1 text-center">
                        <div className="text-[10px] font-bold text-slate-400">{String(p.heading).padStart(3, '0')}&deg;</div>
                        <div className="text-xs font-bold text-slate-900">{formatDev(p.dev)}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">Headings are compass headings; E is deviation east (+). Calculated from the eight readings, so it is only as good as they are. Check against the ship's official deviation card.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompassSwingList;
