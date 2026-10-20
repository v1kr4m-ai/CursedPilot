import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import * as nav from './navMath';
import { Seg, bearing } from './kit';

// A radar PPI that plays the manoeuvre: both ships keep course and speed and the picture runs forward in time. Own ship
// is at the centre (relative motion: the target leaves a trail, its relative track) or moves across the screen (true
// motion: both ships leave trails). The scrubber moves through time; head-up or north-up. Ranges in nautical miles.

const SIZE = 300, C = SIZE / 2, R = 126;
const rad = (d: number) => (d * Math.PI) / 180;
const vec = (course: number, speed: number) => ({ x: speed * Math.sin(rad(course)), y: speed * Math.cos(rad(course)) });   // knots, x east, y north
const NICE = [0.5, 1, 2, 3, 6, 12, 24, 48, 96];

export const CpaPpi: React.FC<{ input: nav.CpaInput; headUp: boolean }> = ({ input, headUp }) => {
  const own = vec(input.ownCourse, input.ownSpeed), tgt = vec(input.targetCourse, input.targetSpeed);
  const p0 = { x: input.range * Math.sin(rad(input.bearing)), y: input.range * Math.cos(rad(input.bearing)) };   // target now, from own ship, nm
  const rel = { x: tgt.x - own.x, y: tgt.y - own.y };                                                           // knots
  const r = nav.cpa(input);

  // how long to play: past the closest approach, or half an hour when the target is opening
  const tMax = useMemo(() => (r.status === 'closing' && r.tcpaMinutes !== null ? Math.min(Math.max(r.tcpaMinutes * 2, r.tcpaMinutes + 12), 120) : 30), [r.status, r.tcpaMinutes]);
  const [t, setT] = useState(0);                               // minutes into the manoeuvre
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<'1' | '3' | '10'>('3');     // minutes of manoeuvre per second
  const [mode, setMode] = useState<'relative' | 'true'>('relative');
  const last = useRef(0);
  const key = `${input.ownCourse}|${input.ownSpeed}|${input.bearing}|${input.range}|${input.targetCourse}|${input.targetSpeed}`;
  useEffect(() => { setT(0); setPlaying(false); }, [key]);      // new inputs: start again

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000; last.current = now;
      setT(prev => { const n = prev + dt * Number(rate); if (n >= tMax) { setPlaying(false); return tMax; } return n; });
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, rate, tMax]);

  const at = (m: number) => {                                  // positions after m minutes, nm
    const h = m / 60;
    return { rel: { x: p0.x + rel.x * h, y: p0.y + rel.y * h }, own: { x: own.x * h, y: own.y * h }, tgt: { x: p0.x + tgt.x * h, y: p0.y + tgt.y * h } };
  };
  const steps = useMemo(() => Array.from({ length: 61 }, (_, i) => (tMax * i) / 60), [tMax]);

  // the picture's frame: in relative motion the centre is own ship; in true motion the centre is the middle of both tracks
  const frame = useMemo(() => {
    const rot = headUp ? -input.ownCourse : 0, a = rad(rot);
    const turn = (v: { x: number; y: number }) => ({ x: v.x * Math.cos(a) + v.y * Math.sin(a), y: -v.x * Math.sin(a) + v.y * Math.cos(a) });
    if (mode === 'relative') {
      let far = input.range * 1.1;
      steps.forEach(m => { far = Math.max(far, Math.hypot(at(m).rel.x, at(m).rel.y) * 1.02); });
      far = Math.min(far, input.range * 2.2);
      const maxR = NICE.find(n => n >= far) ?? Math.ceil(far);
      return { turn, centre: { x: 0, y: 0 }, k: R / maxR, maxR };
    }
    const pts = steps.flatMap(m => { const q = at(m); return [turn(q.own), turn(q.tgt)]; });
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const half = Math.max((Math.max(...xs) - Math.min(...xs)) / 2, (Math.max(...ys) - Math.min(...ys)) / 2, 0.2) * 1.15;
    const maxR = NICE.find(n => n >= half) ?? Math.ceil(half);
    return { turn, centre, k: R / half, maxR: half };
  }, [mode, headUp, steps, key]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pt = (v: { x: number; y: number }) => { const q = frame.turn(v); return { x: C + (q.x - frame.centre.x) * frame.k, y: C - (q.y - frame.centre.y) * frame.k }; };
  const now = at(t);
  const upTo = steps.filter(m => m <= t);
  const trail = (f: (m: number) => { x: number; y: number }, from: number[]) => from.map(m => { const q = pt(f(m)); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
  const targetNow = pt(mode === 'relative' ? now.rel : now.tgt), ownNow = mode === 'relative' ? { x: C, y: C } : pt(now.own);
  const rings = mode === 'relative' ? [1, 2, 3].map(i => (frame.maxR * i) / 3) : [];
  const cpaPt = mode === 'relative' && r.status === 'closing' ? pt({ x: r.cpa * Math.sin(rad(r.bearingAtCpa)), y: r.cpa * Math.cos(rad(r.bearingAtCpa)) }) : null;
  const rngNow = Math.hypot(now.rel.x, now.rel.y), brgNow = nav.norm360((Math.atan2(now.rel.x, now.rel.y) * 180) / Math.PI);
  const mmss = (m: number) => `${String(Math.floor(m)).padStart(2, '0')}:${String(Math.round((m % 1) * 60) % 60).padStart(2, '0')}`;
  const rot = headUp ? 0 : input.ownCourse;
  const ship = (p: { x: number; y: number }, fill: string, ang: number) => <polygon points={`${p.x},${p.y - 6} ${p.x - 4},${p.y + 5} ${p.x + 4},${p.y + 5}`} fill={fill} transform={`rotate(${ang} ${p.x} ${p.y})`} />;
  const tgtAng = headUp ? input.targetCourse - input.ownCourse : input.targetCourse;
  const heading = pt({ x: Math.sin(rad(input.ownCourse)) * frame.maxR * 0.9, y: Math.cos(rad(input.ownCourse)) * frame.maxR * 0.9 });

  return (
    <div className="space-y-1.5">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Radar picture of the encounter, playing in time" className="w-full max-w-xs mx-auto bg-slate-900 rounded-2xl">
        {rings.map(x => <circle key={x} cx={C} cy={C} r={x * frame.k} fill="none" stroke="#16a34a" strokeOpacity={0.5} strokeWidth={1} />)}
        {rings.map(x => <text key={`t${x}`} x={C + 3} y={C - x * frame.k + 10} fontSize={8} fill="#4ade80">{Number(x.toFixed(2))}</text>)}
        {mode === 'relative' && <line x1={C} y1={C} x2={heading.x} y2={heading.y} stroke="#4ade80" strokeWidth={1} strokeOpacity={0.8} />}
        {mode === 'relative' && r.cpa > 0.02 && r.status === 'closing' && <circle cx={C} cy={C} r={r.cpa * frame.k} fill="none" stroke="#f87171" strokeDasharray="3 3" strokeOpacity={0.8} />}
        {/* the whole track, faint, then the trail so far */}
        <polyline points={trail(m => (mode === 'relative' ? at(m).rel : at(m).tgt), steps)} fill="none" stroke="#fbbf24" strokeOpacity={0.25} strokeDasharray="2 3" strokeWidth={1.2} />
        {mode === 'true' && <polyline points={trail(m => at(m).own, steps)} fill="none" stroke="#e2e8f0" strokeOpacity={0.25} strokeDasharray="2 3" strokeWidth={1.2} />}
        <polyline points={trail(m => (mode === 'relative' ? at(m).rel : at(m).tgt), [...upTo, t])} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
        {mode === 'true' && <polyline points={trail(m => at(m).own, [...upTo, t])} fill="none" stroke="#e2e8f0" strokeWidth={1.8} />}
        {upTo.filter((_, i) => i % 5 === 0).map(m => { const q = pt(mode === 'relative' ? at(m).rel : at(m).tgt); return <circle key={m} cx={q.x} cy={q.y} r={1.8} fill="#fbbf24" />; })}
        {cpaPt && <circle cx={cpaPt.x} cy={cpaPt.y} r={4} fill="none" stroke="#f87171" strokeWidth={1.5} />}
        <line x1={ownNow.x} y1={ownNow.y} x2={targetNow.x} y2={targetNow.y} stroke="#38bdf8" strokeOpacity={0.7} strokeWidth={1} />
        {ship(ownNow, '#ffffff', mode === 'relative' ? rot : headUp ? 0 : input.ownCourse)}
        {ship(targetNow, '#f87171', mode === 'relative' ? 0 : tgtAng)}
        <circle cx={targetNow.x} cy={targetNow.y} r={7} fill="none" stroke="#f87171" strokeOpacity={0.5} />
        <text x={targetNow.x + (targetNow.x > C + 20 ? -9 : 9)} y={targetNow.y - 8} fontSize={9} fontWeight={700} fill="#fca5a5" textAnchor={targetNow.x > C + 20 ? 'end' : 'start'}>{`${bearing(brgNow)}  ${rngNow.toFixed(2)}`}</text>
        <text x={6} y={SIZE - 6} fontSize={8} fill="#86efac">{headUp ? 'Head-up' : 'North-up'} · {mode === 'relative' ? 'relative motion, rings in nm' : 'true motion'} · T+{mmss(t)}</text>
      </svg>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { if (t >= tMax) setT(0); setPlaying(p => !p); }} aria-label={playing ? 'Pause' : 'Play the manoeuvre'} className="shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-95">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <button type="button" onClick={() => { setPlaying(false); setT(0); }} aria-label="Back to the start" className="shrink-0 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center active:scale-95"><RotateCcw size={15} /></button>
        <input type="range" min={0} max={tMax} step={tMax / 240} value={t} onChange={e => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="Time in the manoeuvre" className="flex-1 accent-blue-600" />
        <span className="shrink-0 w-12 text-right text-[11px] font-bold tabular-nums text-slate-600">{mmss(t)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Seg value={mode} onChange={v => setMode(v as 'relative' | 'true')} options={[['relative', 'Relative'], ['true', 'True motion']]} />
        <Seg value={rate} onChange={v => setRate(v as '1' | '3' | '10')} options={[['1', '1×'], ['3', '3×'], ['10', '10×']]} />
      </div>
      <p className="text-[10px] text-slate-400 font-medium leading-snug">Now: bearing {bearing(brgNow)}, range {rngNow.toFixed(2)} nm{r.status === 'closing' && r.tcpaMinutes !== null ? `, CPA ${r.cpa.toFixed(2)} nm in ${Math.max(0, r.tcpaMinutes - t).toFixed(1)} min` : ''}. Both ships keep course and speed. 1× is one minute of the manoeuvre a second.</p>
    </div>
  );
};
