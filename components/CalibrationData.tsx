import React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

export interface CalibrationSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  /** how many records the section holds, shown beside the title */
  count: number;
  /** the latest record(s) in a line, shown under the title so the card shows data and not just a number */
  latest?: string;
  content: React.ReactNode;
}

/** One home for the vessel's calibration and trial records: turning trials, accel/decel, fishtails, EM log, compass swing. */
/** `open` and `onToggle` are controlled by the caller so the open section survives leaving the screen and coming back. */
const CalibrationData: React.FC<{ sections: CalibrationSection[]; open: string | null; onToggle: (id: string) => void; expanded: boolean; onExpand: () => void }> = ({ sections, open, onToggle, expanded, onExpand }) => {
  const total = sections.reduce((n, s) => n + s.count, 0);

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <button onClick={onExpand} aria-expanded={expanded} className="w-full p-6 flex items-center justify-between gap-3 text-left">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><SlidersHorizontal size={20} className="text-blue-500" /> Calibration Data</h2>
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{total} {total === 1 ? 'record' : 'records'}</span>
          <ChevronDown size={20} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {expanded && <div className="divide-y divide-slate-100 border-t border-slate-100">
        {sections.map(s => {
          const isOpen = open === s.id;
          return (
            <div key={s.id}>
              <button onClick={() => onToggle(s.id)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors">
                <span className="shrink-0">{s.icon}</span>
                <span className="flex-1 min-w-0"><span className="block font-bold text-slate-800 text-sm">{s.title}</span>{s.latest && <span className="block text-[11px] text-slate-400 font-medium truncate">{s.latest}</span>}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.count ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>{s.count}</span>
                <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <div className="px-4 pb-5 pt-1 bg-slate-50/50">{s.content}</div>}
            </div>
          );
        })}
      </div>}
    </section>
  );
};

export default CalibrationData;
