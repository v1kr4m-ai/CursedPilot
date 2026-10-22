import React from 'react';
import { ChevronDown } from 'lucide-react';
import { CAL_METHODS } from '../tools/calMethods';

/** The calibration methods as collapsible cards, by topic: radar, speed log, lubber's line, swinging ship, echo sounder. */
const CalibrationMethods: React.FC = () => {
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div className="space-y-4">
      {CAL_METHODS.map(t => (
        <div key={t.id} className="space-y-1.5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">{t.title}</p>
          {t.cards.map(c => {
            const id = `${t.id}:${c.title}`, isOpen = open === id;
            return (
              <div key={id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                  <span className="text-xs font-bold text-slate-700">{c.title}</span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <ul className="px-4 pb-3 space-y-1.5 list-disc pl-8">{c.points.map((p, i) => <li key={i} className="text-xs text-slate-600 font-medium leading-snug">{p}</li>)}</ul>}
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">From the Handbook on Navigation (2019) chapter 8, BR 45(1)(2) para 1521 and BR 45(3) para 0427, in short. The books are the authority.</p>
    </div>
  );
};

export default CalibrationMethods;
