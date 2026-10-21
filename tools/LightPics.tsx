import React from 'react';
import type { DayShape, LightPic } from './refData';

// Pictures of a vessel's lights (a night tile) and day shapes (a day tile). Lights are drawn as the Rules show them seen from ahead:
// the masthead lights and all-round lights in a vertical line, then the red (port) and green (starboard) sidelights below.

const COLOUR = { w: '#f8fafc', r: '#ef4444', g: '#22c55e', y: '#facc15' } as const;
const STEP = 13;

const Day: React.FC<{ s: DayShape; cx: number; y: number }> = ({ s, cx, y }) => {
  const f = '#111827';
  switch (s) {
    case 'ball': return <circle cx={cx} cy={y} r={5.5} fill={f} />;
    case 'diamond': return <polygon points={`${cx},${y - 7} ${cx + 6},${y} ${cx},${y + 7} ${cx - 6},${y}`} fill={f} />;
    case 'cylinder': return <rect x={cx - 5} y={y - 6} width={10} height={12} fill={f} />;
    case 'cone-up': return <polygon points={`${cx},${y - 7} ${cx + 6},${y + 6} ${cx - 6},${y + 6}`} fill={f} />;
    case 'cone-down': return <polygon points={`${cx - 6},${y - 6} ${cx + 6},${y - 6} ${cx},${y + 7}`} fill={f} />;
    case 'cones-points-together': return <><polygon points={`${cx - 6},${y - 13} ${cx + 6},${y - 13} ${cx},${y - 1}`} fill={f} /><polygon points={`${cx - 6},${y + 11} ${cx + 6},${y + 11} ${cx},${y - 1}`} fill={f} /></>;
  }
};

export const LightPicture: React.FC<{ pic: LightPic }> = ({ pic }) => {
  const n = pic.stack.length, H = Math.max(76, 16 + n * STEP + 26), W = 52;
  const sideY = 12 + n * STEP + 8;
  const day = pic.day ?? [];
  const dayH = day.length === 1 && day[0] === 'cones-points-together' ? 30 : STEP + 6;
  return (
    <svg viewBox={`0 0 ${pic.day ? W * 2 + 6 : W} ${H}`} width={pic.day ? W * 2 + 6 : W} height={H} role="img" aria-label="Lights and shapes" className="shrink-0">
      <rect width={W} height={H} rx={8} fill="#0f172a" />
      {pic.stack.map((l, i) => (
        <g key={i} opacity={l.opt ? 0.55 : 1}>
          <circle cx={W / 2} cy={12 + i * STEP} r={4.6} fill={COLOUR[l.c]} stroke={l.opt ? '#94a3b8' : 'none'} strokeDasharray={l.opt ? '2 1.5' : undefined} />
          {l.t === 'masthead' && <rect x={W / 2 - 4.6} y={12 + i * STEP + 5.4} width={9.2} height={1.6} rx={0.8} fill={COLOUR[l.c]} opacity={0.8} />}
        </g>
      ))}
      {pic.sides && <>
        <path d={`M ${W / 2 - 3},${sideY - 4.5} a 4.5 4.5 0 0 0 0,9 z`} fill={COLOUR.r} transform="translate(-6 0)" />
        <path d={`M ${W / 2 + 3},${sideY - 4.5} a 4.5 4.5 0 0 1 0,9 z`} fill={COLOUR.g} transform="translate(6 0)" />
      </>}
      {pic.stern && <circle cx={W / 2} cy={H / 2 - 4} r={4.6} fill={COLOUR.w} />}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={7} fill="#94a3b8">night</text>
      {pic.day && <>
        <g transform={`translate(${W + 6} 0)`}>
          <rect width={W} height={H} rx={8} fill="#bae6fd" />
          {day.map((d, i) => <Day key={i} s={d} cx={W / 2} y={(day.length === 1 && d === 'cones-points-together' ? H / 2 - 5 : 14 + i * (dayH + 2))} />)}
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={7} fill="#475569">day</text>
        </g>
      </>}
    </svg>
  );
};
