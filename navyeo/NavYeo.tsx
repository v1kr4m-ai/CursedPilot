import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Bot, Eraser, Info, Mic, MicOff, Minimize2, Send } from 'lucide-react';
import { Ship } from '../types';
import { NAV_TOOLS, NavTool } from '../tools/NavTools';
import ToolInfoCard from './ToolInfoCard';
import { toolMemory } from '../tools/toolMemory';
import { isLengthUnit } from '../tools/navMath';
import { shipToFishtailRows } from '../fishtail/shipBridge';
import { TurnTable, interpret } from './commands';
import { Listening, startListening, voiceMaybeSupported } from './voice';
import { ICON, Pos, centredPanel, clampPos, defaultPos, growOrigin, isDrag, moved, parsePos } from './layout';

const STORE = 'cursedpilot.navyeo.v1';

/**
 * NavYeo: the navigator's assistant. A floating icon that can be dragged anywhere and is remembered; tap it and a
 * window opens in the centre of the screen, growing out of the icon and sized to fit the screen, so every feature
 * is reachable wherever the icon was parked. Collapse it and the window shrinks back into the icon. The screen
 * below stays usable, and a tap anywhere outside the window collapses it. What was last entered in the tools is
 * remembered until the clear-all icon is pressed. Today it holds the offline tools; the input row at the bottom is where the text and voice
 * assistant (prefed data, local or online AI) will plug in.
 */
const NavYeo: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const [tool, setTool] = useState<NavTool | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [pos, setPos] = useState<Pos>(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORE); } catch { /* storage unavailable */ }
    return clampPos(parsePos(saved) ?? defaultPos(window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight);
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const hasEntries = !useSyncExternalStore(toolMemory.subscribe, () => toolMemory.isEmpty());
  const open = phase !== 'closed';
  const collapse = useCallback(() => setPhase(p => (p === 'open' ? 'closing' : p)), []);

  // keep the icon on screen when the window changes size or the phone is rotated
  useEffect(() => {
    const onResize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); setPos(p => clampPos(p, window.innerWidth, window.innerHeight)); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, collapse]);

  // a tap anywhere outside the window collapses it (the tap still reaches whatever it landed on)
  useEffect(() => {
    if (phase !== 'open') return;
    const onDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) collapse();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [phase, collapse]);

  // the window grows from, and shrinks to, the icon: set the origin before the first paint
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    // offset values ignore the grow animation's own scale, unlike getBoundingClientRect; the wrapper sits at 0,0
    const o = growOrigin(pos, el.offsetLeft, el.offsetTop);
    el.style.transformOrigin = `${o.x}px ${o.y}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vp.w, vp.h]);                                   // not on every drag: the icon cannot move while the window is open

  // if the browser never reports the end of the shrink (reduced motion, background tab), finish anyway
  useEffect(() => {
    if (phase !== 'closing') return;
    const t = setTimeout(() => setPhase('closed'), 400);
    return () => clearTimeout(t);
  }, [phase]);

  const save = useCallback((p: Pos) => { try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* storage full or blocked */ } }, []);

  // dragging the icon; a movement under the threshold is a tap
  const drag = useRef<{ x: number; y: number; origin: Pos; dragging: boolean } | null>(null);
  const iconHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* the drag still works without capture */ }
      drag.current = { x: e.clientX, y: e.clientY, origin: pos, dragging: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.dragging && !isDrag(dx, dy)) return;
      d.dragging = true;
      setPos(moved(d.origin, dx, dy, window.innerWidth, window.innerHeight));
    },
    onPointerUp: () => {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      if (d.dragging) setPos(p => { save(p); return p; });
      else setPhase('open');
    },
    onPointerCancel: () => { drag.current = null; },
  };

  const openInfoFor = (t: NavTool, info: boolean) => { setTool(t); setShowInfo(info); };
  const panel = centredPanel(vp.w, vp.h);

  const [text, setText] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const mic = useRef<Listening | null>(null);

  const toggleMic = async () => {
    if (listening) { mic.current?.stop(); return; }
    setSaid(null);
    setListening(true);
    mic.current = await startListening(
      t => { setText(t); askRef.current(t); },
      problem => { setListening(false); mic.current = null; if (problem) setSaid(problem); },
    );
  };

  /** Answers from the selected ship's own turning data, in the unit last used for distances. */
  const ask = (spoken?: string) => {
    const q = (spoken ?? text).trim();
    if (!q) return;
    const tables = new Map<string, TurnTable>();
    (ship ? shipToFishtailRows(ship) : []).forEach(r => {
      const side = r.side === 'port' ? 'Port' : 'Starboard';
      const key = `${r.ownSpeed}|${r.rudder}|${side}`;
      if (!tables.has(key)) tables.set(key, { speed: r.ownSpeed, wheel: parseFloat(r.rudder), side, rows: [] });
      tables.get(key)!.rows.push({ turn: r.heading, advance: r.advance, transfer: r.transfer, time: r.time });
    });
    const unit = toolMemory.get<string>('pref:wheel:unit', 'cables');
    const reply = interpret(q, { shipName: ship?.name, tables: [...tables.values()], unit: isLengthUnit(unit) ? unit : 'cables' });
    if (reply.kind === 'open') {
      const target = NAV_TOOLS.find(t => t.name === reply.tool);
      if (target) {
        if (reply.form) {
          const key = `${reply.form.id}:fields`;
          toolMemory.set(key, { ...toolMemory.get<Record<string, string>>(key, {}), ...reply.form.values });
        }
        Object.entries(reply.memory ?? {}).forEach(([k, v]) => toolMemory.set(k, v));
        openInfoFor(target, false);
      }
    }
    setSaid(reply.say);
    setText('');
  };
  // the voice callback outlives the render it was made in, so it calls the latest ask
  const askRef = useRef(ask);
  askRef.current = ask;


  return (
    <>
      <button
        {...iconHandlers}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPhase('open'); } }}
        aria-label="Open NavYeo" title="NavYeo" aria-hidden={open} tabIndex={open ? -1 : 0}
        className="fixed z-40 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-400/30 flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-opacity duration-150"
        style={{ left: pos.x, top: pos.y, width: ICON, height: ICON, touchAction: 'none', opacity: open ? 0 : 1, pointerEvents: open ? 'none' : 'auto' }}
      >
        <Bot size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 pointer-events-none">
          <div
            ref={panelRef} role="dialog" aria-label="NavYeo"
            onAnimationEnd={() => { if (phase === 'closing') setPhase('closed'); }}
            className={`pointer-events-auto flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden ${phase === 'closing' ? 'navyeo-out' : 'navyeo-in'}`}
            style={{ width: panel.width, maxHeight: panel.maxHeight }}
          >
            <div className="flex items-center border-b border-slate-100 shrink-0">
              <div className="flex-1 flex items-center gap-3 pl-4 pr-2 py-3">
                <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200"><Bot size={18} /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 leading-tight">NavYeo</h3>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Navigator's assistant</div>
                </div>
              </div>
              <button onClick={() => toolMemory.clear()} disabled={!hasEntries} aria-label="Clear all entries" title="Clear all entries"
                className="my-2 p-2.5 bg-slate-50 text-slate-500 rounded-full hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-500 transition-colors"><Eraser size={18} /></button>
              <button onClick={collapse} aria-label="Collapse NavYeo" title="Collapse to icon" className="m-2 p-2.5 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100 transition-colors"><Minimize2 size={18} /></button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
              {tool ? (
                <div className="space-y-3">
                  <button onClick={() => { setTool(null); setShowInfo(false); }} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline"><ArrowLeft size={14} /> All tools</button>
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">{tool.icon}</div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800 leading-tight">{tool.name}</p><p className="text-[10px] text-slate-400 font-medium">{tool.desc}</p></div>
                    <button onClick={() => setShowInfo(v => !v)} aria-pressed={showInfo} aria-label={`How ${tool.name} works`} title="How it works"
                      className={`p-2 rounded-full border transition-colors ${showInfo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-slate-200'}`}><Info size={16} /></button>
                  </div>
                  {showInfo && <ToolInfoCard name={tool.name} />}
                  <tool.Component ship={ship} />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 font-medium">Pick a tool. Tap <Info size={12} className="inline -mt-0.5 text-blue-600" /> on a tile to see how it works.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {NAV_TOOLS.map(t => (
                      <div key={t.name} className="relative">
                        <button onClick={() => openInfoFor(t, false)} aria-label={t.name} title={t.desc}
                          className="w-full flex flex-col items-center gap-2 p-3 pt-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 active:scale-95 transition-all">
                          <span className="p-2.5 bg-white rounded-xl shadow-sm">{t.icon}</span>
                          <span className="text-[11px] font-bold text-slate-700 text-center leading-tight">{t.short}</span>
                        </button>
                        <button onClick={() => openInfoFor(t, true)} aria-label={`How ${t.name} works`} title="How it works"
                          className="absolute top-1 right-1 p-1.5 rounded-full text-blue-500 hover:bg-blue-100 transition-colors"><Info size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Typed requests: keyword matching only (see commands.ts). Voice, and local or online AI, plug in here later. */}
            <div className="p-3 border-t border-slate-50 bg-slate-50/50 shrink-0 space-y-2">
              {said && (
                <div role="status" className="relative p-3 pr-8 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-medium text-slate-700 leading-relaxed max-h-32 overflow-y-auto">
                  {said}
                  <button onClick={() => setSaid(null)} aria-label="Dismiss" className="absolute top-1.5 right-2 text-slate-400 hover:text-slate-600 text-base leading-none">&times;</button>
                </div>
              )}
              <form onSubmit={e => { e.preventDefault(); ask(); }} className="flex items-center gap-2 p-1.5 px-4 bg-white rounded-full border border-slate-200">
                <input type="text" value={text} onChange={e => setText(e.target.value)} aria-label="Ask NavYeo" placeholder="Type or tap the mic: tactical diameter at 15 kn" className="flex-1 min-w-0 bg-transparent border-none text-xs font-medium text-slate-900 outline-none" />
                {voiceMaybeSupported() && (
                  <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Speak to NavYeo'} title={listening ? 'Listening... tap to stop' : 'Speak'}
                    className={`p-2 rounded-full transition-colors ${listening ? 'bg-red-500 text-white animate-pulse' : 'text-blue-600 hover:bg-blue-50'}`}>{listening ? <MicOff size={16} /> : <Mic size={16} />}</button>
                )}
                <button type="submit" disabled={!text.trim()} aria-label="Send" className="p-2 text-blue-600 disabled:text-blue-600/30"><Send size={16} /></button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NavYeo;
