import React from 'react';
import * as nav from './navMath';

// A radar PPI picture of the CPA: own ship at the centre, the target's relative track across the screen, range rings,
// a mark every 6 minutes, and the closest point. Head-up or north-up. Rings are in nautical miles.

const SIZE = 300, C = SIZE / 2, R = 128;

export const CpaPpi: React.FC<{ input: nav.CpaInput; headUp: boolean }> = ({ input, headUp }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const p = { x: input.range * Math.sin(rad(input.bearing)), y: input.range * Math.cos(rad(input.bearing)) };
  const v = {
    x: input.targetSpeed * Math.sin(rad(input.targetCourse)) - input.ownSpeed * Math.sin(rad(input.ownCourse)),
    y: input.targetSpeed * Math.cos(rad(input.targetCourse)) - input.ownSpeed * Math.cos(rad(input.ownCourse)),
  };
  const r = nav.cpa(input);
  const nice = [1, 2, 3, 6, 12, 24, 48, 96];
  const maxR = nice.find(n => n >= input.range * 1.1) ?? Math.ceil(input.range * 1.1);
  const k = R / maxR;
  const rot = headUp ? -input.ownCourse : 0;                                    // rotate the picture so own course is up
  const pt = (x: number, y: number) => {
    const a = rad(rot), rx = x * Math.cos(a) + y * Math.sin(a), ry = -x * Math.sin(a) + y * Math.cos(a);
    return { x: C + rx * k, y: C - ry * k };
  };
  // the relative track: from the target's position now for up to 2 hours, while it stays inside the screen
  const marks: { x: number; y: number; min: number }[] = [];
  for (let m = 0; m <= 120; m += 6) {
    const t = m / 60, q = { x: p.x + v.x * t, y: p.y + v.y * t };
    if (Math.hypot(q.x, q.y) > maxR * 1.02) { if (m > 0) break; }
    marks.push({ ...pt(q.x, q.y), min: m });
  }
  const start = pt(p.x, p.y);
  const end = marks[marks.length - 1];
  const north = pt(0, maxR);
  const head = pt(Math.sin(rad(input.ownCourse)) * maxR, Math.cos(rad(input.ownCourse)) * maxR);
  const cpaPt = r.status === 'closing' ? pt(r.cpa * Math.sin(rad(r.bearingAtCpa)), r.cpa * Math.cos(rad(r.bearingAtCpa))) : null;
  const rings = [1, 2, 3].map(i => (maxR * i) / 3);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Radar picture of the target's relative track" className="w-full max-w-xs mx-auto bg-slate-900 rounded-2xl">
      {rings.map(x => <circle key={x} cx={C} cy={C} r={x * k} fill="none" stroke="#16a34a" strokeOpacity={0.5} strokeWidth={1} />)}
      {rings.map(x => <text key={x} x={C + 3} y={C - x * k + 10} fontSize={8} fill="#4ade80">{Number(x.toFixed(2))}</text>)}
      <line x1={C} y1={C} x2={head.x} y2={head.y} stroke="#4ade80" strokeWidth={1.5} />
      {!headUp && <text x={north.x - 3} y={north.y + 10} fontSize={9} fill="#86efac">N</text>}
      {end && <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#fbbf24" strokeWidth={1.5} />}
      {marks.map(m => <circle key={m.min} cx={m.x} cy={m.y} r={m.min === 0 ? 4 : 2} fill={m.min === 0 ? '#f87171' : '#fbbf24'} />)}
      {cpaPt && <><line x1={C} y1={C} x2={cpaPt.x} y2={cpaPt.y} stroke="#f87171" strokeDasharray="3 3" strokeWidth={1} /><circle cx={cpaPt.x} cy={cpaPt.y} r={4} fill="none" stroke="#f87171" strokeWidth={1.5} /></>}
      <polygon points={`${C},${C - 6} ${C - 4},${C + 4} ${C + 4},${C + 4}`} fill="#fff" transform={headUp ? undefined : `rotate(${input.ownCourse} ${C} ${C})`} />
      <text x={start.x + 6} y={start.y - 6} fontSize={9} fill="#fca5a5">T now</text>
      <text x={6} y={SIZE - 6} fontSize={8} fill="#86efac">{headUp ? 'Head-up' : 'North-up'} · rings in nm · dots every 6 min</text>
    </svg>
  );
};
