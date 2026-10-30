import React from 'react';
import { Field, Grid, Mini, Panel, Result, Seg, bearing, useForm, useMemory } from './kit';
import { norm360 } from './navMath';
import { OwnFormula } from './OwnFormula';
import { radarPicture, solve } from './stationTurn';
import type { Input, Radar } from './stationTurn';
import { lookupTurn } from './turnLookup';
import { shipParams } from './shipParams';
import type { Ship } from '../types';

// Station from Bows (Joining from Ahead, BR 45(6) para 0425): the Wheel-Over Point for the turn that brings own ship onto station on the
// Guide, worked back from the station (see stationTurn.ts). Two pictures: the working, with the Guide at the centre, north up (B to G are its
// points); and own ship's radar, own ship at the centre, with the EBL and VRM to set for the wheel-over and the Guide's blips coming in to it.

const FIELDS = ['gc', 'gs', 'ac', 'as', 'sb', 'sd', 'mg', 'adv', 'tr', 'loss', 'dec', 'tm', 'ts'] as const;
const STATIONS: [string, number][] = [['Ahead', 0], ['Bow 045', 45], ['Beam 090', 90], ['Quarter 135', 135], ['Astern 180', 180]];
const relName = (rel: number) => (Math.abs(rel) < 0.5 || Math.abs(Math.abs(rel) - 180) < 0.5 ? String(Math.round(Math.abs(rel))).padStart(3, '0') : `${rel > 0 ? 'Green' : 'Red'} ${String(Math.round(Math.abs(rel))).padStart(2, '0')}`) + '°';
const SIZE = 300, C = SIZE / 2;
const cables = (yd: number) => `${(yd / 200).toFixed(1)} cables`;

export const StationFromBowsTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const typed = useForm('stturn', FIELDS);
  const [mside, setMside] = useMemory<'Starboard' | 'Port'>('stturn:mside', 'Starboard');
  const [sSide, setSSide] = useMemory<'Port' | 'Starboard'>('stturn:sside', 'Starboard');
  const [turn, setTurn] = useMemory<'Auto' | 'Port' | 'Starboard'>('stturn:turn', 'Auto');
  const [wheelRaw, setWheelRaw] = useMemory<string>('stturn:wheel', '');
  const [view, setView] = useMemory<'calc' | 'radar'>('stturn:view', 'radar');
  const [headUp, setHeadUp] = useMemory('stturn:headup', true);
  // the ship's own turning data for this turn: the side and amount follow from the approach and Guide courses
  const tgc = typed.n('gc'), tac = typed.n('ac'), tas = typed.n('as');
  const raw = tgc !== null && tac !== null ? ((tgc - tac + 540) % 360) - 180 : null;
  const turnAngle = raw === null ? null : turn === 'Port' ? (raw > 0 ? raw - 360 : raw) : turn === 'Starboard' ? (raw < 0 ? raw + 360 : raw) : raw;
  const pick = ship && turnAngle !== null && tas !== null && tas > 0 ? lookupTurn(ship, turnAngle < 0 ? 'Port' : 'Starboard', tas, turnAngle, wheelRaw === '' ? undefined : Number(wheelRaw)) : null;
  const decelYd = ship ? shipParams(ship).decelMetresPerKnot : undefined;
  const r1 = (v: number) => String(Math.round(v * 10) / 10);
  const f = useForm('stturn', FIELDS, pick ? {
    adv: r1(pick.advance), tr: r1(pick.transfer), tm: String(Math.floor(pick.seconds / 60)), ts: String(Math.round(pick.seconds % 60)),
    ...(pick.loss !== undefined ? { loss: r1(pick.loss) } : {}), ...(decelYd !== undefined ? { dec: r1(decelYd / 0.9144) } : {}),
  } : decelYd !== undefined ? { dec: r1(decelYd / 0.9144) } : undefined);
  const n = (k: typeof FIELDS[number]) => f.n(k);
  const gc = n('gc'), gs = n('gs'), ac = n('ac'), aspd = n('as'), sb = n('sb'), sd = n('sd');
  const ready = gc !== null && gs !== null && gs >= 0 && ac !== null && aspd !== null && aspd >= 0 && sb !== null && sd !== null && sd >= 0;
  const secs = (n('tm') ?? 0) * 60 + (n('ts') ?? 0);
  const input: Input | null = ready ? { guideCourse: gc!, guideSpeed: gs!, approachCourse: ac!, approachSpeed: aspd!, stationBearing: sb!, stationDistance: sd!, margin: n('mg') ?? 0, marginSide: mside,
    advance: n('adv') ?? 0, transfer: n('tr') ?? 0, speedLoss: n('loss') ?? 0, decelPerKnot: n('dec') ?? 0, turnSeconds: secs, turn } : null;
  const s = input ? solve(input) : null;
  // the radar: enough whole minutes of the approach to see the blip come in (about twice the wheel-over range), 2 to 8
  const rad1 = Math.PI / 180;
  const ydMin = input ? Math.hypot(gs! * Math.sin(gc! * rad1) - aspd! * Math.sin(ac! * rad1), gs! * Math.cos(gc! * rad1) - aspd! * Math.cos(ac! * rad1)) * 2000 / 60 : 0;
  const radar = input && s ? radarPicture(input, s, ydMin > 0 ? Math.max(2, Math.min(8, Math.floor((2 * s.guideDistance) / ydMin))) : 0) : null;

  const pts = s ? (['B', 'C', 'D', 'E', 'F', 'G'] as const).map(k => [k, s.points[k]] as const) : [];
  const reach = Math.max(200, ...pts.map(([, p]) => Math.hypot(p.x, p.y))) * 1.15, k = (C - 20) / reach;
  const [calcUp, setCalcUp] = useMemory('stturn:calcheadup', false);
  const rot = calcUp && gc !== null ? (-gc * Math.PI) / 180 : 0;   // head up: turn the plot so the Guide's course is up
  const xy = (p: { x: number; y: number }) => { const x = p.x * Math.cos(rot) + p.y * Math.sin(rot), y = -p.x * Math.sin(rot) + p.y * Math.cos(rot); return { x: C + x * k, y: C - y * k }; };

  return (
    <div className="space-y-2">
      <Panel title="Guide" note="True course and speed of the Guide.">
        <Grid><Field label="Guide's course" unit="°T" {...f.bind('gc')} /><Field label="Guide's speed" unit="kn" units {...f.bind('gs')} /></Grid>
      </Panel>
      <Panel title="Own approach" note="Your true course and speed before the turn. The turn is onto the Guide's course. A reciprocal approach is easiest; an oblique one is more prone to error.">
        <Grid><Field label="Approach course" unit="°T" {...f.bind('ac')} /><Field label="Approach speed" unit="kn" units {...f.bind('as')} /></Grid>
        <Seg value={turn} onChange={v => setTurn(v as 'Auto' | 'Port' | 'Starboard')} options={[['Auto', 'Shorter turn'], ['Port', 'Turn to port'], ['Starboard', 'Turn to starboard']]} />
      </Panel>
      <Panel title="Station" note="The station as a true bearing from the Guide and a distance in yards, and the safety margin kept to one side of the Guide.">
        <Seg value={sSide} onChange={v => setSSide(v as 'Port' | 'Starboard')} options={[['Starboard', 'Starboard of the Guide'], ['Port', 'Port of the Guide']]} />
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Preset stations">{STATIONS.map(([name, a]) => <button key={name} type="button" disabled={gc === null} onClick={() => f.bind('sb').onChange(String(((gc! + (sSide === 'Starboard' ? a : -a)) % 360 + 360) % 360))} className="shrink-0 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 disabled:opacity-40">{name}</button>)}</div>
        <Grid><Field label="True bearing from Guide" unit="°T" {...f.bind('sb')} /><Field label="Distance" unit="yd" {...f.bind('sd')} /></Grid>
        <Field label="Lateral safety margin" unit="yd" {...f.bind('mg')} />
        <Seg value={mside} onChange={v => setMside(v as 'Starboard' | 'Port')} options={[['Starboard', 'Margin to starboard'], ['Port', 'Margin to port']]} />
      </Panel>
      {pick && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 space-y-1.5">
          <p className="text-[11px] font-bold text-emerald-800">Turning data of {ship!.name}: {pick.interpolatedSpeed ? `between ${pick.speedFrom} and ${pick.speedTo} kn` : `${pick.speed} kn`}, {pick.wheel}° wheel, {Math.round(Math.abs(turnAngle!))}° to {turnAngle! < 0 ? 'port' : 'starboard'}</p>
          {pick.wheels.length > 1 && <div className="flex gap-1 flex-wrap">{pick.wheels.map(w => <button key={w} type="button" onClick={() => setWheelRaw(String(w))} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${pick.wheel === w ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>{w}° wheel</button>)}</div>}
          <p className="text-[10px] text-emerald-700 font-medium leading-snug">Advance, transfer, turn time{pick.loss !== undefined ? ', loss of speed' : ''}{decelYd !== undefined ? ' and deceleration distance' : ''} below come from it; type over any to use another figure.{pick.outsideTurn ? ' The turn is more than the largest recorded: the largest is used.' : ''}{pick.loss === undefined ? ' The speed after the turn is not recorded, so the loss of speed is not filled in.' : ''}</p>
        </div>
      )}
      {!pick && ship && turnAngle !== null && tas !== null && <p className="text-[10px] font-semibold text-slate-400">{ship.name} has no turning data for a turn to {turnAngle < 0 ? 'port' : 'starboard'}: enter the figures below by hand, or add them under Calibration Data, Turning Trials.</p>}
      <Panel title="The turn" note="From the ship's turning data at the approach speed when it is recorded: advance and transfer, the speed lost in the turn, the deceleration distance per knot (about 33 yards a knot) and the time the turn takes.">
        <Grid><Field label="Advance" unit="yd" {...f.bind('adv')} /><Field label="Transfer" unit="yd" {...f.bind('tr')} /></Grid>
        <Grid><Field label="Loss of speed in turn" unit="kn" {...f.bind('loss')} /><Field label="Deceleration distance" unit="yd/kn" {...f.bind('dec')} /></Grid>
        <Grid><Field label="Turn time" unit="min" {...f.bind('tm')} /><Field label="and" unit="sec" {...f.bind('ts')} /></Grid>
      </Panel>
      {s ? (
        <>
          <Result rows={[
            ['Wheel over when the Guide bears', `${relName(s.relativeBearing)} (${bearing(s.guideBearing)}T)`],
            ['at a distance of', `${Math.round(s.guideDistance)} yd`],
            ['Lateral separation then', `${Math.round(s.lateralSeparation)} yd (if inadequate, delay or abort)`],
            ['Turn', `${Math.abs(Math.round(s.turnAngle))}° to ${s.turnAngle < 0 ? 'port' : 'starboard'}`],
            ['Guide runs during the turn', `${Math.round(s.guideRun)} yd`],
            ['Speed variant', `${s.variant}${Math.abs(s.correction) >= 0.5 ? `: turn ${Math.round(Math.abs(s.correction))} yd ${s.correction > 0 ? 'later' : 'earlier'}` : ''}`],
          ]} />
          <Panel title="Picture" note={view === 'calc' ? 'The working, with the Guide (A) at the centre: own ship runs in along the approach course to G, the Wheel-Over Point.' : "Your radar, own ship at the centre. Set the EBL and VRM where shown: when the Guide's blip reaches them, wheel over. Her blips are shown each minute before, coming in along her relative track."}>
            <div className="flex justify-end"><Mini label="Picture" value={view} onChange={v => setView(v as 'calc' | 'radar')} options={[['radar', 'Radar'], ['calc', 'Working']]} /></div>
            {view === 'calc' && (
              <>
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Station from bows plot" className="w-full max-w-sm mx-auto bg-slate-900 rounded-2xl">
                {[0.33, 0.66, 1].map(r => <circle key={r} cx={C} cy={C} r={(C - 20) * r} fill="none" stroke="#334155" strokeWidth={0.8} />)}
                <line x1={C} y1={C} x2={C} y2={C - (C - 20)} stroke="#475569" strokeWidth={0.8} strokeDasharray="3 3" />
                <text x={C} y={14} textAnchor="middle" fontSize={9} fill="#94a3b8">{calcUp ? `Guide's head ${bearing(gc!)}` : 'N'} · {Math.round(reach)} yd</text>
                <polyline points={['G', 'F', 'E', 'D', 'C', 'B'].map(l => { const p = xy(s.points[l as 'B']); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
                <circle cx={C} cy={C} r={4} fill="#e2e8f0" /><text x={C + 7} y={C + 3} fontSize={10} fill="#e2e8f0" fontWeight={700}>A</text>
                {pts.map(([l, p]) => { const q = xy(p); return <g key={l}><circle cx={q.x} cy={q.y} r={3.2} fill={l === 'G' ? '#22c55e' : '#f8fafc'} /><text x={q.x + 6} y={q.y - 4} fontSize={10} fill={l === 'G' ? '#22c55e' : '#f8fafc'} fontWeight={700}>{l}</text></g>; })}
                <line x1={C} y1={C} x2={xy(s.points.G).x} y2={xy(s.points.G).y} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 3" />
                <text x={(C + xy(s.points.G).x) / 2 + 4} y={(C + xy(s.points.G).y) / 2 + 12} fontSize={9} fill="#22c55e" fontWeight={700}>{bearing(norm360(s.guideBearing + 180))} {Math.round(s.guideDistance)} yd</text>
              </svg>
              <div className="flex justify-end"><Mini label="Picture orientation" value={calcUp ? 'head' : 'north'} onChange={v => setCalcUp(v === 'head')} options={[['head', 'H Up'], ['north', 'N Up']]} /></div>
              </>
            )}
            {view === 'radar' && radar && <RadarPpi radar={radar} approach={ac!} headUp={headUp} />}
            {view === 'radar' && <div className="flex justify-end"><Mini label="Picture orientation" value={headUp ? 'head' : 'north'} onChange={v => setHeadUp(v === 'head')} options={[['head', 'H Up'], ['north', 'N Up']]} /></div>}
            {view === 'radar' && radar && (
              <table className="w-full text-[11px] font-bold text-slate-700 tabular-nums">
                <thead><tr className="text-[9px] uppercase tracking-wider text-slate-400 text-right"><th className="text-left py-1">Guide at</th><th>Relative</th><th>True</th><th>Range</th></tr></thead>
                <tbody>
                  {[...radar.blips, radar.wheelOver].map(b => (
                    <tr key={b.minutes} className={`text-right border-t border-slate-100 ${b.minutes === 0 ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                      <td className="text-left py-1">{b.minutes === 0 ? 'Wheel over' : `${-b.minutes} min before`}</td>
                      <td>{relName(b.relativeBearing)}</td><td>{bearing(b.trueBearing)}</td><td>{Math.round(b.range)} yd · {cables(b.range)}</td>
                    </tr>
                  ))}
                  <tr className="text-right border-t border-slate-100 text-slate-500"><td className="text-left py-1">On station</td><td>{relName(((radar.onStation.trueBearing - gc! + 540) % 360) - 180)}*</td><td>{bearing(radar.onStation.trueBearing)}</td><td>{Math.round(radar.onStation.range)} yd · {cables(radar.onStation.range)}</td></tr>
                </tbody>
              </table>
            )}
            {view === 'radar' && radar && <p className="text-[10px] text-slate-400 font-medium leading-snug">The Guide's relative track during the approach: {bearing(radar.relCourse)} at {radar.relSpeed.toFixed(1)} kn. *On station the relative bearing is from your new head, the Guide's course. The blips assume steady courses and speeds up to the wheel-over; the path during the turn is not drawn.</p>}
          </Panel>
          <Panel title="Working" closed note="Worked back from the station. 2000 yards to the n mile.">
            <ol className="text-[11px] text-slate-600 font-medium leading-snug list-decimal pl-4 space-y-0.5">
              <li>B, the station: {Math.round(sd!)} yd on {bearing(sb!)} from the Guide (A).</li>
              <li>C, the aim point: B moved {Math.round(n('mg') ?? 0)} yd to the Guide's {mside.toLowerCase()} side.</li>
              <li>D: C moved back by the transfer, {Math.round(n('tr') ?? 0)} yd on {bearing(s.transferBearing + 180)} (the turn carries her {bearing(s.transferBearing)}).</li>
              <li>E: D laid back by the advance, {Math.round(n('adv') ?? 0)} yd on {bearing(ac! + 180)}.</li>
              <li>F: speed correction ({aspd} - {n('loss') ?? 0} - {gs} = {s.excess.toFixed(1)} kn) x {n('dec') ?? 0} yd/kn = {Math.round(s.correction)} yd, {s.correction >= 0 ? 'laid back along' : 'laid forward along'} the Guide's course ({s.correction >= 0 ? 'later' : 'earlier'} turn).</li>
              <li>G, the Wheel-Over Point: F moved {Math.round(s.guideRun)} yd on {bearing(gc!)}, the Guide's run in {Math.floor(secs / 60)} min {Math.round(secs % 60)} s.</li>
            </ol>
          </Panel>
        </>
      ) : <p className="text-[11px] text-slate-500 font-medium">Enter the Guide's course and speed, your approach course and the station.</p>}
      <OwnFormula id="stationturn" unitHint="" vars={[{ name: 'W', label: 'guide bearing from wheel-over (°T)', value: s ? s.guideBearing : null }, { name: 'R', label: 'guide distance from wheel-over (yd)', value: s ? s.guideDistance : null }, { name: 'G', label: 'guide run in the turn (yd)', value: s ? s.guideRun : null }]} />
    </div>
  );
};

/** Own ship's radar for the wheel-over: own ship at the centre, head up (approach course) or north up; the EBL and VRM through the Guide's
 *  position at the wheel-over, her blips coming in each minute before, and where she lies once on station. */
const RadarPpi: React.FC<{ radar: Radar; approach: number; headUp: boolean }> = ({ radar, approach, headUp }) => {
  const w = radar.wheelOver;
  const reach = Math.max(w.range, radar.onStation.range, ...radar.blips.map(b => b.range)) * 1.12, k = (C - 18) / reach;
  const up = headUp ? approach : 0;   // the bearing drawn at the top
  const at = (x: number, y: number) => { const a = Math.atan2(x, y) - (up * Math.PI) / 180, r = Math.hypot(x, y) * k; return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }; };
  const edge = (brg: number) => at(Math.sin((brg * Math.PI) / 180) * reach * 0.98, Math.cos((brg * Math.PI) / 180) * reach * 0.98);
  const W = at(w.x, w.y), ebl = edge(w.trueBearing), head = edge(approach), st = at(radar.onStation.x, radar.onStation.y);
  const ring = reach / 3;
  const track = [...radar.blips, w].map(b => at(b.x, b.y));
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Own ship's radar picture" className="w-full max-w-sm mx-auto bg-slate-950 rounded-full">
      {[1, 2, 3].map(r => <circle key={r} cx={C} cy={C} r={ring * r * k} fill="none" stroke="#14532d" strokeWidth={0.8} />)}
      {[1, 2, 3].map(r => <text key={r} x={C + 3} y={C - ring * r * k + 10} fontSize={8} fill="#166534">{Math.round(ring * r)} yd</text>)}
      <line x1={C} y1={C} x2={head.x} y2={head.y} stroke="#4ade80" strokeWidth={0.8} />
      <text x={head.x} y={head.y + (headUp ? 10 : 0)} textAnchor="middle" fontSize={8} fill="#4ade80">{headUp ? 'Head' : 'SHM'} {bearing(approach)}</text>
      {!headUp && <text x={C} y={12} textAnchor="middle" fontSize={8} fill="#86efac">N</text>}
      {/* the EBL: a dashed line, green with the Guide to starboard, red to port */}
      <line x1={C} y1={C} x2={ebl.x} y2={ebl.y} stroke={w.relativeBearing >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={1.6} strokeDasharray="7 4" />
      <circle cx={C} cy={C} r={w.range * k} fill="none" stroke="#facc15" strokeWidth={1.2} strokeDasharray="3 3" />
      <text x={C} y={C + w.range * k + 11} textAnchor="middle" fontSize={9} fontWeight={700} fill="#facc15">VRM {Math.round(w.range)} yd</text>
      <polyline points={track.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#38bdf8" strokeWidth={1} strokeDasharray="2 3" />
      {radar.blips.map((b, j) => { const p = track[j]; return <g key={b.minutes}><circle cx={p.x} cy={p.y} r={2.6} fill="#38bdf8" opacity={0.45 + (0.55 * (j + 1)) / radar.blips.length} /><text x={p.x + 5} y={p.y + 3} fontSize={8} fill="#7dd3fc">{b.minutes}′</text></g>; })}
      <circle cx={W.x} cy={W.y} r={5} fill="none" stroke="#22c55e" strokeWidth={2} />
      <text x={W.x + 7} y={W.y - 6} fontSize={9} fontWeight={700} fill="#22c55e">Wheel over</text>
      <line x1={W.x} y1={W.y} x2={st.x} y2={st.y} stroke="#a78bfa" strokeWidth={0.8} strokeDasharray="1 3" />
      <circle cx={st.x} cy={st.y} r={3.5} fill="none" stroke="#a78bfa" strokeWidth={1.5} />
      <text x={st.x + 6} y={st.y + 10} fontSize={8} fill="#c4b5fd">on station</text>
      <circle cx={C} cy={C} r={3} fill="#f8fafc" />
    </svg>
  );
};
