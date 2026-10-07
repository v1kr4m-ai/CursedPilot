import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { SimpleRecord } from '../types';
import { logPoints, signedKn, trueSpeed } from '../tools/emLog';

/** Error against log reading, as a line through the calibrated points. */
const Curve: React.FC<{ points: { log: number; error: number }[] }> = ({ points }) => {
  const W = 320, H = 140, L = 34, R = 10, T = 10, B = 20;
  const minX = Math.min(...points.map(p => p.log)), maxX = Math.max(...points.map(p => p.log));
  const m = Math.max(0.5, Math.ceil(Math.max(...points.map(p => Math.abs(p.error))) * 2) / 2);
  const x = (v: number) => L + (maxX === minX ? 0.5 : (v - minX) / (maxX - minX)) * (W - L - R);
  const y = (v: number) => T + ((m - v) / (2 * m)) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.log).toFixed(1)},${y(p.error).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Log error against log reading">
      {[-m, 0, m].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#cbd5e1" strokeDasharray={v ? '3 3' : undefined} /><text x={L - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#64748b">{v > 0 ? '+' : ''}{v}</text></g>)}
      <text x={L} y={H - 6} fontSize="9" fill="#64748b">{minX} kn</text><text x={W - R} y={H - 6} textAnchor="end" fontSize="9" fill="#64748b">{maxX} kn</text>
      {points.length > 1 && <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />}
      {points.map((p, i) => <circle key={i} cx={x(p.log)} cy={y(p.error)} r="3.5" fill="#3b82f6" stroke="white" strokeWidth="1" />)}
    </svg>
  );
};

/** EM log calibration records: error and correction table, error curve, and a log-reading to true-speed lookup. */
const EmLogList: React.FC<{ items: SimpleRecord[]; onAdd: () => void; onEdit: (r: SimpleRecord) => void; onDelete: (id: string) => void }> = ({ items, onAdd, onEdit, onDelete }) => {
  const pts = logPoints(items);
  const others = items.filter(r => !pts.some(p => p.id === r.id));   // saved before the values were kept
  const [reading, setReading] = useState('');
  const ts = reading === '' ? undefined : trueSpeed(pts, parseFloat(reading));
  const find = (id: string) => items.find(r => r.id === id)!;
  const th = 'px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-2 py-2.5 text-xs font-bold text-slate-900 whitespace-nowrap';

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={onAdd} aria-label="Add EM Log Calibration record" className="flex items-center gap-1 p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><Plus size={16} /><span className="text-[11px] font-bold pr-1">Add</span></button>
      </div>

      {pts.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-100">
            <table className="w-full">
              <thead className="bg-slate-50"><tr><th className={th}>Log</th><th className={th}>True</th><th className={th}>Error</th><th className={th}>Correction</th><th className={th}>Date</th><th className="w-14" /></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {pts.map(p => (
                  <tr key={p.id}>
                    <td className={td}>{p.log} kn</td><td className={td}>{p.ref} kn</td><td className={td}>{signedKn(p.error)}</td><td className={td}>{signedKn(-p.error)}</td>
                    <td className={td + ' text-slate-500'}>{p.date}</td>
                    <td className="pr-2 whitespace-nowrap">
                      <button onClick={() => onEdit(find(p.id))} aria-label="Edit record" className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => onDelete(p.id)} aria-label="Delete record" className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-2"><Curve points={pts.map(p => ({ log: p.log, error: p.error }))} /></div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0" htmlFor="emlog-reading">Log reads</label>
            <input id="emlog-reading" type="number" inputMode="decimal" step="any" value={reading} onChange={e => setReading(e.target.value)} placeholder="kn" className="w-20 p-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-blue-300" />
            <span className="text-sm font-bold text-slate-900">
              {reading === '' ? <span className="text-slate-400 font-medium">true speed shows here</span>
                : ts === null || ts === undefined ? <span className="text-amber-600">outside {pts[0].log} to {pts[pts.length - 1].log} kn, not calibrated</span>
                  : <>true {ts.toFixed(1)} kn</>}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Error is log minus true speed; add the correction to the log reading. Between calibrated speeds the value is read along a straight line.</p>
        </>
      )}

      {others.map(r => (
        <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{r.date}</span>
            <span className="flex items-center gap-1">
              <button onClick={() => onEdit(r)} aria-label="Edit record" className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
              <button onClick={() => onDelete(r.id)} aria-label="Delete record" className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
            </span>
          </div>
          <p className="text-sm text-slate-900 font-bold">{r.value || r.description}</p>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-slate-400 italic">No records found.</p>}
    </div>
  );
};

export default EmLogList;
