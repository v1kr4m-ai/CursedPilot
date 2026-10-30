import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Info, X } from 'lucide-react';
import { saveSvgAsPng } from '../services/savePicture';
import { Field, Grid, Panel, Result, Seg, SideToggle, Warn, bearing, useForm, useMemory } from './kit';
import { abreastTurn, angleForSeparation, columnTurn, distanceToRegain, stopwatchSeconds, streamAllowance, throwOffToRegain, YD_PER_CABLE, yardsRun } from './manoeuvres';
import { lookupTurn } from './turnLookup';
import { EVOLUTIONS, alongsideRigs, dimsOf, plan, sweep } from './rasApproach';
import { shipParams } from './shipParams';
import type { Dims, Evolution } from './rasApproach';
import type { Ship } from '../types';
import { RasDiagram, KNOWN, CALC } from './RasDiagram';
import { useBackLayer } from '../services/backButton';

// The tools of the Mathematics of Manoeuvres notes: Corpen (alter course in station), Regain Track and RAS Approach. The sums are in
// manoeuvres.ts. Distances are in cables or yards (200 yards a cable), speeds in knots.

const mmss = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60).toString().padStart(2, '0')} s`;
const norm = (d: number) => ((d % 360) + 360) % 360;

// ---- Corpen --------------------------------------------------------------------------------------------------------------------
const CF = ['an', 'kn', 'dc', 'adv', 'tr', 'tt', 'rg', 'rc', 'nt', 'ls'] as const;

export const CorpenTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const typed = useForm('corpen', CF);
  const [mode, setMode] = useMemory<'column' | 'abreast'>('corpen:mode', 'column');
  const [turnSide, setTurnSide] = useMemory<'Port' | 'Starboard'>('corpen:side', 'Starboard');
  const [wheelRaw, setWheelRaw] = useMemory<string>('corpen:wheel', '');
  const angle = typed.n('an') ?? 90;
  const angleOk = angle > 0 && angle < 180;
  // the ship's own figures for this turn: advance, transfer, time to turn, the speed lost (and so the distance lost) come from her turning data
  const tkn = typed.n('kn');
  const pick = ship && angleOk && tkn !== null && tkn > 0 ? lookupTurn(ship, turnSide, tkn, angle, wheelRaw === '' ? undefined : Number(wheelRaw)) : null;
  const r1 = (v: number) => String(Math.round(v * 10) / 10);
  const f = useForm('corpen', CF, pick ? {
    adv: r1(pick.advance), tr: r1(pick.transfer), tt: String(Math.round(pick.seconds)),
    ...(pick.loss !== undefined ? { ls: r1(yardsRun(pick.loss / 2, pick.seconds)) } : {}),
  } : undefined);
  const kn = f.n('kn'), dc = f.n('dc'), adv = f.n('adv'), tr = f.n('tr'), tt = f.n('tt'), rg = f.n('rg'), ls = f.n('ls');
  const ok = kn !== null && kn > 0;
  const stop = ok && dc !== null && dc > 0 ? stopwatchSeconds(dc * YD_PER_CABLE, kn!) : null;
  const col = angleOk && mode === 'column' && ok && dc !== null && adv !== null && tt !== null ? columnTurn({ knots: kn!, distance: dc * YD_PER_CABLE, advance: adv, transfer: tr ?? adv, turnSeconds: tt, regainSeconds: rg ?? 0, angle }) : null;
  const abr = mode === 'abreast' && ok && dc !== null && tr !== null && tt !== null ? abreastTurn({ knots: kn!, range: dc * YD_PER_CABLE, transfer: tr, turnSeconds: tt, lossYards: ls ?? 0 }) : null;
  const t = col ?? abr;
  const bears = t ? 90 - Math.round(t.radian) : null;
  const right = angle === 90;
  const deg1 = (v: number) => `${Math.round(v * 10) / 10}°`;

  return (
    <div className="space-y-2">
      <Seg value={mode} onChange={v => setMode(v as 'column' | 'abreast')} options={[['column', 'Corpen (Guide ahead)'], ['abreast', "Corpen 'S' (abreast)"]]} />
      <Panel title="Station" note={mode === 'column' ? 'Own ship stationed astern of the Guide. The Guide alters course by Corpen; you follow to the same turning point, or turn early by the radian rule.' : 'Ships abreast. The Guide turns at once and the other ship continues ahead, then turns early so as to end abreast of the Guide.'}>
        <Grid><Field label="Speed" unit="kn" units {...f.bind('kn')} /><Field label={mode === 'column' ? 'Distance astern' : 'Distance abeam'} unit="cables" {...f.bind('dc')} /></Grid>
        <Field label="Angle of turn" unit="°" hint="90" {...typed.bind('an')} />
        <SideToggle label="Turning to" value={turnSide} onChange={setTurnSide} />
        {!angleOk && <Warn>The angle of turn must be more than 0° and less than 180°.</Warn>}
      </Panel>
      {pick && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 space-y-1.5">
          <p className="text-[11px] font-bold text-emerald-800">Turning data of {ship!.name}: {pick.interpolatedSpeed ? `between ${pick.speedFrom} and ${pick.speedTo} kn` : `${pick.speed} kn`}, {pick.wheel}° wheel, {deg1(angle)} to {turnSide.toLowerCase()}</p>
          {pick.wheels.length > 1 && <div className="flex gap-1 flex-wrap">{pick.wheels.map(w => <button key={w} type="button" onClick={() => setWheelRaw(String(w))} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${pick.wheel === w ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>{w}° wheel</button>)}</div>}
          <p className="text-[10px] text-emerald-700 font-medium leading-snug">Advance, transfer, time to turn{pick.loss !== undefined ? ' and the distance lost (from the speed lost in the turn)' : ''} below come from it; type over any to use another figure.{pick.outsideTurn ? ' The turn is more than the largest recorded: the largest is used.' : ''}</p>
        </div>
      )}
      {!pick && ship && angleOk && tkn !== null && tkn > 0 && <p className="text-[10px] font-semibold text-slate-400">{ship.name} has no turning data for a turn to {turnSide.toLowerCase()}: enter the figures below by hand, or add them under Calibration Data, Turning Trials.</p>}
      <Panel title={`Own ship's turn (${deg1(angle)})`} closed={!pick && right} note={`From the ship's turning data for a ${deg1(angle)} turn, taken from the ship when it has it. Transfer is taken as the advance if left blank. The time of the turn is how long she takes to complete it.`}>
        <Grid>{mode === 'column' && <Field label="Advance" unit="yd" {...f.bind('adv')} />}<Field label="Transfer" unit="yd" {...f.bind('tr')} /></Grid>
        <Grid><Field label="Time to turn" unit="s" {...f.bind('tt')} />{mode === 'column' ? <Field label="Time to regain speed" unit="s" {...f.bind('rg')} /> : <Field label="Distance lost in turn" unit="yd" {...f.bind('ls')} />}</Grid>
      </Panel>
      {stop !== null && mode === 'column' && (
        <Result rows={[
          ['Stopwatch', `alter ${mmss(stop)} after the Guide orders the wheel over`],
          ...(col && right ? [['Radian rule', `alter when the Guide bears ${bears}° off your bow on the ${turnSide.toLowerCase()} side (${col.radian.toFixed(1)}°; exact ${col.exact.toFixed(1)}°, so ${(90 - col.exact).toFixed(0)}°)`] as [string, string], ['Guide runs meanwhile', `${Math.round(col.guideRun)} yd`] as [string, string]] : []),
          ...(col && !right ? [['Alter when', `the Guide bears ${deg1(col.bearing)} off your bow on the ${turnSide.toLowerCase()} side (by the geometry of the turn; the radian rule is for a 90° turn)`] as [string, string], ['Own ship turns', col.early >= 0 ? `${Math.round(col.early)} yd before the Guide's wheel-over point` : `${Math.round(-col.early)} yd after the Guide's wheel-over point`] as [string, string], ['Guide runs meanwhile', `${Math.round(col.guideRun)} yd`] as [string, string]] : []),
        ]} />
      )}
      {abr && !right && <Warn>The school's abreast rule is worked for a 90° turn: for another angle this is only an estimate, from the ship's transfer and time for that turn.</Warn>}
      {abr && <Result rows={[
        ['Guide draws ahead', `${Math.round(abr.netAhead)} yd (Guide runs ${Math.round(abr.guideRun)} yd in the turn)`],
        ['Radian rule', `alter when the Guide bears ${bears}° off your beam toward the bow (${abr.radian.toFixed(1)}°; exact ${abr.exact.toFixed(1)}°)`],
      ]} />}
      {mode === 'column' && !col && stop === null && <p className="text-[11px] text-slate-500 font-medium">Enter speed and distance for the stopwatch time, and the turn data for the radian-rule bearing.</p>}
      <Panel title="Other ways to judge it" closed note="True mark: when the Guide wheels, put a true mark on her blip on the PPI; she must keep coming toward own ship, and when her blip is at the centre, order the wheel. Follow the wake: trace the Guide's path with your bow in the middle of her wake and turn when the bow tends to leave it. The wake is clearer on the inner side (made by the bow) and diffuse on the outer side (made by the stern). Whichever you use, watch the Guide and check bearing and range." >
        <p className="text-[11px] text-slate-500 font-medium leading-snug">The radian rule is L = R x angle / 60. In a column, for a 90° turn tan(angle) = advance / (transfer + (distance - Guide's run)). For another angle of turn the bearing comes from the same picture with the angle: own ship starts the turn (advance - transfer / tan(turn)) short of the Guide's wheel-over point.</p>
      </Panel>
    </div>
  );
};

// ---- Regain Track ----------------------------------------------------------------------------------------------------------------
const RF = ['kn', 'off', 'th', 'min', 'st', 'sk'] as const;
export const RegainTrackTool: React.FC = () => {
  const f = useForm('regain', RF);
  const kn = f.n('kn'), off = f.n('off'), th = f.n('th'), min = f.n('min'), st = f.n('st'), sk = f.n('sk');
  const ok = kn !== null && kn > 0 && off !== null && off >= 0;
  const dist = ok && th !== null && th > 0 ? distanceToRegain(off!, th) : null;                 // cables
  const runCables = ok && min !== null && min > 0 ? yardsRun(kn!, min * 60) / YD_PER_CABLE : null;
  const need = runCables !== null ? throwOffToRegain(off!, runCables) : null;
  const allow = st !== null && sk !== null ? streamAllowance(st, sk) : null;
  return (
    <div className="space-y-2">
      <Panel title="Off track" note="How far off the track you are, in cables, and your speed.">
        <Grid><Field label="Off track" unit="cables" {...f.bind('off')} /><Field label="Speed" unit="kn" units {...f.bind('kn')} /></Grid>
      </Panel>
      <Panel title="Time to regain, for a throw-off" note="Alter by a throw-off angle toward the track; the distance to run is off-track x 60 / angle.">
        <Field label="Throw-off angle" unit="°" {...f.bind('th')} />
        {dist !== null && <Result inline rows={[['Distance to regain track', `${dist.toFixed(1)} cables`], ['Time at this speed', mmss((dist * YD_PER_CABLE * 3600) / (kn! * 2000))]]} />}
      </Panel>
      <Panel title="Throw-off for a time to regain" note="Say how soon you want to be back on track.">
        <Field label="Regain track in" unit="min" {...f.bind('min')} />
        {need !== null && <Result inline rows={[['Distance run', `${runCables!.toFixed(1)} cables`], ['Throw-off needed', `${need.toFixed(1)}°`]]} />}
      </Panel>
      <Panel title="Holding the track in a stream" closed note="To stay on track with a stream across it, steer into the stream by an angle whose sine is stream speed / own speed.">
        <Grid><Field label="Stream rate" unit="kn" {...f.bind('st')} /><Field label="Own speed" unit="kn" {...f.bind('sk')} /></Grid>
        {allow !== null && <Result inline rows={[['Steer into the stream by', `${allow.toFixed(1)}°`]]} />}
        {st !== null && sk !== null && allow === null && <p className="text-[11px] text-amber-700 font-medium">The stream is as fast as the ship or faster: she cannot hold the track.</p>}
      </Panel>
    </div>
  );
};

// ---- RAS approach ----------------------------------------------------------------------------------------------------------------
// The Guide (supplier) and the approach ship (receiver) are picked from the fleet; their bridge, RAS point and fuelling point positions and their
// breadths come from the ships' particulars (a figure typed in a box takes the place of the ship's). The sums are in rasApproach.ts.
// 'spk', the surge in yards per knot, and 'sepm', the distance between the ships in metres, are new boxes: the old 'dr' held a deceleration rate
// in knots a minute and 'sep' a separation in feet
const AF = ['brg', 'rc', 'gs', 'as', 'spk', 'sepm', 'sb', 'gb', 'gr', 'gf', 'gw', 'gl', 'ab', 'ar', 'af', 'aw', 'arad'] as const;
const SWEEP = [3, 4, 5, 6, 7, 8];   // speed advantages worked out together, as on the bridge's surge sheet
export const RasApproachTool: React.FC<{ ship?: Ship; fleet?: Ship[] }> = ({ ship, fleet }) => {
  const ships = fleet && fleet.length ? fleet : ship ? [ship] : [];
  const [evo, setEvo] = useMemory<Evolution>('rasapp:evo', 'RASAP');
  const [guideId, setGuideId] = useMemory<string>('rasapp:guide', '');
  const [apprId, setApprId] = useMemory<string>('rasapp:appr', '');
  const [side, setSide] = useMemory<'Port' | 'Starboard'>('rasapp:side', 'Port');
  const approach = ships.find(s => s.id === apprId) ?? ship ?? ships[0];
  const guide = ships.find(s => s.id === guideId && s.id !== approach?.id) ?? ships.find(s => s.id !== approach?.id);
  const [rigRaw, setRig] = useMemory<string>('rasapp:rig', '');
  const rigs = alongsideRigs(guide);
  const rig = evo !== 'SKBDL' ? rigs.find(r => r.name === rigRaw) : undefined;   // the Guide's rig picked for a RAS or fuelling approach
  const gd0 = dimsOf(guide), rigAt = rig && rig.stemDistance > 0 ? rig.stemDistance : undefined;
  const gd = rig ? { ...gd0, [EVOLUTIONS[evo].point]: rigAt } : gd0, ad = dimsOf(approach);
  const decelM = shipParams(approach).decelMetresPerKnot, perKnot = decelM !== undefined ? decelM / 0.9144 : undefined;   // her surge, yd per knot, from her deceleration runs
  const str = (v: number | undefined) => (v === undefined ? undefined : String(Math.round(v * 10) / 10));
  const f = useForm('rasapp2', AF, { gb: str(gd.bridge), gr: str(gd.ras), gf: str(gd.fuel), gw: str(gd.breadth), ab: str(ad.bridge), ar: str(ad.ras), af: str(ad.fuel), aw: str(ad.breadth), arad: str(ad.radar), gl: str(gd.length), spk: str(perKnot), sepm: '42', sb: '500' });
  const brg = f.n('brg'), rc = f.n('rc'), gs = f.n('gs'), as = f.n('as'), dr = f.n('spk'), sepM = f.n('sepm') ?? 42, sb = f.n('sb') ?? 500;
  const guideDims: Dims = { bridge: f.n('gb') ?? undefined, ras: f.n('gr') ?? undefined, fuel: f.n('gf') ?? undefined, breadth: f.n('gw') ?? undefined, length: f.n('gl') ?? undefined };
  const apprDims: Dims = { bridge: f.n('ab') ?? undefined, ras: f.n('ar') ?? undefined, fuel: f.n('af') ?? undefined, breadth: f.n('aw') ?? undefined, radar: f.n('arad') ?? undefined };
  const p = gs !== null && as !== null && dr !== null ? plan({ evolution: evo, guide: guideDims, approach: apprDims, guideSpeed: gs, approachSpeed: as, surgeYdPerKnot: dr, separationM: sepM, standbyYd: sb }) : null;
  const others = p && p.missing.length === 0 ? sweep({ evolution: evo, guide: guideDims, approach: apprDims, guideSpeed: gs!, approachSpeed: as!, surgeYdPerKnot: dr!, separationM: sepM, standbyYd: sb }, SWEEP) : [];
  // her stern from your bridge: theta forward of the beam on the side she is on; as a relative bearing, 90 - theta off the bow
  const sternRel = (t: number) => `${side === 'Port' ? 'Red' : 'Green'} ${Math.round(90 - t)}`;
  const point = EVOLUTIONS[evo].pointName;
  // the course to steer on the approach: the Guide's point at a bearing and range from the approach ship's bridge, to pass at the final lateral distance
  const lateralFt = sepM / 0.3048;
  const theta = rc !== null && rc > 0 ? angleForSeparation(lateralFt, rc) : null;
  const steer = theta !== null && brg !== null ? norm(brg + (side === 'Port' ? theta : -theta)) : null;
  const sel = 'w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700';
  const [diagram, setDiagram] = useState(false);
  const diagramBox = useRef<HTMLDivElement>(null);
  useBackLayer(diagram, () => setDiagram(false), 2);
  const len = (sh?: Ship) => { const l = sh?.particulars?.lengthOverall; return l !== undefined && l > 0 ? l : undefined; };
  return (
    <div className="space-y-2">
      <Panel title="Evolution" note="What is matched at the final station: the two bridges, the two RAS points or the two fuelling points.">
        <Seg value={evo} onChange={v => setEvo(v as Evolution)} options={(Object.keys(EVOLUTIONS) as Evolution[]).map(k => [k, k] as const)} />
        <p className="text-[11px] font-semibold text-slate-500">{EVOLUTIONS[evo].label}</p>
      </Panel>
      <Panel title="The ships" note="The Guide supplies; the approach ship comes alongside. Their figures come from the ships' own data; type in a box to use another figure.">
        <div className={evo !== 'SKBDL' && rigs.length > 0 ? 'grid grid-cols-[1fr_8.5rem] gap-2' : ''}>
          <label className="block space-y-1 min-w-0"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guide ship</span>
            <select value={guide?.id ?? ''} onChange={e => setGuideId(e.target.value)} className={sel}>{ships.filter(s => s.id !== approach?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {evo !== 'SKBDL' && rigs.length > 0 && (
            <label className="block space-y-1 min-w-0"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rig</span>
              <select value={rig?.name ?? ''} aria-label="The Guide's rig" className={sel} onChange={e => {
                const r = rigs.find(x => x.name === e.target.value); setRig(e.target.value);
                f.bind(EVOLUTIONS[evo].point === 'ras' ? 'gr' : 'gf').onChange('');                          // the rig's own position, not a figure typed for another
                if (r?.side === 'Port' || r?.side === 'Starboard') setSide(r.side === 'Starboard' ? 'Port' : 'Starboard');   // her starboard rig: she is on your port side
              }}>
                <option value="">Ship's data</option>
                {rigs.map(r => <option key={r.name} value={r.name}>{`${r.name}${r.stemDistance > 0 ? ` · ${r.stemDistance} m` : ' · not set'}`}</option>)}
              </select></label>
          )}
        </div>
        <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approach ship</span>
          <select value={approach?.id ?? ''} onChange={e => setApprId(e.target.value)} className={sel}>{ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <p className="text-[10px] font-semibold text-slate-400">Metres from the stem. Guide</p>
        <Grid><Field label="Bridge" unit="m" {...f.bind('gb')} /><Field label="RAS point" unit="m" {...f.bind('gr')} /><Field label="Fuelling point" unit="m" {...f.bind('gf')} /><Field label="Breadth" unit="m" {...f.bind('gw')} /><Field label="Length overall" unit="m" {...f.bind('gl')} /></Grid>
        <p className="text-[10px] font-semibold text-slate-400">Approach ship</p>
        <Grid><Field label="Bridge" unit="m" {...f.bind('ab')} /><Field label="RAS point" unit="m" {...f.bind('ar')} /><Field label="Fuelling point" unit="m" {...f.bind('af')} /><Field label="Breadth" unit="m" {...f.bind('aw')} /><Field label="Radar" unit="m" {...f.bind('arad')} /></Grid>
      </Panel>
      <Panel title="Speeds and slowing" note="The approach ship runs up at the approach speed and comes down to the Guide's. The surge is her own figure in yards per knot of speed advantage, from her deceleration runs when they are recorded.">
        <Grid><Field label="Guide's speed" unit="kn" units {...f.bind('gs')} /><Field label="Approach speed" unit="kn" units {...f.bind('as')} /></Grid>
        <Grid><Field label="Surge" unit="yd per knot" {...f.bind('spk')} /><Field label="Distance between ships" unit="m" {...f.bind('sepm')} /></Grid>
        <Field label="Stand-by station astern of the final station" unit="yd" {...f.bind('sb')} />
      </Panel>
      {p && p.missing.length > 0 && <Warn>Needs {p.missing.join(', ')}{rig && !rigAt ? ` (${rig.name}'s position is not set)` : ''}: enter it in the box above or in the ship's particulars.</Warn>}
      {p && p.missing.length === 0 && (
        <Result rows={[
          ['Speed advantage', `${p.advantage.toFixed(1)} kn`],
          ['Surge', `${Math.round(p.surgeYd)} yd = ${p.surgeM.toFixed(1)} m (${p.advantage.toFixed(1)} kn x ${dr} yd)`],
          ['x, her stern to your stem', p.xM >= 0 ? `${p.xM.toFixed(1)} m clear` : `${(-p.xM).toFixed(1)} m overlap`],
          ['Start slowing when her stern bears', `θ ${p.thetaDeg.toFixed(1)}° ${p.thetaDeg >= 0 ? 'forward of' : 'abaft'} your ${side.toLowerCase()} beam (${sternRel(p.thetaDeg)}) from the bridge`],
          ...(p.radar ? [['From your radar, her stern', `${Math.round(Math.abs(p.radar.rangeM) / 0.9144)} yd (${Math.round(Math.abs(p.radar.rangeM))} m) ${p.radar.rangeM >= 0 ? 'ahead' : 'abaft'} along the ship, ${p.radar.thetaDeg.toFixed(1)}° forward of the beam (${sternRel(p.radar.thetaDeg)})`] as [string, string]] : []),
          ['Then, at the final station', `${point}s abreast; your stem ${Math.abs(p.stemOffsetM).toFixed(1)} m ${p.stemOffsetM >= 0 ? 'ahead of' : 'astern of'} hers`],
          ['From the stand-by station', p.atOnce ? 'slow at once: it is inside the surge' : `run ${Math.round(p.runYd)} yd (${p.runMinutes.toFixed(1)} min at the advantage), then slow`],
        ]} />
      )}
      {others.length > 0 && (
        <Panel title="At other speeds" closed note={`The same worked at other speed advantages over the Guide's ${gs} kn.`}>
          <table className="w-full text-[11px] font-bold text-slate-700 tabular-nums">
            <thead><tr className="text-[9px] uppercase tracking-wider text-slate-400 text-right"><th className="text-left py-1">Advantage</th><th>Speed</th><th>Surge</th><th>x</th><th>θ</th></tr></thead>
            <tbody>{others.map(({ advantage: a, plan: q }) => q && (
              <tr key={a} className={`text-right border-t border-slate-100 ${Math.abs(a - p!.advantage) < 1e-9 ? 'bg-blue-50 text-blue-700' : ''}`}>
                <td className="text-left py-1">{a} kn</td><td>{gs! + a} kn</td><td>{Math.round(q.surgeYd)} yd</td><td>{q.xM.toFixed(1)} m</td><td>{q.thetaDeg.toFixed(1)}°</td>
              </tr>))}</tbody>
          </table>
        </Panel>
      )}
      {p && p.missing.length === 0 && (
        <button type="button" onClick={() => setDiagram(true)} className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold active:scale-95">
          <Info size={16} /> Diagram: the approach seen from above
        </button>
      )}
      {diagram && p && p.missing.length === 0 && createPortal(
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-3 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setDiagram(false)}>
          <div role="dialog" aria-label="RAS approach diagram" className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl p-4 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <div><h3 className="font-bold text-slate-900">{evo}: the approach from above</h3>
                <p className="text-[11px] font-bold"><span style={{ color: KNOWN }}>● given</span> <span className="ml-2" style={{ color: CALC }}>● worked out</span></p></div>
              <button onClick={() => setDiagram(false)} aria-label="Close" className="p-2 bg-slate-50 text-slate-400 rounded-full shrink-0"><X size={18} /></button>
            </div>
            <div ref={diagramBox}><RasDiagram pointName={point} side={side} guideName={guide?.name ?? 'Guide'} approachName={approach?.name ?? 'Approach ship'}
              guide={{ ...guideDims, length: len(guide) }} approach={{ ...apprDims, length: len(approach) }} pointKey={EVOLUTIONS[evo].point}
              separationM={sepM} standbyYd={sb} plan={p} /></div>
            <button type="button" onClick={() => { const svg = diagramBox.current?.querySelector('svg'); if (svg) void saveSvgAsPng(svg, `RAS ${evo} ${guide?.name ?? ''} ${approach?.name ?? ''}`.trim()); }}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95"><Download size={16} /> Save the diagram as a picture</button>
            <ul className="text-[11px] text-slate-600 font-medium leading-snug space-y-1">
              <li><b style={{ color: CALC }}>Surge</b> = speed advantage x surge per knot = ({as} - {gs}) kn x {dr} yd = <b style={{ color: CALC }}>{Math.round(p.surgeYd)} yd</b>, the distance she gains on the Guide while coming down to her speed.</li>
              <li><b style={{ color: CALC }}>x</b> = surge - her {point} to her stern - your stem to your {point} = {p.surgeM.toFixed(1)} - {p.pointToStern.toFixed(1)} - {apprDims[EVOLUTIONS[evo].point]} = <b style={{ color: CALC }}>{p.xM.toFixed(1)} m</b> ({p.xM >= 0 ? 'clear of her stern' : 'your bow overlaps her quarter'}).</li>
              <li><b style={{ color: CALC }}>θ</b> = tan⁻¹((x + your stem to bridge) / distance between ships) = tan⁻¹(({p.xM.toFixed(1)} + {apprDims.bridge}) / {sepM}) = <b style={{ color: CALC }}>{p.thetaDeg.toFixed(1)}°</b>: start slowing when her stern bears that far forward of your beam.</li>
{p.radar && <li><b style={{ color: CALC }}>Radar</b>: her stern is x + your stem to radar = {p.xM.toFixed(1)} + {apprDims.radar} = <b style={{ color: CALC }}>{Math.round(p.radar.rangeM / 0.9144)} yd</b> ahead of your radar along the ship, at {p.radar.thetaDeg.toFixed(1)}° forward of the beam.</li>}
              <li><b style={{ color: CALC }}>Stems</b>: the {point}s abreast puts your stem {Math.abs(p.stemOffsetM).toFixed(1)} m {p.stemOffsetM >= 0 ? 'ahead of' : 'astern of'} hers ({apprDims[EVOLUTIONS[evo].point]} m and {guideDims[EVOLUTIONS[evo].point]} m from the stems).</li>
            </ul>
          </div>
        </div>, document.body,   // outside NavYeo's panel, which would clip it
      )}
      {p === null && gs !== null && as !== null && as <= gs && <Warn>The approach ship needs a speed above the Guide's.</Warn>}
      <Panel title="Course to steer on the approach" closed note={`The bearing and range of the Guide's ${point} from your bridge now, and the side the Guide is on. The course leaves the final lateral distance between the ships' centre lines.`}>
        <Grid><Field label={`Bearing of her ${point}`} unit="°T" {...f.bind('brg')} /><Field label="Range" unit="cables" {...f.bind('rc')} /></Grid>
        <SideToggle label="Guide to your" value={side} onChange={setSide} />
        {theta !== null && <Result inline rows={[['Angle off for the separation', `${theta.toFixed(1)}° (L = R x angle x 10)`], ...(steer !== null ? [['Steer', bearing(steer)] as [string, string]] : [])]} />}
      </Panel>
    </div>
  );
};
