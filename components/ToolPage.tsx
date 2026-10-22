import React, { useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { Ship } from '../types';
import { NAV_TOOLS } from '../tools/NavTools';
import { ResultSlot } from '../tools/kit';
import ToolInfoCard from '../navyeo/ToolInfoCard';

/**
 * A NavYeo tool opened from the home bar: a full page like Fleet or My Ship, not the NavYeo panel.
 * It is the same tool component, and tools keep what is typed in by key, so the entries are the same ones the tool shows inside NavYeo.
 */
const ToolPage: React.FC<{ name: string; ship?: Ship; fleet: Ship[]; onBack: () => void }> = ({ name, ship, fleet, onBack }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);   // where the tool's answers are shown, kept in view at the top
  const tool = NAV_TOOLS.find(t => t.name === name);
  if (!tool) return null;
  return (
    <div className="max-w-xl mx-auto pb-28">
      <header className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur px-4 pt-4 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back" className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"><ArrowLeft size={22} className="text-slate-700" /></button>
          <div className="p-2 bg-white rounded-xl border border-slate-100">{tool.icon}</div>
          <div className="min-w-0 flex-1" title={tool.desc}>
            <h1 className="text-lg font-bold text-slate-800 leading-tight truncate">{tool.name}</h1>
            <p className="text-[10px] font-medium text-slate-400 leading-tight truncate">{ship ? <>Figures from <span className="font-bold text-emerald-600">{ship.name}</span> in green</> : 'No ship selected'}</p>
          </div>
          <button onClick={() => setShowInfo(v => !v)} aria-pressed={showInfo} aria-label={`How ${tool.name} works`} title="How it works"
            className={`p-2 rounded-full border transition-colors ${showInfo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-slate-200'}`}><Info size={18} /></button>
        </div>
        <div ref={setSlot} aria-live="polite" aria-label="Result" className="space-y-1.5 max-h-[38vh] overflow-y-auto empty:hidden" />
      </header>
      <div className="px-4 pt-2 space-y-3">
        {showInfo && <ToolInfoCard name={tool.name} />}
        <ResultSlot.Provider value={slot}><tool.Component ship={ship} fleet={fleet} /></ResultSlot.Provider>
      </div>
    </div>
  );
};

export default ToolPage;
