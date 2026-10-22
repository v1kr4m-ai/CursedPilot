import React from 'react';
import { Field, Grid, Panel, Result, Seg, bearing, useForm, useMemory } from './kit';
import { OwnFormula } from './OwnFormula';
import { solve } from './stationTurn';

// Station from Bows (Joining from Ahead, BR 45(6) para 0425): the Wheel-Over Point for the turn that brings own ship onto station on the
// Guide, worked back from the station (see stationTurn.ts). The plot has the Guide at the centre, north up; B to G are the points of the working.

const FIELDS = ['gc', 'gs', 'ac', 'as', 'sb', 'sd', 'mg', 'adv', 'tr', 'loss', 'dec', 'tm', 'ts'] as const;
const STATIONS: [string, number][] = [['Ahead', 0], ['Bow 045', 45], ['Beam 090', 90], ['Quarter 135', 135], ['Astern 180', 180]];
const relName = (rel: number) => (Math.abs(rel) < 0.5 || Math.abs(Math.abs(rel) - 180) < 0.5 ? String(Math.round(Math.abs(rel))).padStart(3, '0') : `${rel > 0 ? 'Green' : 'Red'} ${String(Math.round(Math.abs(rel))).padStart(2, '0')}`) + '°';
const SIZE = 300, C = SIZE / 2;

export const StationFromBowsTool: React.FC = () => {
  const f = useForm('stturn', FIELDS);
  const [mside, setMside] = useMemory<'Starboard' | 'Port'>('stturn:mside', 'Starboard');
  const [sSide, setSSide] = useMemory<'Port' | 'Starboard'>('stturn:sside', 'Starboard');
  const [turn, setTurn] = useMemory<'Auto' | 'Port' | 'Starboard'>('stturn:turn', 'Auto');
  const n = (k: typeof FIELDS[number]) => f.n(k);
  const gc = n('gc'), gs = n('gs'), ac = n('ac'), aspd = n('as'), sb = n('sb'), sd = n('sd');
  const ready = gc !== null && gs !== null && gs >= 0 && ac !== null && aspd !== null && aspd >= 0 && sb !== null && sd !== null && sd >= 0;
  const secs = (n('tm') ?? 0) * 60 + (n('ts') ?? 0);
  const s = ready ? solve({ guideCourse: gc!, guideSpeed: gs!, approachCourse: ac!, approachSpeed: aspd!, stationBearing: sb!, stationDistance: sd!, margin: n('mg') ?? 0, marginSide: mside,
    advance: n('adv') ?? 0, transfer: n('tr') ?? 0, speedLoss: n('loss') ?? 0, decelPerKnot: n('dec') ?? 0, turnSeconds: secs, turn }) : null;

  const pts = s ? (['B', 'C', 'D', 'E', 'F', 'G'] as const).map(k => [k, s.points[k]] as const) : [];
  const reach = Math.max(200, ...pts.map(([, p]) => Math.hypot(p.x, p.y))) * 1.15, k = (C - 20) / reach;
  const xy = (p: { x: number; y: number }) => ({ x: C + p.x * k, y: C - p.y * k });

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
      <Panel title="The turn" note="From the ship's turning data at the approach speed: advance and transfer, the speed lost in the turn, the deceleration distance per knot (about 33 yards a knot) and the time the turn takes.">
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
          <Panel title="Plot" note="Guide at the centre, north up. Own ship runs in along the approach course to G, the Wheel-Over Point.">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Station from bows plot" className="w-full max-w-sm mx-auto bg-slate-900 rounded-2xl">
              {[0.33, 0.66, 1].map(r => <circle key={r} cx={C} cy={C} r={(C - 20) * r} fill="none" stroke="#334155" strokeWidth={0.8} />)}
              <line x1={C} y1={C} x2={C} y2={C - (C - 20)} stroke="#475569" strokeWidth={0.8} strokeDasharray="3 3" />
              <text x={C} y={14} textAnchor="middle" fontSize={9} fill="#94a3b8">N · {Math.round(reach)} yd</text>
              <polyline points={['G', 'F', 'E', 'D', 'C', 'B'].map(l => { const p = xy(s.points[l as 'B']); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={1.8} />
              <circle cx={C} cy={C} r={4} fill="#e2e8f0" /><text x={C + 7} y={C + 3} fontSize={10} fill="#e2e8f0" fontWeight={700}>A</text>
              {pts.map(([l, p]) => { const q = xy(p); return <g key={l}><circle cx={q.x} cy={q.y} r={3.2} fill={l === 'G' ? '#22c55e' : '#f8fafc'} /><text x={q.x + 6} y={q.y - 4} fontSize={10} fill={l === 'G' ? '#22c55e' : '#f8fafc'} fontWeight={700}>{l}</text></g>; })}
              <line x1={C} y1={C} x2={xy(s.points.G).x} y2={xy(s.points.G).y} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 3" />
            </svg>
          </Panel>
          <Panel title="Working" closed note="Worked back from the station. 2000 yards to the n mile.">
            <ol className="text-[11px] text-slate-600 font-medium leading-snug list-decimal pl-4 space-y-0.5">
              <li>B, the station: {Math.round(sd!)} yd on {bearing(sb!)} from the Guide (A).</li>
              <li>C, the aim point: B moved {Math.round(n('mg') ?? 0)} yd to the Guide's {mside.toLowerCase()} side.</li>
              <li>D: C moved by the transfer, {Math.round(n('tr') ?? 0)} yd on {bearing(s.transferBearing)}.</li>
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
