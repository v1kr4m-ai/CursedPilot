import React from 'react';
import type { Dims, Plan } from './rasApproach';

// The RAS approach seen from above: the Guide, the approach ship at the final station (dashed) and where she starts slowing (solid), with the
// figures given in blue and the figures worked out in amber. Lengths along the ships are to scale; the distance between them is not.
// The surge is marked between the two marks that come abreast (bridges, RAS points or fuelling points).

export const KNOWN = '#0284c7', CALC = '#d97706';
const HULL = '#cbd5e1', W = 400, H = 470;
const YD_PER_M = 1 / 0.9144;

interface Props {
  pointName: string; side: 'Port' | 'Starboard';
  guideName: string; approachName: string;
  guide: Dims & { length?: number }; approach: Dims & { length?: number };
  pointKey: 'bridge' | 'ras' | 'fuel'; separationM: number; standbyYd: number; plan: Plan;
}

/** A hull outline, heading up the page: bow at (cx, top). */
const hull = (cx: number, top: number, len: number, w: number) =>
  `M ${cx} ${top} L ${cx + w / 2} ${top + len * 0.18} L ${cx + w / 2} ${top + len} L ${cx - w / 2} ${top + len} L ${cx - w / 2} ${top + len * 0.18} Z`;

export const RasDiagram: React.FC<Props> = ({ pointName, side, guideName, approachName, guide, approach, pointKey, separationM, standbyYd, plan: p }) => {
  const pg = guide[pointKey]!, pa = approach[pointKey]!, ba = approach.bridge!;
  const lenOf = (d: Dims & { length?: number }) => d.length ?? Math.max(d.bridge ?? 0, d.ras ?? 0, d.fuel ?? 0) * 1.35;
  const Lg = lenOf(guide), La = lenOf(approach), surgeM = p.surgeYd / YD_PER_M;
  // along the ships, metres: the Guide's stem at 0, the approach ship's stem at the final station at -stemOffset (ahead is up, smaller y)
  const aFinal = -p.stemOffsetM, aSlow = aFinal + surgeM;
  const top = Math.min(0, aFinal), bottom = Math.max(Lg, aSlow + La);
  const k = (H - 90) / (bottom - top), y = (m: number) => 30 + (m - top) * k;
  const gx = side === 'Port' ? 95 : W - 95, ax = side === 'Port' ? W - 180 : 180, hw = 34;   // the Guide on the side the approach ship has her
  const dimX = (x: number, toward: number) => x + (toward > x ? 1 : -1) * (hw / 2 + 10);
  const lat = (gx + ax) / 2;
  const yPoint = y(pg), yBridgeSlow = y(aSlow + ba);
  const txt = (x: number, yy: number, s: string, c: string, anchor: 'start' | 'middle' | 'end' = 'middle', bold = true) =>
    <text x={x} y={yy} textAnchor={anchor} fontSize={9.5} fontWeight={bold ? 700 : 500} fill={c}>{s}</text>;
  const vdim = (x: number, y1: number, y2: number, label: string, c: string, anchor: 'start' | 'end') => (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={c} strokeWidth={1.2} markerStart={`url(#a${c.slice(1)})`} markerEnd={`url(#a${c.slice(1)})`} />
      {txt(x + (anchor === 'start' ? 4 : -4), (y1 + y2) / 2 + 3, label, c, anchor)}
    </g>
  );
  const awayG = gx < ax ? -1 : 1;   // the Guide's outer side
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="RAS approach seen from above" className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-100">
      <defs>
        {[KNOWN, CALC].map(c => <marker key={c} id={`a${c.slice(1)}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>)}
      </defs>
      <rect width={W} height={H} fill="#ffffff" />

      {/* the Guide */}
      <path d={hull(gx, y(0), Lg * k, hw)} fill={HULL} stroke="#64748b" strokeWidth={1} />
      {txt(gx, y(0) - 6, guideName || 'Guide', '#334155')}
      <circle cx={gx} cy={yPoint} r={4} fill={KNOWN} />
      {vdim(dimX(gx, gx + awayG * 100), y(0), yPoint, `${pg} m`, KNOWN, awayG < 0 ? 'end' : 'start')}
      {txt(gx + awayG * (hw / 2 + 14), yPoint + 14, `her ${pointName}`, KNOWN, awayG < 0 ? 'end' : 'start', false)}
      {guide.breadth !== undefined && txt(gx, y(Lg) + 12, `breadth ${guide.breadth} m`, KNOWN, 'middle', false)}

      {/* the approach ship at the final station (dashed) */}
      <path d={hull(ax, y(aFinal), La * k, hw)} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
      <circle cx={ax} cy={y(aFinal + pa)} r={3.5} fill="none" stroke={KNOWN} strokeWidth={1.5} />
      {txt(ax + (ax > gx ? hw / 2 + 4 : -hw / 2 - 4), y(aFinal) + 4, 'final station', '#94a3b8', ax > gx ? 'start' : 'end', false)}

      {/* abreast at the final station: separation (given) and centre to centre (worked out) */}
      <line x1={gx + (ax > gx ? hw / 2 : -hw / 2)} y1={yPoint} x2={ax - (ax > gx ? hw / 2 : -hw / 2)} y2={yPoint} stroke={KNOWN} strokeWidth={1.2} markerStart={`url(#a${KNOWN.slice(1)})`} markerEnd={`url(#a${KNOWN.slice(1)})`} />
      {txt(lat, yPoint - 5, `${separationM} m`, KNOWN)}
      {Math.abs(p.stemOffsetM) >= 0.5 && (
        <g>
          <line x1={gx} y1={y(0)} x2={ax} y2={y(0)} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
          {txt(lat, Math.max(y(0), y(aFinal)) + 11, `stems ${Math.abs(p.stemOffsetM).toFixed(1)} m apart`, CALC)}
        </g>
      )}

      {/* the approach ship where she starts slowing (solid) */}
      <path d={hull(ax, y(aSlow), La * k, hw)} fill={HULL} stroke="#475569" strokeWidth={1.2} />
      {txt(ax, y(aSlow + La) + 12, approachName || 'Approach ship', '#334155')}
      {approach.breadth !== undefined && txt(ax, y(aSlow + La) + 23, `breadth ${approach.breadth} m`, KNOWN, 'middle', false)}
      <rect x={ax - 5} y={yBridgeSlow - 3} width={10} height={6} fill="#334155" />
      <circle cx={ax} cy={y(aSlow + pa)} r={3.5} fill={KNOWN} />
      {vdim(dimX(ax, ax + (ax > gx ? 100 : -100)), y(aSlow), yBridgeSlow, `bridge ${ba} m`, KNOWN, ax > gx ? 'start' : 'end')}
      {pointKey !== 'bridge' && vdim(dimX(ax, ax + (ax > gx ? 100 : -100)) + (ax > gx ? 52 : -52), y(aSlow), y(aSlow + pa), `${pointName} ${pa} m`, KNOWN, ax > gx ? 'start' : 'end')}

      {/* the surge, marked between the two marks that come abreast: from the Guide's mark back to own mark where she starts slowing */}
      <line x1={ax + (ax > gx ? -hw / 2 - 8 : hw / 2 + 8)} y1={yPoint} x2={ax + (ax > gx ? -hw / 2 - 8 : hw / 2 + 8)} y2={y(aSlow + pa)} stroke={CALC} strokeWidth={1.2} markerStart={`url(#a${CALC.slice(1)})`} markerEnd={`url(#a${CALC.slice(1)})`} />
      <line x1={gx} y1={yPoint} x2={ax} y2={yPoint} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
      {txt(ax + (ax > gx ? -hw / 2 - 12 : hw / 2 + 12), (yPoint + y(aSlow + pa)) / 2 + 3, `surge ${Math.round(p.surgeYd)} yd`, CALC, ax > gx ? 'end' : 'start')}

      {/* her point to her stern (her length less its distance from the stem) */}
      {vdim(dimX(gx, gx + awayG * 100), yPoint, y(Lg), `${p.pointToStern.toFixed(1)} m`, CALC, awayG < 0 ? 'end' : 'start')}
      {txt(dimX(gx, gx + awayG * 100) + awayG * 4, (yPoint + y(Lg)) / 2 + 14, 'to her stern', CALC, awayG < 0 ? 'end' : 'start', false)}

      {/* x: her stern to your stem when you start slowing (negative: overlapping) */}
      <line x1={lat} y1={y(Lg)} x2={lat} y2={y(aSlow)} stroke={CALC} strokeWidth={1.2} markerStart={`url(#a${CALC.slice(1)})`} markerEnd={`url(#a${CALC.slice(1)})`} />
      <line x1={gx - hw / 2} y1={y(Lg)} x2={lat + 6} y2={y(Lg)} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
      {txt(lat + (ax > gx ? -4 : 4), (y(Lg) + y(aSlow)) / 2 + 3, `x ${p.xM >= 0 ? `${p.xM.toFixed(1)} m` : `${(-p.xM).toFixed(1)} m overlap`}`, CALC, ax > gx ? 'end' : 'start')}

      {/* theta: where her stern bears from your bridge, forward of the beam */}
      <line x1={ax} y1={yBridgeSlow} x2={gx + (ax > gx ? hw / 2 : -hw / 2)} y2={y(Lg)} stroke={CALC} strokeWidth={1.4} strokeDasharray="6 3" />
      <line x1={ax} y1={yBridgeSlow} x2={lat} y2={yBridgeSlow} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
      {txt(ax + (ax > gx ? -hw / 2 - 6 : hw / 2 + 6), yBridgeSlow + 14, `θ ${p.thetaDeg.toFixed(1)}° from the beam`, CALC, ax > gx ? 'end' : 'start')}

      {/* from the stand-by station */}
      <line x1={ax} y1={y(aSlow + La) + 30} x2={ax} y2={Math.min(H - 30, y(aSlow + La) + 52)} stroke={CALC} strokeWidth={1} markerStart={`url(#a${CALC.slice(1)})`} />
      {txt(ax, H - 18, p.atOnce ? `stand-by ${standbyYd} yd: slow at once` : `from stand-by (${standbyYd} yd): run ${Math.round(p.runYd)} yd, ${p.runMinutes.toFixed(1)} min`, CALC)}

    </svg>
  );
};
