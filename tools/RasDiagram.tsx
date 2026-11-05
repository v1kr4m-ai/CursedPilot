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
  /** the bearing of her stern as a true bearing, when the Guide's course is known */
  trueText?: string | null;
}

/** A ship seen from above, heading up the page: a fine bow at (cx, top), parallel sides and a rounded transom. */
const hull = (cx: number, top: number, len: number, w: number) => {
  const h = w / 2, b1 = top + len * 0.1, b2 = top + len * 0.32, aft = top + len, r = Math.min(6, h);
  return `M ${cx} ${top} Q ${cx + h * 0.9} ${b1} ${cx + h} ${b2} L ${cx + h} ${aft - r} Q ${cx + h} ${aft} ${cx + h - r} ${aft} L ${cx - h + r} ${aft} Q ${cx - h} ${aft} ${cx - h} ${aft - r} L ${cx - h} ${b2} Q ${cx - h * 0.9} ${b1} ${cx} ${top} Z`;
};
const NAME = { bridge: 'Bridge', ras: 'RAS', fuel: 'Fuel' } as const;

export const RasDiagram: React.FC<Props> = ({ pointName, side, guideName, approachName, guide, approach, pointKey, separationM, standbyYd, plan: p, trueText }) => {
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
  // the RAS point and the fuelling rig are on each ship's inner edge (facing the other ship); the bridge and the radar on the centre line
  const edge = pointKey === 'bridge' ? 0 : hw / 2 - 3;
  const gpx = gx + (ax > gx ? edge : -edge), apx = ax + (ax > gx ? -edge : edge);
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
  // a mark named on the hull itself, and the superstructure block at a bridge
  /** names written on a hull, at their marks, pushed apart where marks are close (a thin leader joins a moved name to its mark) */
  const hullNames = (cx: number, names: { y: number; s: string; c: string; x?: number }[]) => {
    const placed: { y: number; at: number; s: string; c: string; x?: number }[] = [];
    for (const n of [...names].sort((a, b) => a.y - b.y)) { const prev = placed[placed.length - 1]; placed.push({ ...n, at: prev ? Math.max(n.y + 10, prev.at + 9) : n.y + 10 }); }
    return placed.map((n, i) => { const x = n.x ?? cx; return <g key={i}>{n.at - n.y > 12 && <line x1={x} y1={n.y + 3} x2={x} y2={n.at - 7} stroke={n.c} strokeWidth={0.5} />}<text x={x} y={n.at} textAnchor="middle" fontSize={7} fontWeight={800} fill={n.c}>{n.s}</text></g>; });
  };
  // a RAS point or fuelling rig is named beside its dot on the inner edge, clear of the bridge on the centre line
  const edgeName = (cx: number) => (pointKey === 'bridge' ? undefined : cx + (cx === gx ? (ax > gx ? 1 : -1) : (ax > gx ? -1 : 1)) * (hw / 2 - 10));
  const bridgeBlock = (cx: number, yy: number) => <rect x={cx - hw * 0.3} y={yy - 3} width={hw * 0.6} height={Math.max(14, 0.12 * Lg * k)} rx={2} fill="#94a3b8" />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="RAS approach seen from above" className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-100">
      <defs>
        {[KNOWN, CALC].map(c => <marker key={c} id={`a${c.slice(1)}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={c} /></marker>)}
      </defs>
      <rect width={W} height={H} fill="#ffffff" />

      {/* the Guide */}
      <path d={hull(gx, y(0), Lg * k, hw)} fill={HULL} stroke="#64748b" strokeWidth={1} />
      {guide.bridge !== undefined && pointKey !== 'bridge' && bridgeBlock(gx, y(guide.bridge))}
      {pointKey === 'bridge' && bridgeBlock(gx, yPoint)}
      {txt(gx, y(0) - 6, guideName || 'Guide', '#334155')}
      <circle cx={gpx} cy={yPoint} r={4} fill={KNOWN} />
      {hullNames(gx, [{ y: yPoint, s: NAME[pointKey], c: KNOWN, x: edgeName(gx) }, ...(guide.bridge !== undefined && pointKey !== 'bridge' ? [{ y: y(guide.bridge), s: 'Bridge', c: '#0f172a' }] : [])])}
      {vdim(dimX(gx, gx + awayG * 100), y(0), yPoint, `${pg} m`, KNOWN, awayG < 0 ? 'end' : 'start')}

      {/* the approach ship at the final station (dashed) */}
      <path d={hull(ax, y(aFinal), La * k, hw)} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
      <circle cx={apx} cy={y(aFinal + pa)} r={3.5} fill="none" stroke={KNOWN} strokeWidth={1.5} />
      {txt(ax + (ax > gx ? hw / 2 + 4 : -hw / 2 - 4), y(aFinal) + 4, 'final', '#94a3b8', ax > gx ? 'start' : 'end', false)}

      {/* abreast at the final station: separation (given) and centre to centre (worked out) */}
      <line x1={gx + (ax > gx ? hw / 2 : -hw / 2)} y1={yPoint} x2={ax - (ax > gx ? hw / 2 : -hw / 2)} y2={yPoint} stroke={KNOWN} strokeWidth={1.2} markerStart={`url(#a${KNOWN.slice(1)})`} markerEnd={`url(#a${KNOWN.slice(1)})`} />
      {txt(lat, yPoint - 5, `${separationM} m`, KNOWN)}

      {/* the approach ship where she starts slowing (solid) */}
      <path d={hull(ax, y(aSlow), La * k, hw)} fill={HULL} stroke="#475569" strokeWidth={1.2} />
      {txt(ax, y(aSlow + La) + 12, approachName || 'Approach ship', '#334155')}
      {bridgeBlock(ax, yBridgeSlow)}
      <circle cx={apx} cy={y(aSlow + pa)} r={3.5} fill={KNOWN} />
      {hullNames(ax, [{ y: yBridgeSlow, s: 'Bridge', c: '#0f172a' }, ...(pointKey !== 'bridge' ? [{ y: y(aSlow + pa), s: NAME[pointKey], c: KNOWN, x: edgeName(ax) }] : []), ...(p.radar && approach.radar !== undefined ? [{ y: y(aSlow + approach.radar), s: 'Radar', c: CALC }] : [])])}
      {vdim(dimX(ax, ax + (ax > gx ? 100 : -100)), y(aSlow), yBridgeSlow, `${ba} m`, KNOWN, ax > gx ? 'start' : 'end')}
      {pointKey !== 'bridge' && vdim(dimX(ax, ax + (ax > gx ? 100 : -100)) + (ax > gx ? 44 : -44), y(aSlow), y(aSlow + pa), `${pa} m`, KNOWN, ax > gx ? 'start' : 'end')}

      {/* the surge, marked between the two marks that come abreast: from the Guide's mark back to own mark where she starts slowing */}
      <line x1={ax + (ax > gx ? -hw / 2 - 8 : hw / 2 + 8)} y1={yPoint} x2={ax + (ax > gx ? -hw / 2 - 8 : hw / 2 + 8)} y2={y(aSlow + pa)} stroke={CALC} strokeWidth={1.2} markerStart={`url(#a${CALC.slice(1)})`} markerEnd={`url(#a${CALC.slice(1)})`} />
      <line x1={gpx} y1={yPoint} x2={apx} y2={yPoint} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
      {txt(ax + (ax > gx ? -hw / 2 - 12 : hw / 2 + 12), (yPoint + y(aSlow + pa)) / 2 + 3, `surge ${Math.round(p.surgeYd)} yd`, CALC, ax > gx ? 'end' : 'start')}

      {/* her point to her stern (her length less its distance from the stem) */}
      {vdim(dimX(gx, gx + awayG * 100), yPoint, y(Lg), `${p.pointToStern.toFixed(1)} m`, CALC, awayG < 0 ? 'end' : 'start')}

      {/* x: her stern to your stem when you start slowing (negative: overlapping) */}
      <line x1={lat} y1={y(Lg)} x2={lat} y2={y(aSlow)} stroke={CALC} strokeWidth={1.2} markerStart={`url(#a${CALC.slice(1)})`} markerEnd={`url(#a${CALC.slice(1)})`} />
      <line x1={gx - hw / 2} y1={y(Lg)} x2={lat + 6} y2={y(Lg)} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
      {txt(lat + (ax > gx ? -4 : 4), (y(Lg) + y(aSlow)) / 2 + 3, `x ${p.xM.toFixed(1)} m`, CALC, ax > gx ? 'end' : 'start')}

      {/* where her stern (on her centre line) bears from your bridge (on yours), measured from right ahead */}
      <line x1={ax} y1={yBridgeSlow} x2={gx} y2={y(Lg)} stroke={CALC} strokeWidth={1.4} strokeDasharray="6 3" />
      <line x1={ax} y1={yBridgeSlow} x2={ax} y2={yBridgeSlow - 40} stroke={CALC} strokeWidth={0.8} strokeDasharray="1 2" />
      {(() => {   // the angle from right ahead, as an arc at own bridge; its value is written at the top, clear of the other figures
        const r = 22, dx = gx - ax, dy = y(Lg) - yBridgeSlow, d = Math.hypot(dx, dy) || 1;
        return <path d={`M ${ax} ${yBridgeSlow - r} A ${r} ${r} 0 0 ${gx < ax ? 0 : 1} ${ax + (r * dx) / d} ${yBridgeSlow + (r * dy) / d}`} fill="none" stroke={CALC} strokeWidth={1.4} />;
      })()}
      {txt(W / 2, 13, `Slow when her stern bears ${side === 'Port' ? 'Red' : 'Green'} ${p.aheadDeg.toFixed(1)}° from right ahead${trueText ? ` = ${trueText}` : ''}`, CALC)}

      {/* the radar range to her stern, from the radar's place on own ship */}
      {p.radar && approach.radar !== undefined && (() => {
        const yr = y(aSlow + approach.radar), xr = ax + (ax > gx ? -hw / 2 - 24 : hw / 2 + 24);   // on the inner side, clear of the given figures
        return <g>
          <circle cx={ax} cy={yr} r={3} fill="none" stroke={CALC} strokeWidth={1.4} />
          <line x1={ax} y1={yr} x2={xr} y2={yr} stroke={CALC} strokeWidth={0.6} strokeDasharray="1 2" />
          {vdim(xr, y(Lg), yr, `${Math.round(p.radar.rangeM / 0.9144)} yd`, CALC, ax > gx ? 'end' : 'start')}
        </g>;
      })()}

      {/* from the stand-by station */}
      <line x1={ax} y1={y(aSlow + La) + 30} x2={ax} y2={Math.min(H - 30, y(aSlow + La) + 52)} stroke={CALC} strokeWidth={1} markerStart={`url(#a${CALC.slice(1)})`} />
      {txt(ax, H - 18, p.atOnce ? `stand-by ${standbyYd} yd: slow at once` : `stand-by ${standbyYd} yd: run ${Math.round(p.runYd)} yd`, CALC)}

    </svg>
  );
};
