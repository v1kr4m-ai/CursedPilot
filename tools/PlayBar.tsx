import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Seg } from './kit';

// Play, pause, scrub and speed for the tools that show a manoeuvre in time. Time is in minutes of the manoeuvre.

export function usePlayer(totalMinutes: number, resetKey: string) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<'1' | '3' | '10'>('3');    // minutes of manoeuvre per second
  const last = useRef(0);
  useEffect(() => { setT(0); setPlaying(false); }, [resetKey]);
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000; last.current = now;
      setT(prev => { const n = prev + dt * Number(rate); if (n >= totalMinutes) { setPlaying(false); return totalMinutes; } return n; });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, rate, totalMinutes]);
  return { t, setT, playing, setPlaying, rate, setRate };
}

export const mmss = (minutes: number) => `${String(Math.floor(minutes)).padStart(2, '0')}:${String(Math.min(59, Math.round((minutes % 1) * 60))).padStart(2, '0')}`;

export const PlayBar: React.FC<{ player: ReturnType<typeof usePlayer>; totalMinutes: number; label?: string }> = ({ player: p, totalMinutes, label = 'Time in the manoeuvre' }) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => { if (p.t >= totalMinutes) p.setT(0); p.setPlaying(!p.playing); }} aria-label={p.playing ? 'Pause' : 'Play the manoeuvre'} className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-95">{p.playing ? <Pause size={16} /> : <Play size={16} />}</button>
      <button type="button" onClick={() => { p.setPlaying(false); p.setT(0); }} aria-label="Back to the start" className="shrink-0 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center active:scale-95"><RotateCcw size={15} /></button>
      <input type="range" min={0} max={totalMinutes} step={Math.max(totalMinutes / 240, 0.001)} value={p.t} onChange={e => { p.setPlaying(false); p.setT(Number(e.target.value)); }} aria-label={label} className="flex-1 accent-blue-600" />
      <span className="shrink-0 w-12 text-right text-[11px] font-bold tabular-nums text-slate-600">{mmss(p.t)}</span>
    </div>
    <Seg value={p.rate} onChange={v => p.setRate(v as '1' | '3' | '10')} options={[['1', '1×'], ['3', '3×'], ['10', '10×']]} />
  </div>
);
