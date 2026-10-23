import React from 'react';
import { Anchor, Plus, Ship as ShipIcon, X } from 'lucide-react';
import { AppView } from '../types';
import { NAV_TOOLS } from '../tools/NavTools';

/**
 * The main navigation. Shown on the top-level screens; ship screens use their own back arrow.
 * Fleet and a slot on the left, My Ship in the centre (a little raised and highlighted), and two slots on the right; each slot holds a NavYeo tool:
 * tap an empty slot to choose one, tap a filled slot to open that tool, press and hold it to change or remove it.
 * Add Ship and Backup are in the menu under the anchor on the home screen.
 */
const BottomBar: React.FC<{
  view: AppView; onHome: () => void; onFleet: () => void;
  slots: (string | null)[]; onSlots: (s: (string | null)[]) => void; onLaunch: (toolName: string) => void;
  /** the tool currently open as a page, so its slot shows as the current one */
  openTool?: string | null;
}> = ({ view, onHome, onFleet, slots, onSlots, onLaunch, openTool }) => {
  const [picking, setPicking] = React.useState<number | null>(null);
  const hold = React.useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });

  const press = (i: number) => {
    hold.current.fired = false;
    if (slots[i]) hold.current.timer = setTimeout(() => { hold.current.fired = true; setPicking(i); }, 550);
  };
  const release = () => { if (hold.current.timer) clearTimeout(hold.current.timer); hold.current.timer = null; };
  const tap = (i: number) => {
    if (hold.current.fired) { hold.current.fired = false; return; }
    const name = slots[i];
    if (name && NAV_TOOLS.some(t => t.name === name)) onLaunch(name); else setPicking(i);
  };
  const choose = (i: number, name: string | null) => { const next = [...slots]; next[i] = name; onSlots(next); setPicking(null); if (name) onLaunch(name); };

  const slot = (i: number) => {
    const name = slots[i] ?? null;
    const tool = name ? NAV_TOOLS.find(t => t.name === name) : undefined;
    return (
      <button key={i} aria-label={tool ? `Open ${tool.name}. Press and hold to change` : 'Add a tool'}
        onPointerDown={() => press(i)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release} onContextMenu={e => e.preventDefault()} onClick={() => tap(i)}
        aria-current={tool && openTool === tool.name ? 'page' : undefined} className={`${side(!!tool && openTool === tool.name)} select-none`}>
        {tool ? <span className="h-[22px] flex items-center">{React.cloneElement(tool.icon as React.ReactElement<{ size?: number }>, { size: 22 })}</span>
          : <span className="w-[22px] h-[22px] rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center"><Plus size={13} /></span>}
        <span className="max-w-[64px] truncate">{tool ? tool.short : 'Tool'}</span>
      </button>
    );
  };
  const side = (active: boolean) => `flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors active:scale-95 ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`;
  return (
    <>
      <nav aria-label="Main" className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-xl mx-auto grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-center">
          <button onClick={onFleet} aria-current={view === 'select' ? 'page' : undefined} className={side(view === 'select')}><ShipIcon size={22} />Fleet</button>
          {slot(0)}
          <button onClick={onHome} aria-current={view === 'home' ? 'page' : undefined}
            className={`mx-2 my-1.5 px-6 py-2 rounded-2xl flex flex-col items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider border transition-colors active:scale-95 ${view === 'home' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'}`}>
            <Anchor size={22} />My Ship
          </button>
          {slot(1)}
          {slot(2)}
        </div>
      </nav>
      {picking !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPicking(null)}>
          <div role="dialog" aria-label="Choose a NavYeo tool" className="w-full max-w-md bg-white rounded-t-[2rem] shadow-2xl p-5 space-y-3 max-h-[75vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Put a NavYeo tool on the home bar</h2>
              <button onClick={() => setPicking(null)} aria-label="Close" className="p-1.5 text-slate-400"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV_TOOLS.map(t => (
                <button key={t.name} onClick={() => choose(picking, t.name)} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-[10px] font-bold text-slate-600 active:scale-95 ${slots[picking] === t.name ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                  {React.cloneElement(t.icon as React.ReactElement<{ size?: number }>, { size: 20 })}<span className="text-center leading-tight">{t.short}</span>
                </button>
              ))}
            </div>
            {slots[picking] && <button onClick={() => choose(picking, null)} className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-red-500">Remove it from this slot</button>}
          </div>
        </div>
      )}
    </>
  );
};

export default BottomBar;
