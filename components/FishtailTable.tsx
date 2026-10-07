import React, { useState } from 'react';
import { Compass, Trash2 } from 'lucide-react';
import { SimpleRecord } from '../types';
import { FISHTAIL_SORTS, FishtailSort, fishtailRow, sortFishtails } from '../data/fishtails';

/** Fishtails saved from the calculator: kind, angle, speed, wheel, station, side, lateral separation and drop, sortable. */
const FishtailTable: React.FC<{ items: SimpleRecord[]; onCalculator: () => void; onDelete: (id: string) => void }> = ({ items, onCalculator, onDelete }) => {
  const [by, setBy] = useState<FishtailSort>('date');
  const rows = sortFishtails(items.map(fishtailRow), by);
  const th = 'px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-2 py-2.5 text-xs font-bold text-slate-900 whitespace-nowrap';

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Sort by
          <select value={by} onChange={e => setBy(e.target.value as FishtailSort)} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 outline-none focus:border-blue-300 normal-case tracking-normal">
            {FISHTAIL_SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <button onClick={onCalculator} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Compass size={14} />Calculator</button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No fishtails saved. Work one out in the calculator and save it here.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-100">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Kind</th><th className={th}>Angle</th><th className={th}>Speed</th><th className={th}>Wheel</th>
                <th className={th}>Station</th><th className={th}>Side</th><th className={th}>Lateral</th><th className={th}>Drop</th><th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className={td}>{r.kind}</td>
                  <td className={td}>{r.angle ? `${r.angle}°` : '-'}</td>
                  <td className={td}>{r.speed === null ? '-' : `${r.speed} kn`}</td>
                  <td className={td}>{r.wheel === null ? '-' : `${r.wheel}°`}</td>
                  <td className={td}>{r.station}</td>
                  <td className={td}>{r.side ? (r.side === 'Port' ? 'Port' : 'Stbd') : '-'}</td>
                  <td className={td}>{r.lateral === null ? '-' : `${r.lateral} yd`}</td>
                  <td className={td}>{r.drop === null ? '-' : `${r.drop} yd`}</td>
                  <td className="pr-2"><button onClick={() => onDelete(r.id)} aria-label="Delete fishtail" className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FishtailTable;
