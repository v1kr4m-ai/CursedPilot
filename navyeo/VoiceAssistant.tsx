import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square, Volume2, X, Loader2, Bot, User, ArrowUpRight, AlertTriangle, Cpu, Wifi, WifiOff, Upload, Trash2 } from 'lucide-react';
import { Listening, startListening, voiceMaybeSupported, voiceUnavailableReason } from './voice';
import { Talking, speak } from './speech';
import { brain, useBrain, useOnline } from './llm';
import { useBackLayer } from '../services/backButton';

// A live voice conversation with NavYeo, in the manner of a voice chat: hold the NavYeo icon and it starts listening; what you say is answered
// (worked out with the tools' own sums, see commands.ts), the answer is read aloud, and it listens again, until you end it. Nothing leaves the phone
// except what the phone's own speech recogniser sends (it may work offline when the speech pack is installed).

type State = 'off' | 'listening' | 'thinking' | 'speaking';
interface Turn { who: 'you' | 'nav'; text: string; /** what the language model took the words as */ asked?: string; /** why the language model's answer was not used */ note?: string }
interface Props {
  shipName?: string;
  /** works the answer out (and fills the tool in) without opening the NavYeo window */
  answer: (text: string) => Promise<{ say: string; tool?: string; understoodAs?: string; note?: string }>;
  /** close this screen and open the tool the last answer filled in */
  showTool: (name: string) => void;
  onClose: () => void;
}

const MAX_SILENT = 3;   // empty listening rounds in a row before it stops and says so

export const VoiceAssistant: React.FC<Props> = ({ shipName, answer, showTool, onClose }) => {
  const [state, setState] = useState<State>('off');
  const [live, setLive] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const online = useOnline();
  const b = useBrain();
  const [sheet, setSheet] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const active = useRef(false);
  const stateRef = useRef<State>('off');
  const listener = useRef<Listening | null>(null);
  const talking = useRef<Talking | null>(null);
  const silent = useRef(0);
  const answerRef = useRef(answer); answerRef.current = answer;
  const listenRef = useRef<() => void>(() => undefined);
  const turnRef = useRef<(t: string) => void | Promise<void>>(() => undefined);
  const scroll = useRef<HTMLDivElement>(null);
  const set = (s: State) => { stateRef.current = s; setState(s); };

  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }, [history, live]);

  const stop = useCallback(() => {
    active.current = false;
    try { listener.current?.stop(); } catch { /* not listening */ }
    listener.current = null;
    talking.current?.cancel(); talking.current = null;
    setLive(''); set('off');
  }, []);
  useBackLayer(true, () => { stop(); onClose(); }, 2);   // Android back closes the voice assistant

  const listen = useCallback(async () => {
    if (!active.current) return;
    setLive(''); set('listening');
    let got = false;
    listener.current = await startListening(
      text => { got = true; silent.current = 0; turnRef.current(text); },
      problem => {
        listener.current = null;
        if (got || !active.current) return;
        if (!problem || /did not hear/i.test(problem)) {          // nothing was said: listen again, a few times
          if (++silent.current >= MAX_SILENT) { setError('I did not hear anything. Tap the microphone to talk again.'); stop(); return; }
          setTimeout(() => listenRef.current(), 250);
          return;
        }
        setError(problem); stop();                                 // permission, no speech service, offline: say it once and stop
      },
      partial => setLive(partial),
      { holdMs: 1800 },
    );
  }, [stop]);
  listenRef.current = listen;

  const turn = useCallback(async (text: string) => {
    if (!active.current) return;
    set('thinking');
    setLive(text);
    let r: { say: string; tool?: string; understoodAs?: string; note?: string };
    try { r = await answerRef.current(text); } catch { r = { say: 'Something went wrong working that out. Please say it again.' }; }
    if (!active.current) return;   // ended while it was thinking
    setHistory(h => [...h.slice(-9), { who: 'you', text, asked: r.understoodAs }, { who: 'nav', text: r.say, note: r.note }]);
    setLive(''); setTool(r.tool ?? null);
    set('speaking');
    talking.current = speak(r.say, () => { talking.current = null; if (active.current) listenRef.current(); });
  }, []);
  turnRef.current = turn;

  const start = useCallback(() => {
    setError(null);
    if (!voiceMaybeSupported()) { setError(voiceUnavailableReason()); return; }
    active.current = true; silent.current = 0;
    void listenRef.current();
  }, []);

  useEffect(() => { start(); return () => { stop(); }; }, [start, stop]);   // opened by a hold: it starts listening at once
  useEffect(() => { void brain.refresh().then(() => brain.warm()); }, []);   // the language model, if there is one, is made ready while you speak the first words

  const micTap = () => {
    if (state === 'off') start();
    else if (state === 'listening') stop();
    else if (state === 'speaking') { talking.current?.cancel(); talking.current = null; if (active.current) void listenRef.current(); }   // skip the rest of the answer
  };
  const label = state === 'listening' ? (live ? 'Listening…' : 'Listening — just speak') : state === 'thinking' ? 'Working it out…' : state === 'speaking' ? 'Speaking — tap to skip' : 'Tap the microphone to talk';
  const scale = state === 'speaking' ? 1.14 : state === 'thinking' ? 0.9 : state === 'listening' ? 1.04 : 0.96;

  return (
    <div role="dialog" aria-label="NavYeo voice assistant" className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex items-center justify-between px-5 pt-4 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-black tracking-tight">NavYeo Voice</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 truncate">{shipName ? shipName : 'No ship selected'}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span title={online ? 'Connected: the phone uses its online speech service' : 'No connection: the phone uses its offline speech if the speech pack is installed'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
              {online ? <Wifi size={11} /> : <WifiOff size={11} />}{online ? 'Online' : 'Offline'}
            </span>
            <button onClick={() => setSheet(true)} aria-label="The NavYeo model"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider active:scale-95 ${b.state === 'ready' ? 'bg-sky-500/20 text-sky-200' : b.state === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-300'}`}>
              {b.state === 'loading' ? <Loader2 size={11} className="animate-spin" /> : <Cpu size={11} />}
              {b.state === 'ready' ? 'NavYeo ready' : b.state === 'loading' ? 'Loading NavYeo' : b.state === 'installed' ? 'NavYeo idle' : b.state === 'error' ? 'NavYeo problem' : b.state === 'none' ? 'Add NavYeo model' : 'Basic'}
            </button>
          </div>
        </div>
        <button onClick={() => { stop(); onClose(); }} aria-label="Close the voice assistant" className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95"><X size={20} /></button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col items-center px-5">
        {/* the orb: it breathes while listening, shrinks while working and swells while speaking */}
        <div className="relative my-6 h-44 w-44 shrink-0 flex items-center justify-center" aria-hidden>
          {state === 'listening' && <span className="absolute inset-0 rounded-full bg-sky-500/25 animate-ping" />}
          <span className={`absolute inset-3 rounded-full blur-2xl transition-colors duration-500 ${state === 'speaking' ? 'bg-emerald-400/40' : state === 'thinking' ? 'bg-amber-400/30' : 'bg-sky-500/40'}`} />
          <div className={`relative h-32 w-32 rounded-full shadow-2xl transition-all duration-500 ${state === 'speaking' ? 'bg-gradient-to-br from-emerald-300 to-sky-600 animate-pulse' : state === 'thinking' ? 'bg-gradient-to-br from-amber-300 to-orange-600 animate-pulse' : 'bg-gradient-to-br from-sky-300 to-indigo-600'}`} style={{ transform: `scale(${scale})` }} />
        </div>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2 h-5 shrink-0">
          {state === 'thinking' && <Loader2 size={13} className="animate-spin" />}
          {state === 'speaking' && <Volume2 size={13} className="text-emerald-300" />}
          {label}
        </p>

        <div ref={scroll} className="w-full max-w-md flex-1 min-h-0 overflow-y-auto space-y-3 mt-5 pb-3">
          {history.length === 0 && !live && !error && (
            <p className="text-center text-sm text-slate-400 leading-relaxed pt-4">Ask in your own words: <span className="text-slate-300">“1 degree at 1 nm is?”</span>, <span className="text-slate-300">“course to steer track 090 speed 12 set 045 drift 2”</span>, <span className="text-slate-300">“distance and bearing from 12 30 N 72 45 E to 15 10 N 73 50 E”</span>. If a number is missing I will ask for it.</p>
          )}
          {history.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.who === 'you' ? 'justify-end' : ''}`}>
              {m.who === 'nav' && <Bot size={16} className="text-sky-300 mt-1 shrink-0" />}
              <p className={`max-w-[85%] text-sm leading-relaxed rounded-2xl px-4 py-2.5 ${m.who === 'you' ? 'bg-sky-500/20 text-slate-100' : 'bg-white/10 text-slate-100'}`}>{m.text}{m.asked && <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-300/70 mt-1">understood as: {m.asked}</span>}{m.note && <span className="block text-[10px] font-bold text-amber-300/80 mt-1">{m.note} Answered by the keyword rules.</span>}</p>
              {m.who === 'you' && <User size={16} className="text-slate-400 mt-1 shrink-0" />}
            </div>
          ))}
          {live && (
            <div className="flex gap-2 justify-end">
              <p className="max-w-[85%] text-sm leading-relaxed rounded-2xl px-4 py-2.5 bg-sky-500/10 border border-sky-400/20 text-slate-200 italic">{live}<span className="animate-pulse">▋</span></p>
              <User size={16} className="text-slate-400 mt-1 shrink-0" />
            </div>
          )}
        </div>

        {error && <div role="alert" className="w-full max-w-md mb-2 flex items-start gap-2 text-amber-200 text-xs bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3 shrink-0"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span></div>}
      </div>

      <footer className="flex flex-col items-center gap-3 pb-6 pt-2 shrink-0">
        {tool && <button onClick={() => showTool(tool)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold active:scale-95"><ArrowUpRight size={14} /> Show {tool}</button>}
        <div className="flex items-center gap-5">
          <button onClick={micTap} aria-label={state === 'listening' ? 'Stop listening' : state === 'speaking' ? 'Skip speaking' : 'Start listening'}
            className={`h-20 w-20 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-colors ${state === 'listening' ? 'bg-red-500 hover:bg-red-600' : state === 'speaking' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}`}>
            {state === 'listening' ? <MicOff size={30} /> : state === 'speaking' ? <Square size={24} className="fill-current" /> : <Mic size={30} />}
          </button>
        </div>
        <p className="text-[10px] font-semibold text-slate-500">{state === 'off' ? 'Conversation paused' : 'Hands-free: it listens again after each answer'}</p>
      </footer>

      {sheet && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSheet(false)}>
          <div role="dialog" aria-label="Voice brain" className="w-full max-w-md bg-slate-900 border border-white/10 rounded-t-3xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-tight flex items-center gap-2"><Cpu size={16} className="text-sky-300" /> The NavYeo model</h2>
              <button onClick={() => setSheet(false)} aria-label="Close" className="p-1.5 rounded-full bg-white/10"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              NavYeo works most requests out at once with its own rules. The NavYeo model, a small language model that runs on the phone, reads the ones the rules do not understand, in your own words, and gives short answers. It never does the sums: the app's calculators do. It works with no connection. Until a NavYeo model of its own is trained, any Qwen2.5 0.5B Instruct GGUF can be used; later, a model tuned on this app can simply replace it.
            </p>
            <p className="text-xs font-bold text-slate-200">
              {b.state === 'browser' ? 'Not available here: the model runs in the Android app only.'
                : b.state === 'none' ? 'No model installed.'
                  : b.state === 'error' ? `Problem: ${b.error}`
                    : `Installed (${b.sizeMb} MB), ${b.state === 'ready' ? 'in memory and ready' : b.state === 'loading' ? 'loading…' : 'it loads when it is needed and is let go after a few idle minutes'}.`}
            </p>
            {b.progress >= 0 && <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-sky-400 transition-all" style={{ width: `${Math.max(3, b.progress)}%` }} /></div>}
            {importError && <p role="alert" className="text-xs text-amber-200">{importError}</p>}
            {b.state !== 'browser' && (
              <div className="flex gap-2">
                <button disabled={b.progress >= 0} onClick={async () => { setImportError(null); try { await brain.importModel(); void brain.warm(); } catch (e) { setImportError(String((e as Error)?.message ?? e)); } }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-bold active:scale-95"><Upload size={16} /> {b.state === 'none' ? 'Import NavYeo model (.gguf)' : 'Replace the model'}</button>
                {b.state !== 'none' && <button onClick={() => { void brain.remove(); }} aria-label="Remove the model" className="px-4 rounded-2xl bg-white/10 hover:bg-red-500/30 active:scale-95"><Trash2 size={16} /></button>}
              </div>
            )}
            {b.state === 'none' && <p className="text-[11px] text-slate-400 leading-relaxed">Copy the model file (for now <span className="text-slate-200">qwen2.5-0.5b-instruct-q4_k_m.gguf</span>, about 490 MB; later your own navyeo.gguf) to the phone once, then choose it here. After that it is stored inside the app.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
