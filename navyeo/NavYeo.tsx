import React, { useState } from 'react';
import { ArrowLeft, Bot, Mic, Send, X } from 'lucide-react';
import { Ship } from '../types';
import { NAV_TOOLS, NavTool } from '../tools/NavTools';

/**
 * NavYeo: the floating navigator's assistant. Today it is a compact grid of offline tools; the input row
 * at the bottom is where the text and voice assistant will plug in later.
 */
const NavYeo: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<NavTool | null>(null);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close NavYeo' : 'Open NavYeo'}
          className={`group flex items-center gap-2 p-4 rounded-3xl shadow-2xl shadow-blue-400/30 transition-all active:scale-95 ${open ? 'bg-slate-900 text-white dark:bg-black dark:border dark:border-slate-300' : 'bg-blue-600 text-white'}`}
        >
          {open ? <X size={24} /> : (
            <>
              <Bot size={24} />
              <span className="font-bold text-sm pr-2">NavYeo</span>
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200"><Bot size={20} /></div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">NavYeo</h3>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Navigator's assistant
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tool ? (
                <div className="space-y-3">
                  <button onClick={() => setTool(null)} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline">
                    <ArrowLeft size={14} /> All tools
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">{tool.icon}</div>
                    <div><p className="text-sm font-bold text-slate-800 leading-tight">{tool.name}</p><p className="text-[10px] text-slate-400 font-medium">{tool.desc}</p></div>
                  </div>
                  <tool.Component ship={ship} />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 font-medium">Pick a tool.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {NAV_TOOLS.map(t => (
                      <button
                        key={t.name}
                        onClick={() => setTool(t)}
                        aria-label={t.name}
                        title={t.desc}
                        className="flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 active:scale-95 transition-all"
                      >
                        <span className="p-2.5 bg-white rounded-xl shadow-sm">{t.icon}</span>
                        <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{t.short}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assistant input: not wired up yet. Text and voice replies (prefed data, local or online AI) go here. */}
            <div className="p-4 border-t border-slate-50 bg-slate-50/50">
              <div className="flex items-center gap-2 p-2 px-4 bg-white rounded-full border border-slate-200">
                <input disabled type="text" placeholder="Ask NavYeo (coming soon)" className="flex-1 min-w-0 bg-transparent border-none text-xs font-medium outline-none" />
                <button disabled aria-label="Voice (coming soon)" className="p-2 text-blue-600/30"><Mic size={16} /></button>
                <button disabled aria-label="Send (coming soon)" className="p-2 text-blue-600/30"><Send size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NavYeo;
