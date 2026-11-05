import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Crosshair, Fuel, Maximize2, Radar, RefreshCw, Settings2, Ship as ShipIcon, Shuffle, Target, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Ship } from '../types';
import { Field, Grid, LengthField, Mini, Result, Seg, UnitPick, Warn, useForm, useMemory, useUnit } from './kit';
import * as nav from './navMath';
import { PlayBar, usePlayer } from './PlayBar';
import { useBackLayer } from '../services/backButton';
import { YD_PER_NM, bowsScene, cpaScene, fasterScene, fishtailScene, inTimeScene, passScene, plotScene, rasScene, rtcScene, stationScene, stationTrue } from './board';
import type { Common, Scene } from './board';
import type { Vec } from './battenberg';
import { lookupTurn } from './turnLookup';
import { shipParams } from './shipParams';
import { shipToFishtailRows } from '../fishtail/shipBridge';
import { computeFishtail, fishtailAngles, tableKeyOf, tableRows } from '../fishtail/compute';
import { ManeuverType, SideOfTurn } from '../fishtail/types';
import ManeuverVisualizer from '../fishtail/components/ManeuverVisualizer';
import '../fishtail/fishtail.css';
import { STATIONS, roundTheClock } from './stationChanges';
import type { Station } from './stationChanges';
import { EVOLUTIONS, alongsideRigs, dimsOf, plan as rasPlan, trueFromAhead } from './rasApproach';
import type { Evolution } from './rasApproach';
import { RasDiagram } from './RasDiagram';
import { saveSvgAsPng } from '../services/savePicture';

// BATTENBERG (v1): one radar picture, fixed at the top, for every station-keeping problem. The figures the problems share are entered once
// (Ships & stations); each problem has a button, and its own few figures in a sheet. The answer is given as text and drawn on the picture,
// with the Guide or own ship at the centre, head up or north up, and the run played in time. The sums are in board.ts.

type Problem = 'station' | 'intime' | 'cpa' | 'relvel' | 'bows' | 'fishtail' | 'rtc' | 'ras';
const PROBLEMS: { key: Problem; label: string; icon: React.ReactNode }[] = [
  { key: 'station', label: 'Station', icon: <Target size={18} /> },
  { key: 'intime', label: 'In time', icon: <Clock size={18} /> },
  { key: 'cpa', label: 'CPA', icon: <Radar size={18} /> },
  { key: 'bows', label: 'Bows', icon: <ShipIcon size={18} /> },
  { key: 'relvel', label: 'Rel-vel', icon: <Crosshair size={18} /> },
  { key: 'fishtail', label: 'Fishtail', icon: <Shuffle size={18} /> },
  { key: 'rtc', label: 'RTC', icon: <RefreshCw size={18} /> },
  { key: 'ras', label: 'RAS', icon: <Fuel size={18} /> },
];
const COMMON = ['gc', 'gs', 'oc', 'os', 'ss', 'nb', 'nd', 'xb', 'xd'] as const;
const EXTRA = ['loss', 'tmin', 'mg', 'adv', 'tr', 'tsec', 'sl', 'dec', 'fa', 'fa2', 'fgs', 'pass', 'p1t', 'p1b', 'p1r', 'p2t', 'p2b', 'p2r', 'p3t', 'p3b', 'p3r', 'rtcd', 'spk', 'sepm', 'sb'] as const;
const NEEDS: Record<Problem, readonly (typeof COMMON[number])[]> = {
  station: ['gc', 'gs', 'ss', 'nb', 'nd', 'xb', 'xd'], intime: ['gc', 'gs', 'nb', 'nd', 'xb', 'xd'], cpa: ['gc', 'gs', 'oc', 'os', 'nb', 'nd'], relvel: ['gc', 'gs', 'ss', 'nb', 'nd'],
  bows: ['gc', 'gs', 'oc', 'ss', 'xb', 'xd'], fishtail: ['gc', 'gs', 'nb', 'nd'], rtc: ['gc', 'gs', 'ss'], ras: ['gc', 'gs', 'ss'],
};
/** A figure the chosen problem needs: ringed in green. */
const Need: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => <div className={on ? 'rounded-2xl ring-2 ring-emerald-400 bg-emerald-50/40' : ''}>{children}</div>;
const PRESETS: [string, number][] = [['Ahead', 0], ['Bow', 45], ['Beam', 90], ['Qtr', 135], ['Astern', 180]];
const SIZE = 340, C = SIZE / 2, R = 150;
const b3 = (d: number) => `${String(Math.round(((d % 360) + 360) % 360) % 360).padStart(3, '0')}`;

/** A bottom sheet for a group of figures. */
const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useBackLayer(true, onClose, 2);
  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-3 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-label={title} className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl p-4 space-y-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">{title}</h3><button onClick={onClose} aria-label="Done" className="p-2 bg-slate-50 text-slate-400 rounded-full"><X size={18} /></button></div>
        {children}
        <button onClick={onClose} className="w-full p-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold">Done</button>
      </div>
    </div>, document.body);
};

/** The radar picture: the scene about the Guide, drawn with the Guide or own ship at the centre, head up or north up. */
const BoardPpi: React.FC<{ scene: Scene; guideCourse: number; up: number; headUp: boolean; ownCentre: boolean; zoom: number; own: Vec | null; unit: nav.LengthUnit }> = ({ scene, guideCourse, up, headUp, ownCentre, zoom, own, unit }) => {
  const cur = own ?? { x: 0, y: 0 };
  const shift = (p: Vec) => (ownCentre ? { x: p.x - cur.x, y: p.y - cur.y } : p);                 // own centre: everything rides with the Guide about own ship
  const pts = [{ x: 0, y: 0 }, ...scene.marks.map(m => m.pos), ...scene.tracks.flatMap(t => t.pts), ...(own ? [own] : [])].map(shift);
  const reach = Math.max(0.3, ...pts.map(p => Math.hypot(p.x, p.y))) * 1.15 / zoom, k = R / reach;
  const rot = headUp ? up : 0, a = (-rot * Math.PI) / 180;
  const xy = (p: Vec) => { const x = p.x * Math.cos(a) + p.y * Math.sin(a), y = -p.x * Math.sin(a) + p.y * Math.cos(a); return { x: C + x * k, y: C - y * k }; };
  const at = (p: Vec) => xy(shift(p));
  const poly = (ps: Vec[]) => ps.map(p => { const q = xy(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
  const raw = nav.convertLength(reach / 4, 'nm', unit), mag = 10 ** Math.floor(Math.log10(raw)), ringU = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const rings = [1, 2, 3, 4].map(i => nav.convertLength(i * ringU, unit, 'nm')).filter(r => r * k <= R + 2);
  const guide = at({ x: 0, y: 0 });
  const MARK: Record<string, string> = { own: '#ef4444', station: '#22c55e', slow: '#fb923c', wheel: '#22c55e', point: '#38bdf8' };
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Radar picture, ${ownCentre ? 'own ship' : 'the Guide'} at the centre, ${headUp ? 'head up' : 'north up'}`} className="w-full max-w-md mx-auto bg-slate-950 rounded-2xl">
      {rings.map(r => <circle key={r} cx={C} cy={C} r={r * k} fill="none" stroke="#155e75" strokeOpacity={0.6} />)}
      {rings.map(r => <text key={`t${r}`} x={C + 3} y={C - r * k + 9} fontSize={7.5} fill="#22d3ee" fillOpacity={0.7}>{nav.formatLength(nav.convertLength(r, 'nm', unit), unit)}</text>)}
      {Array.from({ length: 36 }, (_, i) => i * 10).map(t => {
        const s = ((t - rot) * Math.PI) / 180, big = t % 30 === 0, r1 = big ? R - 8 : R - 4;
        return <g key={t}><line x1={C + Math.sin(s) * r1} y1={C - Math.cos(s) * r1} x2={C + Math.sin(s) * R} y2={C - Math.cos(s) * R} stroke="#22d3ee" strokeOpacity={0.5} />
          {big && <text x={C + Math.sin(s) * (R - 16)} y={C - Math.cos(s) * (R - 16) + 3} fontSize={7.5} textAnchor="middle" fill="#67e8f9" fillOpacity={0.75}>{b3(t)}</text>}</g>;
      })}
      {scene.tracks.map((t, i) => t.kind === 'construction'
        ? <polyline key={i} points={poly(t.pts.map(shift))} fill="none" stroke="#64748b" strokeWidth={1} strokeDasharray="2 3" />
        : <polyline key={i} points={poly(ownCentre ? t.pts.map(p => ({ x: -p.x, y: -p.y })) : t.pts)} fill="none" stroke="#fbbf24" strokeWidth={1.6} strokeDasharray="6 4" />)}
      {scene.marks.filter(m => !(ownCentre && m.kind === 'own')).map((m, i) => { const q = at(m.pos); return <g key={i}><circle cx={q.x} cy={q.y} r={m.kind === 'station' ? 5 : 4} fill={m.kind === 'station' ? MARK.station : 'none'} stroke={MARK[m.kind]} strokeWidth={1.8} /><text x={q.x + 7} y={q.y - 5} fontSize={8.5} fontWeight={700} fill={MARK[m.kind]}>{ownCentre && m.kind === 'station' ? 'Guide on station' : m.label}</text></g>; })}
      {own && !ownCentre && <line x1={guide.x} y1={guide.y} x2={xy(own).x} y2={xy(own).y} stroke="#38bdf8" strokeOpacity={0.5} />}
      <polygon points={`${guide.x},${guide.y - 9} ${guide.x - 5},${guide.y + 7} ${guide.x + 5},${guide.y + 7}`} fill="#fff" transform={`rotate(${guideCourse - rot} ${guide.x} ${guide.y})`} />
      <text x={guide.x + 8} y={guide.y + 12} fontSize={8} fill="#e2e8f0">Guide</text>
      {own && (() => { const q = ownCentre ? { x: C, y: C } : xy(own); return <circle cx={q.x} cy={q.y} r={5.5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />; })()}
      {ownCentre && own && <line x1={C} y1={C} x2={guide.x} y2={guide.y} stroke="#38bdf8" strokeOpacity={0.5} />}
      <text x={10} y={SIZE - 10} fontSize={8} fill="#67e8f9" fillOpacity={0.8}>{ownCentre ? 'You' : 'Guide'} at centre · {headUp ? (ownCentre ? 'own head up' : "Guide's head up") : 'N up'}</text>
    </svg>
  );
};

export const BattenbergBoard: React.FC<{ ship?: Ship; fleet?: Ship[] }> = ({ ship, fleet }) => {
  const c = useForm('board', COMMON);
  const sp = shipParams(ship), lossYd = sp.decelMetresPerKnot === undefined ? undefined : String(Math.round((sp.decelMetresPerKnot / 0.9144) * 10) / 10);
  const [problem, setProblem] = useMemory<Problem>('board:problem', 'station');
  const [sheet, setSheet] = useState<'common' | 'extra' | null>(null);
  const [ownCentre, setOwnCentre] = useMemory('board:owncentre', false);
  const [headUp, setHeadUp] = useMemory('board:headup', true);
  const [nowFrom, setNowFrom] = useMemory<'own' | 'guide'>('board:nowfrom', 'own');
  const [zoom, setZoom] = useState(1);
  const [uNow, setUNow] = useUnit('board:now', 'yards'), [uNext, setUNext] = useUnit('board:next', 'yards'), [uPass, setUPass] = useUnit('board:pass', 'yards');
  const [uPlot, setUPlot] = useUnit('board:plot', 'yards'), [uRtc, setURtc] = useUnit('board:rtc', 'yards'), [uSb, setUSb] = useUnit('board:sb', 'yards');
  const [uOut, setUOut] = useUnit('board:out', 'yards');   // the answers and the range rings
  const toYd = (v: number | null, u: nav.LengthUnit) => (v === null ? null : nav.convertLength(v, u, 'yards'));
  // bows: the margin side and the turn; fishtail: its kind, side and table
  const [mside, setMside] = useMemory<'Port' | 'Starboard'>('board:mside', 'Starboard');
  const [turn, setTurn] = useMemory<'Auto' | 'Port' | 'Starboard'>('board:turn', 'Auto');
  const [fkind, setFkind] = useMemory<'half' | 'full' | 'distorted'>('board:fkind', 'full');
  const [fside, setFside] = useMemory<'Port' | 'Starboard'>('board:fside', 'Starboard');
  const [fkey, setFkey] = useMemory<string>('board:ftable', '');
  const [rvMode, setRvMode] = useMemory<'plots' | 'pass' | 'faster'>('board:rv', 'plots');
  const [rtcFrom, setRtcFrom] = useMemory<Station>('board:rtcfrom', 'Ahead');
  const [rtcTo, setRtcTo] = useMemory<Station>('board:rtcto', 'Astern');
  const [rtcSide, setRtcSide] = useMemory<'Port' | 'Starboard'>('board:rtcside', 'Starboard');
  const [rtcSides, setRtcSides] = useMemory<'same' | 'opposite'>('board:rtcsides', 'opposite');
  const [evo, setEvo] = useMemory<Evolution>('board:evo', 'RASAP');
  const [rasGuideId, setRasGuideId] = useMemory<string>('board:rasguide', '');
  const [rasRig, setRasRig] = useMemory<string>('board:rasrig', '');
  const [rasSide, setRasSide] = useMemory<'Port' | 'Starboard'>('board:rasside', 'Port');
  const [bigPlot, setBigPlot] = useState(false);
  const [fishScale, setFishScale] = useState(1000);
  const [rasDiagram, setRasDiagram] = useState(false);
  const rasBox = React.useRef<HTMLDivElement>(null);

  const n = (k: typeof COMMON[number]) => c.n(k);
  const nb = n('nb');
  const common: Common = {
    guideCourse: n('gc'), guideSpeed: n('gs'), ownCourse: n('oc'), ownSpeed: n('os'), stationingSpeed: n('ss') ?? n('os'),
    nowBearing: nb === null ? null : nowFrom === 'guide' ? (nb + 180) % 360 : nb, nowYards: toYd(n('nd'), uNow), nextBearing: n('xb'), nextYards: toYd(n('xd'), uNext),
    fmt: nm => nav.formatLength(nav.convertLength(nm, 'nm', uOut), uOut),
  };
  // the turn for joining from ahead, from the ship's turning data when she has it
  const turnAngle = common.guideCourse !== null && common.ownCourse !== null ? ((common.guideCourse - common.ownCourse + 540) % 360) - 180 : null;
  const pick = ship && turnAngle !== null && common.stationingSpeed ? lookupTurn(ship, turnAngle < 0 ? 'Port' : 'Starboard', common.stationingSpeed, turnAngle) : null;
  const r1 = (v: number) => String(Math.round(v * 10) / 10);
  const e = useForm('board-x', EXTRA, { loss: lossYd, dec: lossYd, adv: pick ? r1(pick.advance) : undefined, tr: pick ? r1(pick.transfer) : undefined, tsec: pick ? String(Math.round(pick.seconds)) : undefined, sl: pick?.loss !== undefined ? r1(pick.loss) : undefined });
  const rows = useMemo(() => (ship ? shipToFishtailRows(ship) : []), [ship]);
  const tables = useMemo(() => [...new Map(rows.map(r => [tableKeyOf(r), r])).values()], [rows]);
  const tkey = tables.some(t => tableKeyOf(t) === fkey) ? fkey : tables[0] ? tableKeyOf(tables[0]) : '';

  // RAS: the Guide from the fleet (her rig picked), own ship approaching; the speeds from the shared figures
  const ships = fleet ?? [];
  const rasGuide = ships.find(sh => sh.id === rasGuideId && sh.id !== ship?.id) ?? ships.find(sh => sh.id !== ship?.id);
  const rigs = alongsideRigs(rasGuide), rig = evo !== 'SKBDL' ? rigs.find(r => r.name === rasRig) : undefined;
  const gDims = { ...dimsOf(rasGuide), ...(rig ? { [EVOLUTIONS[evo].point]: rig.stemDistance > 0 ? rig.stemDistance : undefined } : {}) }, aDims = dimsOf(ship);
  const decelYd = sp.decelMetresPerKnot === undefined ? null : sp.decelMetresPerKnot / 0.9144;
  const rasP = common.guideSpeed !== null && common.stationingSpeed !== null && (e.n('spk') ?? decelYd) !== null
    ? rasPlan({ evolution: evo, guide: gDims, approach: aDims, guideSpeed: common.guideSpeed, approachSpeed: common.stationingSpeed, surgeYdPerKnot: (e.n('spk') ?? decelYd)!, separationM: e.n('sepm') ?? 42, standbyYd: toYd(e.n('sb'), uSb) ?? 500 }) : null;
  const pa = aDims[EVOLUTIONS[evo].point], rasGeom = { bridgeAhead: pa !== undefined && aDims.bridge !== undefined ? pa - aDims.bridge : 0, lateral: (e.n('sepm') ?? 42) + ((gDims.breadth ?? 0) + (aDims.breadth ?? 0)) / 2 };

  const scene: Scene = (() => {
    if (problem === 'station') return stationScene(common, e.n('loss'));
    if (problem === 'intime') return inTimeScene(common, e.n('tmin'));
    if (problem === 'cpa') return cpaScene(common);
    if (problem === 'relvel') {
      if (rvMode === 'pass') return passScene(common, toYd(e.n('pass'), uPass));
      if (rvMode === 'faster') return fasterScene(common);
      const plots = ([['p1t', 'p1b', 'p1r'], ['p2t', 'p2b', 'p2r'], ['p3t', 'p3b', 'p3r']] as const).map(([t, b, r]) => ({ minutes: e.n(t), bearing: e.n(b), yards: toYd(e.n(r), uPlot) }))
        .filter((q): q is { minutes: number; bearing: number; yards: number } => q.minutes !== null && q.bearing !== null && q.yards !== null);
      return plotScene(common, plots);
    }
    if (problem === 'rtc') {
      const ft = roundTheClock(rtcFrom, rtcTo, rtcSides)?.fishtail;
      const type = ft ? (ft.kind === 'half' ? ManeuverType.HALF : ft.kind === 'full' ? ManeuverType.FULL : ManeuverType.DISTORTED) : null;
      const res = ft && type && tkey && common.guideSpeed !== null ? computeFishtail(tableRows(rows, tkey), type, fishtailAngles(type, rtcSide === 'Starboard' ? SideOfTurn.STARBOARD : SideOfTurn.PORT, ft.angle, ft.a2 ?? 0), common.guideSpeed) : null;
      return rtcScene(common, rtcFrom, rtcTo, rtcSide, rtcSides, toYd(e.n('rtcd'), uRtc) ?? 1000, res);
    }
    if (problem === 'ras') return rasScene(common, rasP, { bridgeAheadOfMarkM: rasGeom.bridgeAhead, lateralM: rasGeom.lateral, guideTo: rasSide, standbyYd: toYd(e.n('sb'), uSb) ?? 500 });
    if (problem === 'bows') return bowsScene(common, { margin: e.n('mg') ?? 100, marginSide: mside, advance: e.n('adv'), transfer: e.n('tr'), speedLoss: e.n('sl') ?? 0, decelPerKnot: e.n('dec') ?? 0, turnSeconds: e.n('tsec'), turn });
    const type = fkind === 'half' ? ManeuverType.HALF : fkind === 'full' ? ManeuverType.FULL : ManeuverType.DISTORTED;
    const a1 = e.n('fa') ?? (fkind === 'distorted' ? 50 : 90), a2 = e.n('fa2') ?? 40;
    const res = tkey && common.guideSpeed !== null ? computeFishtail(tableRows(rows, tkey), type, fishtailAngles(type, fside === 'Starboard' ? SideOfTurn.STARBOARD : SideOfTurn.PORT, a1, a2), common.guideSpeed) : null;
    return fishtailScene(common, res, `${fkind === 'half' ? 'Half' : fkind === 'full' ? 'Full' : 'Unbalanced'} fishtail ${a1}°${fkind === 'distorted' ? `/${a2}°` : ''}`);
  })();

  const total = scene.play ? Math.max(scene.play.totalHours * 60, 0.01) : 0.01;
  const player = usePlayer(total, `${problem}|${JSON.stringify(common)}|${JSON.stringify(e.v)}|${fkind}|${fside}|${tkey}|${mside}|${turn}`);
  const own = scene.play ? scene.play.at(player.t / 60) : scene.marks.find(m => m.kind === 'own')?.pos ?? null;
  const gc = common.guideCourse ?? 0;
  const hasExtra = problem !== 'cpa';
  const needs = problem === 'relvel' && rvMode === 'plots' ? ['oc', 'os'] : NEEDS[problem];
  const nd = (k: typeof COMMON[number]) => needs.includes(k);
  const fishRes = (() => {   // the fishtail itself, for the full plot
    if (problem !== 'fishtail' || !tkey || common.guideSpeed === null) return null;
    const type = fkind === 'half' ? ManeuverType.HALF : fkind === 'full' ? ManeuverType.FULL : ManeuverType.DISTORTED;
    return computeFishtail(tableRows(rows, tkey), type, fishtailAngles(type, fside === 'Starboard' ? SideOfTurn.STARBOARD : SideOfTurn.PORT, e.n('fa') ?? (fkind === 'distorted' ? 50 : 90), e.n('fa2') ?? 40), common.guideSpeed);
  })();
  const setPreset = (offBow: number, side: 'Port' | 'Starboard') => c.bind('xb').onChange(String(Math.round((((gc + (side === 'Port' ? -offBow : offBow)) % 360) + 360) % 360)));

  return (
    <div className="space-y-2">
      {/* the picture, always first */}
      <div className="rounded-2xl bg-slate-900 p-2 space-y-2">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Mini label="Centre" value={ownCentre ? 'own' : 'guide'} onChange={v => setOwnCentre(v === 'own')} options={[['guide', 'Guide'], ['own', 'Own']]} />
          <Mini label="Picture orientation" value={headUp ? 'head' : 'north'} onChange={v => setHeadUp(v === 'head')} options={[['head', 'H Up'], ['north', 'N Up']]} />
          <button type="button" onClick={() => setZoom(z => Math.max(0.5, z / 1.4))} aria-label="Zoom out" className="p-1 rounded-lg bg-white text-slate-600"><ZoomOut size={14} /></button>
          <button type="button" onClick={() => setZoom(z => Math.min(6, z * 1.4))} aria-label="Zoom in" className="p-1 rounded-lg bg-white text-slate-600"><ZoomIn size={14} /></button>
        </div>
        <BoardPpi scene={scene} guideCourse={gc} up={ownCentre ? common.ownCourse ?? gc : gc} headUp={headUp} ownCentre={ownCentre} zoom={zoom} own={own} unit={uOut} />
        {scene.play && <PlayBar player={player} totalMinutes={total} />}
      </div>

      {/* the problems */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Problem">
        {PROBLEMS.map(p => (
          <button key={p.key} role="tab" aria-selected={problem === p.key} onClick={() => setProblem(p.key)}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold ${problem === p.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>{p.icon}{p.label}</button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setSheet('common')} className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold"><Settings2 size={14} /> Ships & stations</button>
        {hasExtra && <button type="button" onClick={() => setSheet('extra')} className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold"><Settings2 size={14} /> {PROBLEMS.find(p => p.key === problem)!.label} figures</button>}
      </div>

      {scene.need && <Warn>Needs {scene.need.join(', ')}.</Warn>}
      {scene.warn && <Warn>{scene.warn}</Warn>}
      {scene.rows.length > 0 && <Result rows={scene.rows} />}
      {fishRes && <button type="button" onClick={() => setBigPlot(true)} className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold"><Maximize2 size={14} /> Full fishtail plot</button>}
      {problem === 'ras' && rasP && !rasP.missing.length && <button type="button" onClick={() => setRasDiagram(true)} className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold"><Maximize2 size={14} /> RAS diagram</button>}
      {rasDiagram && rasP && !rasP.missing.length && (
        <Sheet title={`${evo}: the approach from above`} onClose={() => setRasDiagram(false)}>
          <div ref={rasBox}><RasDiagram pointName={EVOLUTIONS[evo].pointName} side={rasSide} guideName={rasGuide?.name ?? 'Guide'} approachName={ship?.name ?? 'Own ship'}
            guide={gDims} approach={aDims} pointKey={EVOLUTIONS[evo].point} separationM={e.n('sepm') ?? 42} standbyYd={toYd(e.n('sb'), uSb) ?? 500} plan={rasP}
            trueText={common.guideCourse === null ? null : `${trueFromAhead(rasP.aheadDeg, common.guideCourse, rasSide).toFixed(1).padStart(5, '0')}°T`} /></div>
          <button type="button" onClick={() => { const svg = rasBox.current?.querySelector('svg'); if (svg) void saveSvgAsPng(svg, `RAS ${evo} ${rasGuide?.name ?? ''} ${ship?.name ?? ''}`.trim()); }}
            className="w-full p-2.5 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold">Save the diagram as a picture</button>
        </Sheet>
      )}
      {bigPlot && fishRes && (
        <Sheet title="Fishtail plot" onClose={() => setBigPlot(false)}>
          <div className="original-palette rounded-2xl bg-slate-950 text-slate-50 p-1"><ManeuverVisualizer result={fishRes} yardScale={fishScale} onSetScale={setFishScale} /></div>
        </Sheet>
      )}
      <p className="text-[10px] text-slate-400 font-medium leading-snug">Version 1 of one picture for all the station-keeping problems; the separate tools stay until it is complete. Bearings are true; stations are given from the Guide.</p>

      {sheet === 'common' && (
        <Sheet title="Ships & stations" onClose={() => setSheet(null)}>
          <p className="text-[11px] font-semibold text-emerald-700"><span className="inline-block w-3 h-3 rounded ring-2 ring-emerald-400 align-middle mr-1" />Needed for {PROBLEMS.find(p => p.key === problem)!.label}</p>
          <Grid><Need on={nd('gc')}><Field label="Guide's course" unit="°T" {...c.bind('gc')} /></Need><Need on={nd('gs')}><Field label="Guide's speed" unit="kn" units {...c.bind('gs')} /></Need></Grid>
          <Grid><Need on={nd('oc')}><Field label="Own course" unit="°T" sensor="course" {...c.bind('oc')} /></Need><Need on={nd('os')}><Field label="Own speed" unit="kn" sensor="speed" {...c.bind('os')} /></Need></Grid>
          <Need on={nd('ss')}><Field label="Stationing / approach speed (own speed if blank)" unit="kn" units {...c.bind('ss')} /></Need>
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Own station</span>
            <Mini label="Own station given as" value={nowFrom} onChange={v => setNowFrom(v as 'own' | 'guide')} options={[['own', 'Own brg from Guide'], ['guide', 'Guide brg from me']]} /></div>
          <Need on={nd('nb')}><Field label={nowFrom === 'guide' ? "Guide's bearing from me" : 'Own bearing from the Guide'} unit="°T" {...c.bind('nb')} /></Need><Need on={nd('nd')}><LengthField label="Distance" unit={uNow} onUnit={setUNow} {...c.bind('nd')} /></Need>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next station (from the Guide)</span>
          <div className="flex flex-wrap gap-1">{PRESETS.flatMap(([name, a]) => (a === 0 || a === 180 ? [['', a, 'Starboard'] as const] : [['P ', a, 'Port'] as const, ['S ', a, 'Starboard'] as const]).map(([pre, ang, side]) => (
            <button key={`${name}${side}`} type="button" disabled={common.guideCourse === null} onClick={() => setPreset(ang, side)} className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 disabled:opacity-40">{pre}{name}</button>)))}</div>
          <Need on={nd('xb')}><Field label="True bearing from the Guide" unit="°T" {...c.bind('xb')} /></Need><Need on={nd('xd')}><LengthField label="Distance" unit={uNext} onUnit={setUNext} {...c.bind('xd')} /></Need>
          <UnitPick label="Answers and range rings in" unit={uOut} onChange={setUOut} />
        </Sheet>
      )}
      {sheet === 'extra' && (
        <Sheet title={`${PROBLEMS.find(p => p.key === problem)!.label} figures`} onClose={() => setSheet(null)}>
          {problem === 'station' && <Field label="Loss of speed (yards per knot)" unit="yd/kn" {...e.bind('loss')} />}
          {problem === 'intime' && <Field label="Be on station in" unit="min" {...e.bind('tmin')} />}
          {problem === 'bows' && <>
            <p className="text-[11px] text-slate-500 font-medium">Approach on own course at the stationing speed; the station is the next station. {pick ? `Turn figures from ${ship!.name}'s turning data.` : ''}</p>
            <Seg value={turn} onChange={v => setTurn(v as 'Auto' | 'Port' | 'Starboard')} options={[['Auto', 'Shorter turn'], ['Port', 'To port'], ['Starboard', 'To stbd']]} />
            <Grid><Field label="Safety margin" unit="yd" hint="100" {...e.bind('mg')} /><Field label="Advance" unit="yd" {...e.bind('adv')} /><Field label="Transfer" unit="yd" {...e.bind('tr')} /><Field label="Turn time" unit="s" {...e.bind('tsec')} /><Field label="Loss in turn" unit="kn" {...e.bind('sl')} /><Field label="Deceleration" unit="yd/kn" {...e.bind('dec')} /></Grid>
            <Seg value={mside} onChange={v => setMside(v as 'Port' | 'Starboard')} options={[['Starboard', 'Margin to stbd'], ['Port', 'Margin to port']]} />
          </>}
          {problem === 'relvel' && <>
            <Seg value={rvMode} onChange={v => setRvMode(v as 'plots' | 'pass' | 'faster')} options={[['plots', 'Her course'], ['pass', 'Pass her'], ['faster', 'Close faster']]} />
            {rvMode === 'plots' && <>
              <p className="text-[11px] text-slate-500 font-medium">Plots of the Guide from you: time (min), her true bearing and range. Own course and speed from Ships & stations.</p>
              <UnitPick label="Plot ranges in" unit={uPlot} onChange={setUPlot} />
              {([['p1t', 'p1b', 'p1r'], ['p2t', 'p2b', 'p2r'], ['p3t', 'p3b', 'p3r']] as const).map(([t, b, r], i) => <div key={i} className="grid grid-cols-3 gap-1.5"><Field label={`Plot ${i + 1} min`} {...e.bind(t)} /><Field label="Bearing" unit="°T" {...e.bind(b)} /><Field label="Range" unit={nav.LENGTH_UNITS[uPlot].short} {...e.bind(r)} /></div>)}
            </>}
            {rvMode === 'pass' && <LengthField label="Pass her at" unit={uPass} onUnit={setUPass} {...e.bind('pass')} />}
            {rvMode !== 'plots' && <p className="text-[11px] text-slate-500 font-medium">Your speed available is the stationing speed; she is the Guide.</p>}
          </>}
          {problem === 'rtc' && <>
            <Grid>
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span><select value={rtcFrom} onChange={ev => setRtcFrom(ev.target.value as Station)} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">{STATIONS.map(st => <option key={st}>{st}</option>)}</select></label>
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span><select value={rtcTo} onChange={ev => setRtcTo(ev.target.value as Station)} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">{STATIONS.map(st => <option key={st}>{st}</option>)}</select></label>
            </Grid>
            <Seg value={rtcSide} onChange={v => setRtcSide(v as 'Port' | 'Starboard')} options={[['Starboard', "Guide's starboard side"], ['Port', "Guide's port side"]]} />
            {rtcFrom === 'Abeam' && rtcTo === 'Abeam' && <Seg value={rtcSides} onChange={v => setRtcSides(v as 'same' | 'opposite')} options={[['opposite', 'To the other side'], ['same', 'Same side']]} />}
            <LengthField label="Standard distance (1000 yd if blank)" unit={uRtc} onUnit={setURtc} {...e.bind('rtcd')} />
            {common.guideCourse !== null && <p className="text-[11px] text-slate-500 font-medium">From {Math.round(stationTrue(common.guideCourse, rtcFrom, rtcSide))}° to {Math.round(stationTrue(common.guideCourse, rtcTo, rtcSide))}° from the Guide. A fishtail is worked from the turning table chosen under Fishtail.</p>}
          </>}
          {problem === 'ras' && <>
            <Seg value={evo} onChange={v => setEvo(v as Evolution)} options={(Object.keys(EVOLUTIONS) as Evolution[]).map(k => [k, k] as const)} />
            <div className={evo !== 'SKBDL' && rigs.length ? 'grid grid-cols-[1fr_8rem] gap-2' : ''}>
              <label className="block space-y-1 min-w-0"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guide ship</span><select value={rasGuide?.id ?? ''} onChange={ev => setRasGuideId(ev.target.value)} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">{ships.filter(sh => sh.id !== ship?.id).map(sh => <option key={sh.id} value={sh.id}>{sh.name}</option>)}</select></label>
              {evo !== 'SKBDL' && rigs.length > 0 && <label className="block space-y-1 min-w-0"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rig</span><select value={rig?.name ?? ''} onChange={ev => { setRasRig(ev.target.value); const r = rigs.find(x => x.name === ev.target.value); if (r?.side === 'Port' || r?.side === 'Starboard') setRasSide(r.side === 'Starboard' ? 'Port' : 'Starboard'); }} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"><option value="">Ship's data</option>{rigs.map(r => <option key={r.name} value={r.name}>{`${r.name}${r.stemDistance > 0 ? ` · ${r.stemDistance} m` : ' · not set'}`}</option>)}</select></label>}
            </div>
            <Seg value={rasSide} onChange={v => setRasSide(v as 'Port' | 'Starboard')} options={[['Port', 'Guide to my port'], ['Starboard', 'Guide to my stbd']]} />
            <Grid><Field label="Surge" unit="yd/kn" hint={decelYd === null ? '' : String(Math.round(decelYd))} {...e.bind('spk')} /><Field label="Distance between the ships' sides" unit="m" hint="42" {...e.bind('sepm')} /></Grid><LengthField label="Stand-by astern (500 yd if blank)" unit={uSb} onUnit={setUSb} {...e.bind('sb')} />
            <p className="text-[11px] text-slate-500 font-medium">You approach in {ship?.name ?? 'My Ship'}: the approach speed is the stationing speed and the Guide's speed is hers. Positions come from the ships' particulars (the RAS Approach tool takes typed figures and draws the side view).</p>
          </>}
          {problem === 'fishtail' && <>
            <Seg value={fkind} onChange={v => setFkind(v as 'half' | 'full' | 'distorted')} options={[['half', 'Half'], ['full', 'Full'], ['distorted', 'Unbalanced']]} />
            <Seg value={fside} onChange={v => setFside(v as 'Port' | 'Starboard')} options={[['Starboard', 'Out to stbd'], ['Port', 'Out to port']]} />
            <Grid><Field label={fkind === 'distorted' ? 'Out (first turn)' : 'Angle'} unit="°" hint={fkind === 'distorted' ? '50' : '90'} {...e.bind('fa')} />{fkind === 'distorted' && <Field label="Then (last turn)" unit="°" hint="40" {...e.bind('fa2')} />}</Grid>
            {tables.length ? (
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Turning table</span>
                <select value={tkey} onChange={ev => setFkey(ev.target.value)} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700">{tables.map(t => <option key={tableKeyOf(t)} value={tableKeyOf(t)}>{`${t.ownSpeed} kn · ${t.rudder}° wheel · ${t.side}`}</option>)}</select></label>
            ) : <p className="text-[11px] text-slate-500 font-medium">{ship ? `${ship.name} has no turning data: add it under Calibration Data, Turning Trials.` : 'Choose My Ship to work the fishtail from her turning data.'}</p>}
          </>}
        </Sheet>
      )}
    </div>
  );
};
