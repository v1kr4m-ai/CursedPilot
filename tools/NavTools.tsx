import React, { useMemo, useState } from 'react';
import { Anchor, ArrowLeftRight, Camera, ArrowUpDown, Target, Calculator, Clock, Compass, Eye, LifeBuoy, MapPin, Navigation, Radar, RotateCw, Ship as ShipIcon, Sun, Waves } from 'lucide-react';
import { Ship } from '../types';
import { interpolateData } from '../fishtail/utils/interpolation';
import { shipToFishtailRows } from '../fishtail/shipBridge';
import { shipParams } from './shipParams';
import { deviationAt } from './compassSwing';
import * as nav from './navMath';
import { RescueTurn, Side, TURNS, circleLookup, rescue, turnsFor as mobTurnsFor } from './manOverboard';

import { AstroTool } from './AstroTool';
import { CpaPpi } from './CpaPpi';
import { OwnFormula } from './OwnFormula';
import { CameraBearing } from './CameraBearing';
import { MapPick, coordText } from './MapPick';
import { askCompassPermission } from '../services/position';
import { TidesTool } from './TidesTool';
import { AnchorTool } from './AnchorTool';
import { DistanceOffTool } from './DistanceOffTool';
import { BattenbergTool } from './BattenbergTool';
import { parseClock } from './sunSights';
import { Field, Grid, LengthField, Panel, Result, SELECT, Seg, SideToggle, UnitPick, Warn, bearing, fromNm, hhmm, toNum, useForm, useMemory, useUnit } from './kit';

// ---- tools -------------------------------------------------------------------------------------

const BearingTool: React.FC = () => {
  const f = useForm('bearing', ['brg', 'head', 'rel', 'var'] as const);
  const [relSide, setRelSide] = useMemory<'Port' | 'Starboard'>('bearing:side', 'Starboard');
  const [camera, setCamera] = useState(false);
  const brg = f.n('brg'), head = f.n('head'), rel = f.n('rel'), vari = f.n('var');
  return (
    <div className="space-y-3">
      <Panel title="Reciprocal bearing">
        <Field label="Bearing or course" unit="°" {...f.bind('brg')} />
        {brg !== null && <Result rows={[['Reciprocal', bearing(nav.reciprocal(brg))]]} />}
      </Panel>
      <Panel title="Relative to true bearing">
        <Grid>
          <Field label="Ship's head" unit="°T" sensor="course" {...f.bind('head')} />
          <Field label="Relative bearing" unit="° off the bow" {...f.bind('rel')} />
        </Grid>
        <SideToggle label="Object is on the" value={relSide} onChange={setRelSide} />
        {head !== null && rel !== null && rel >= 0 && rel <= 180 && <Result rows={[['True bearing', bearing(nav.trueBearing(head, relSide === 'Port' ? -rel : rel))], ['Relative', `${relSide === 'Port' ? 'Red' : 'Green'} ${String(Math.round(rel)).padStart(3, '0')}`]]} />}
        {rel !== null && (rel < 0 || rel > 180) && <Warn>Enter the angle off the bow, 0 to 180, and choose the side.</Warn>}
        <Field label="Variation" unit="° E+ W-" {...f.bind('var')} />
        <button type="button" onClick={() => { void askCompassPermission(); setCamera(true); }} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold active:scale-95"><Camera size={16} />Take a bearing with the camera</button>
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Point the phone at the ship or object and mark: the phone's compass gives the magnetic bearing, the variation makes it true, and the ship's head gives the relative bearing. The phone compass is thrown off by steel, so check it against the ship's compass.</p>
        {camera && <CameraBearing shipHead={head} variation={vari} onClose={() => setCamera(false)} onUse={m => { if (m.off !== null && m.side) { f.bind('rel').onChange(String(Math.round(m.off))); setRelSide(m.side); } }} />}
      </Panel>
    <OwnFormula id="bearing" unitHint="°" vars={[{ name: 'brg', label: 'bearing or course (°)', value: brg }, { name: 'head', label: 'ship head (°T)', value: head }, { name: 'rel', label: 'relative bearing (°)', value: rel }, { name: 'var', label: 'variation (°)', value: vari }]} />
    </div>
  );
};

/** Start time (seconds into the day) plus a run of minutes, as HH:MM:SS with a day count when it passes midnight. */
const etaText = (startSec: number, minutes: number) => {
  const total = Math.round(startSec + minutes * 60), day = Math.floor(total / 86400), s = ((total % 86400) + 86400) % 86400;
  const t = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
  return day > 0 ? `${t} (+${day} day${day > 1 ? 's' : ''})` : t;
};

const TsdTool: React.FC = () => {
  const f = useForm('tsd', ['d', 's', 't', 'start'] as const);
  const [unit, setUnit] = useUnit('tsd:unit');
  const typed = f.n('d');
  const given = [typed, f.n('s'), f.n('t')].filter(x => x !== null).length;
  const r = nav.solveTSD({ distance: typed === null ? null : nav.convertLength(typed, unit, 'nm'), speed: f.n('s'), minutes: f.n('t') });
  const label = r && { distance: 'Distance', speed: 'Speed', minutes: 'Time' }[r.solved];
  const startSec = parseClock(f.v.start);
  const eta = r && startSec !== null && Number.isFinite(r.minutes) ? etaText(startSec, r.minutes) : null;
  return (
    <div className="space-y-3">
    <Panel title="Time, speed, distance" note="Fill any two, leave the third blank.">
      <LengthField label="Distance" unit={unit} onUnit={setUnit} {...f.bind('d')} />
      <Grid>
        <Field label="Speed" unit="kn" sensor="speed" {...f.bind('s')} />
        <Field label="Time" unit="min" {...f.bind('t')} />
      </Grid>
      <Field label="Start time (for the ETA)" kind="time" {...f.bind('start')} />
      {r && <Result rows={[
        [label!, r.solved === 'distance' ? fromNm(r.distance, unit) : r.solved === 'speed' ? `${r.speed.toFixed(1)} kn` : `${r.minutes.toFixed(1)} min (${hhmm(r.minutes)})`],
        ...(eta !== null ? [['ETA', eta] as [string, string]] : []),
      ]} />}
      {given === 2 && !r && <Warn>Speed and time must be above zero where they are divided by.</Warn>}
    </Panel>
    <OwnFormula id="tsd" unitHint="" vars={[{ name: 'd', label: 'distance (nm)', value: r ? r.distance : null }, { name: 's', label: 'speed (kn)', value: r ? r.speed : null }, { name: 't', label: 'time (min)', value: r ? r.minutes : null }]} />
    </div>
  );
};

/** Decimal degrees as degrees and minutes to a tenth: 1.5 -> 1\u00B0 30.0'. */
const dmText = (v: number) => { const a = Math.abs(v); let d = Math.floor(a), m = Math.round((a - d) * 600) / 10; if (m >= 60) { d += 1; m = 0; } return `${v < 0 ? '-' : ''}${d}\u00B0 ${m.toFixed(1)}'`; };

const RadianTool: React.FC = () => {
  const f = useForm('radian', ['dist', 'range'] as const);
  const [ud, setUd] = useUnit('radian:dist');
  const [ur, setUr] = useUnit('radian:range');
  const d = f.n('dist'), r = f.n('range');
  const dm = d === null ? null : nav.convertLength(d, ud, 'metres'), rm = r === null ? null : nav.convertLength(r, ur, 'metres');

  // interpolation between two readings of range and angle, as from a table
  const g = useForm('radian-interp', ['r1', 'a1', 'r2', 'a2', 'want'] as const);
  const [find, setFind] = useMemory<'angle' | 'range'>('radian:find', 'angle');
  const [imode, setImode] = useMemory<'linear' | 'inverse'>('radian:imode', 'linear');
  const [uri, setUri] = useUnit('radian:interp');
  const r1 = g.n('r1'), r2 = g.n('r2'), a1 = nav.parseAngle(g.v.a1), a2 = nav.parseAngle(g.v.a2);
  const wantAngle = nav.parseAngle(g.v.want), wantRange = g.n('want');
  let found: string | null = null;
  if (r1 !== null && r2 !== null && a1 !== null && a2 !== null) {
    if (find === 'angle' && wantRange !== null) { const v = nav.interpolate(r1, a1, r2, a2, wantRange, imode); if (v !== null) found = dmText(v); }
    if (find === 'range' && wantAngle !== null) { const v = nav.interpolate(a1, r1, a2, r2, wantAngle, imode); if (v !== null) found = nav.formatLength(v, uri); }
  }
  const outside = (find === 'angle' ? wantRange !== null && r1 !== null && r2 !== null && (wantRange < Math.min(r1, r2) || wantRange > Math.max(r1, r2))
    : wantAngle !== null && a1 !== null && a2 !== null && (wantAngle < Math.min(a1, a2) || wantAngle > Math.max(a1, a2)));
  return (
    <div className="space-y-3">
      <Panel title="Radian rule (angle = distance / range)" note="Gives the angle subtended in degrees. The two lengths may be in different units.">
        <LengthField label="Distance off" unit={ud} onUnit={setUd} {...f.bind('dist')} />
        <LengthField label="Range" unit={ur} onUnit={setUr} {...f.bind('range')} />
        {dm !== null && rm !== null && rm > 0 && <Result rows={[['Angle', `${nav.radianAngle(dm, rm).toFixed(2)}\u00B0`]]} />}
      </Panel>
      <Panel title="Interpolate between two readings" note="Enter two known pairs of range and angle (from a table or from two sights) and the value in between. Straight line is how a table is read; Inverse follows the radian rule, where the angle falls as the range grows, and is the better choice over a wide span.">
        <UnitPick label="Ranges in" unit={uri} onChange={setUri} />
        <Grid>
          <Field label="Range 1" unit={nav.LENGTH_UNITS[uri].short} {...g.bind('r1')} />
          <Field label="Angle 1" unit="° ′" kind="angle" {...g.bind('a1')} />
          <Field label="Range 2" unit={nav.LENGTH_UNITS[uri].short} {...g.bind('r2')} />
          <Field label="Angle 2" unit="° ′" kind="angle" {...g.bind('a2')} />
        </Grid>
        <Seg value={find} onChange={v => setFind(v as 'angle' | 'range')} options={[['angle', 'Find the angle'], ['range', 'Find the range']]} />
        <Seg value={imode} onChange={v => setImode(v as 'linear' | 'inverse')} options={[['linear', 'Straight line'], ['inverse', 'Inverse (radian rule)']]} />
        {find === 'angle'
          ? <Field label="Range wanted" unit={nav.LENGTH_UNITS[uri].short} {...g.bind('want')} />
          : <Field label="Angle wanted" unit="° ′" kind="angle" {...g.bind('want')} />}
        {found && <Result rows={[[find === 'angle' ? 'Angle' : 'Range', found]]} />}
        {found && outside && <Warn>That is outside the two readings, so the answer is carried beyond them and is less reliable.</Warn>}
        {r1 !== null && r2 !== null && r1 === r2 && <Warn>The two ranges must be different.</Warn>}
      </Panel>
    <OwnFormula id="radian" unitHint="°" vars={[{ name: 'D', label: 'distance off (m)', value: dm }, { name: 'R', label: 'range (m)', value: rm }, { name: 'angle', label: 'angle (°)', value: dm !== null && rm !== null && rm > 0 ? nav.radianAngle(dm, rm) : null }]} />
    </div>
  );
};

const CpaTool: React.FC = () => {
  const f = useForm('cpa', ['oc', 'os', 'brg', 'rng', 'tc', 'ts'] as const);
  const [unit, setUnit] = useUnit('cpa:unit');
  const v = ['oc', 'os', 'brg', 'rng', 'tc', 'ts'].map(k => f.n(k as 'oc'));
  const ready = v.every(x => x !== null);
  const input: nav.CpaInput | null = ready ? { ownCourse: v[0]!, ownSpeed: v[1]!, bearing: v[2]!, range: nav.convertLength(v[3]!, unit, 'nm'), targetCourse: v[4]!, targetSpeed: v[5]! } : null;
  const r = input ? nav.cpa(input) : null;
  const geo = input ? nav.cpaGeometry(input) : null;
  const [headUp, setHeadUp] = useMemory('cpa:headup', true);
  return (
    <div className="space-y-3">
    <Panel title="CPA / TCPA" note="True bearing, true courses, speeds through the ground. Assumes both vessels hold course and speed.">
      <Grid>
        <Field label="Own course" unit="°T" sensor="course" {...f.bind('oc')} />
        <Field label="Own speed" unit="kn" sensor="speed" {...f.bind('os')} />
        <Field label="Target bearing" unit="°T" {...f.bind('brg')} />
        <Field label="Target course" unit="°T" {...f.bind('tc')} />
        <Field label="Target speed" unit="kn" units {...f.bind('ts')} />
      </Grid>
      <LengthField label="Target range" unit={unit} onUnit={setUnit} {...f.bind('rng')} />
      {r && (
        <Result tone={r.status === 'closing' && r.cpa < 1 ? 'warn' : 'ok'} rows={[
          ['CPA', fromNm(r.cpa, unit)],
          ['TCPA', r.tcpaMinutes === null ? (r.status === 'steady' ? 'no relative motion' : 'past, opening') : `${r.tcpaMinutes.toFixed(1)} min`],
          ...(r.status === 'closing' && r.cpa >= 0.01 ? [['Bearing at CPA', bearing(r.bearingAtCpa)] as [string, string]] : []),
          ...(r.relativeCourse !== null ? [['Relative track', `${bearing(r.relativeCourse)} at ${r.relativeSpeed.toFixed(1)} kn`] as [string, string]] : []),
          ...(geo?.side ? [['Passes on your', `${geo.side} side`] as [string, string]] : []),
          ...(geo?.crossing ? [[geo.crossing.where === 'bow' ? 'Bow crossing range' : 'Stern crossing range', fromNm(geo.crossing.rangeNm, unit)] as [string, string], [geo.crossing.where === 'bow' ? 'Bow crossing time' : 'Stern crossing time', `${geo.crossing.minutes.toFixed(1)} min`] as [string, string]] : []),
        ]} />
      )}
      {input && r && (
        <>
          <Seg value={headUp ? 'head' : 'north'} onChange={v => setHeadUp(v === 'head')} options={[['head', 'Head-up'], ['north', 'North-up']]} />
          <CpaPpi input={input} headUp={headUp} />
        </>
      )}
    </Panel>
    <OwnFormula id="cpa" unitHint="" vars={[{ name: 'oc', label: 'own course (°T)', value: v[0] }, { name: 'os', label: 'own speed (kn)', value: v[1] }, { name: 'brg', label: 'target bearing (°T)', value: v[2] }, { name: 'rng', label: 'range (nm)', value: input ? input.range : null }, { name: 'tc', label: 'target course (°T)', value: v[4] }, { name: 'ts', label: 'target speed (kn)', value: v[5] }, { name: 'cpa', label: 'CPA (nm)', value: r ? r.cpa : null }, { name: 'tcpa', label: 'TCPA (min)', value: r ? r.tcpaMinutes : null }]} />
    </div>
  );
};

const CtsTool: React.FC = () => {
  const f = useForm('cts', ['track', 'speed', 'set', 'drift', 'dist'] as const);
  const [unit, setUnit] = useUnit('cts:unit');
  const [track, speed, set, drift] = ['track', 'speed', 'set', 'drift'].map(k => f.n(k as 'track'));
  const ready = track !== null && speed !== null && set !== null && drift !== null;
  const r = ready ? nav.courseToSteer(track!, speed!, set!, drift!) : null;
  const typed = f.n('dist');
  const distNm = typed === null ? null : nav.convertLength(typed, unit, 'nm');
  return (
    <div className="space-y-3">
    <Panel title="Course to steer (set and drift)" note="Speed is through the water. Set is the direction the current flows towards.">
      <Grid>
        <Field label="Track to make good" unit="°T" {...f.bind('track')} />
        <Field label="Ship speed" unit="kn" sensor="speed" {...f.bind('speed')} />
        <Field label="Set" unit="°T" {...f.bind('set')} />
        <Field label="Drift" unit="kn" units {...f.bind('drift')} />
      </Grid>
      <LengthField label="Distance to run (optional)" unit={unit} onUnit={setUnit} {...f.bind('dist')} />
      {r && ('error' in r ? <Warn>{r.error}</Warn> : (
        <Result rows={[
          ['Course to steer', bearing(r.cts)],
          ['Allowance', `${Math.abs(r.allowance).toFixed(1)}\u00B0 ${r.allowance < 0 ? 'to port' : r.allowance > 0 ? 'to starboard' : ''}`.trim()],
          ['Speed over ground', `${r.sog.toFixed(1)} kn`],
          ...(distNm !== null && distNm >= 0 ? [['Time to run', hhmm((distNm / r.sog) * 60)] as [string, string]] : []),
        ]} />
      ))}
    </Panel>
    <OwnFormula id="cts" unitHint="" vars={[{ name: 'track', label: 'track (°T)', value: track }, { name: 'speed', label: 'ship speed (kn)', value: speed }, { name: 'set', label: 'set (°T)', value: set }, { name: 'drift', label: 'drift (kn)', value: drift }, { name: 'cts', label: 'course to steer (°)', value: r && !('error' in r) ? r.cts : null }, { name: 'sog', label: 'speed over ground (kn)', value: r && !('error' in r) ? r.sog : null }]} />
    </div>
  );
};

type TurnRow = ReturnType<typeof shipToFishtailRows>[number];

/** The ship's recorded turning data, grouped by speed, wheel and side. */
function useTurnTables(ship?: Ship) {
  const rows = useMemo(() => (ship ? shipToFishtailRows(ship) : []), [ship]);
  return useMemo(() => {
    const m = new Map<string, { speed: number; rudder: number; side: 'port' | 'starboard'; label: string; rows: TurnRow[] }>();
    rows.forEach(r => {
      const key = `${r.ownSpeed}|${r.rudder}|${r.side}`;
      if (!m.has(key)) m.set(key, { speed: Number(r.ownSpeed), rudder: Number(r.rudder), side: r.side === 'port' ? 'port' : 'starboard', label: `${r.ownSpeed} kn, ${r.rudder}° wheel, ${r.side === 'port' ? 'port' : 'starboard'}`, rows: [] });
      m.get(key)!.rows.push(r);
    });
    return [...m.entries()];
  }, [rows]);
}

const WheelOverTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const f = useForm('wheel', ['turn', 'adv', 'tr'] as const);
  const [unit, setUnit] = useUnit('wheel:unit');
  const tables = useTurnTables(ship);
  const [side, setSide] = useMemory<Side>('wheel:side', 'Starboard');
  const [source, setSource] = useMemory<'data' | 'manual'>('wheel:source', 'data');
  const [speedRaw, setSpeed] = useMemory('wheel:speed', '');
  const [wheelRaw, setWheel] = useMemory('wheel:wheel', '');

  // the turning data for this side: speed first, then the wheel angles recorded at that speed
  const onSide = tables.filter(([, t]) => t.side === (side === 'Port' ? 'port' : 'starboard'));
  const speeds = [...new Set(onSide.map(([, t]) => t.speed))].sort((a, b) => Number(a) - Number(b));
  const speed = speeds.includes(Number(speedRaw)) && speedRaw !== '' ? Number(speedRaw) : speeds[0];
  const wheels = [...new Set(onSide.filter(([, t]) => t.speed === speed).map(([, t]) => t.rudder))].sort((a, b) => Number(a) - Number(b));
  const wheel = wheels.includes(Number(wheelRaw)) && wheelRaw !== '' ? Number(wheelRaw) : wheels[0];
  const table = source === 'data' ? onSide.find(([, t]) => t.speed === speed && t.rudder === wheel)?.[1] : undefined;
  const haveData = tables.length > 0;

  // everything is worked in yards, the unit of the recorded turning data
  const turn = f.n('turn');
  let adv = source === 'manual' ? (f.n('adv') === null ? null : nav.convertLength(f.n('adv')!, unit, 'yards')) : null;
  let tr = source === 'manual' ? (f.n('tr') === null ? null : nav.convertLength(f.n('tr')!, unit, 'yards')) : null;
  let outside = false;
  if (table && turn !== null && Math.abs(turn) >= 1) {
    outside = Math.abs(turn) > Math.max(...table.rows.map(r => r.heading));
    ({ advance: adv, transfer: tr } = interpolateData(Math.abs(turn), table.rows));
  }
  const dist = adv !== null && tr !== null && turn !== null ? nav.wheelOverDistance(adv, tr, turn) : null;
  const show = (yd: number) => nav.formatLength(nav.convertLength(yd, 'yards', unit), unit);

  return (
    <div className="space-y-3">
    <Panel title="Wheel-over point" note="Approximate: takes advance and transfer at the heading change and assumes the ship is on the new track by the end of the turn. Confirm against your ship's own turning trials and standing orders.">
      <Field label="Course alteration" unit="°" {...f.bind('turn')} />
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alter to</span>
        <div className="flex gap-1">
          {(['Port', 'Starboard'] as const).map(sd => (
            <button key={sd} onClick={() => setSide(sd)} className={`flex-1 py-3 rounded-xl text-xs font-bold border ${side === sd ? (sd === 'Port' ? 'bg-red-600 border-red-600' : 'bg-green-600 border-green-600') + ' text-white' : 'bg-white text-slate-500 border-slate-200'}`}>{sd}</button>
          ))}
        </div>
      </div>
      <Seg value={source} onChange={v => setSource(v as 'data' | 'manual')} options={[['data', 'From turning data'], ['manual', 'Enter advance and transfer']]} />
      {source === 'data' && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          {!haveData && <Warn>No turning data for {ship ? ship.name : 'a ship'}. Add or import it under Calibration Data, Turning Trials, or enter advance and transfer by hand.</Warn>}
          {haveData && speeds.length === 0 && <Warn>No {side.toLowerCase()} turning data recorded. Choose the other side or enter advance and transfer by hand.</Warn>}
          {speeds.length > 0 && (
            <Grid>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speed</span>
                <select value={speed} onChange={e => setSpeed(e.target.value)} className={`${SELECT} w-full`}>{speeds.map(s => <option key={s} value={s}>{s} kn</option>)}</select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wheel</span>
                <select value={wheel} onChange={e => setWheel(e.target.value)} className={`${SELECT} w-full`}>{wheels.map(w => <option key={w} value={w}>{w}° wheel</option>)}</select>
              </label>
            </Grid>
          )}
          <UnitPick label="Distances in" unit={unit} onChange={setUnit} />
        </div>
      )}
      {source === 'manual' && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <LengthField label="Advance" unit={unit} onUnit={setUnit} {...f.bind('adv')} />
          <Field label="Transfer" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('tr')} />
        </div>
      )}
      {outside && <Warn>That alteration is larger than anything in the table, so the largest recorded advance and transfer are used. Treat the result with caution.</Warn>}
      {turn !== null && Math.abs(turn) >= 1 && Math.abs(turn) < 180 && adv !== null && tr !== null && dist !== null && (
        <Result rows={[
          ['Alter to', `${side} ${Math.abs(turn)}°`],
          ...(table ? [['Advance / transfer', `${show(adv)} / ${show(tr)}`] as [string, string]] : []),
          ['Wheel over', `${show(dist)} before the turn point`],
          ...(unit !== 'yards' ? [['', `${Math.round(dist)} yd`] as [string, string]] : []),
        ]} />
      )}
      {turn !== null && (Math.abs(turn) < 1 || Math.abs(turn) >= 180) && <Warn>Enter an alteration between 1° and 179°.</Warn>}
    </Panel>
    <OwnFormula id="wheelover" unitHint="yd" vars={[{ name: 'turn', label: 'alteration (°)', value: turn }, { name: 'adv', label: 'advance (yd)', value: adv }, { name: 'tr', label: 'transfer (yd)', value: tr }, { name: 'wo', label: 'wheel-over distance (yd)', value: dist }]} />
    </div>
  );
};

const MobTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [unit, setUnit] = useUnit('mob:unit');
  const tables = useTurnTables(ship);
  const [tableKey, setTableKey] = useMemory('mob:table', '');
  const [kind, setKind] = useMemory<RescueTurn>('mob:kind', 'williamson');
  const [side, setSide] = useMemory<Side>('mob:side', 'Starboard');
  const [source, setSource] = useMemory<'data' | 'manual'>('mob:source', 'data');
  const mf = useForm('mob', ['speed', 'dia'] as const);
  const mSpeed = mf.n('speed'), mDia = mf.n('dia');
  const picked = tables.find(([k]) => k === tableKey) ?? tables[0];
  const table = picked?.[1];
  const useData = source === 'data' && !!table;
  const maxTurn = useData ? Math.max(...table!.rows.map(r => r.heading)) : 360;
  const needed = Math.max(...mobTurnsFor(kind, side).map(Math.abs));
  const manualOk = source === 'manual' && mSpeed !== null && mSpeed > 0 && mDia !== null && mDia > 0;
  const out = useData ? rescue(kind, side, a => interpolateData(a, table!.rows)) : manualOk ? rescue(kind, side, circleLookup(mSpeed!, nav.convertLength(mDia!, unit, 'yards'))) : null;
  const show = (yd: number) => nav.formatLength(nav.convertLength(Math.abs(yd), 'yards', unit), unit);
  const mm = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
  const greenRed = (b: number) => (b <= 180 ? `Green ${String(Math.round(b)).padStart(3, '0')}` : `Red ${String(Math.round(360 - b)).padStart(3, '0')}`);

  return (
    <div className="space-y-3">
    <Panel title="Man overboard turn" note="Worked from the ship's own turning data, taking the man as not drifting and the ship as steady on each new heading at the end of its turn. An aid only: follow the ship's standing orders and the situation, and use the quickest method for the circumstances.">
      <Seg value={source} onChange={v => setSource(v as 'data' | 'manual')} options={[['data', "From ship's data"], ['manual', 'Normal (enter a turning circle)']]} />
      {source === 'data' && (!ship || tables.length === 0) && <Warn>This needs turning data for the selected ship. Add or import it under Calibration Data, Turning Trials, or switch to Normal.</Warn>}
      {(source === 'manual' || tables.length > 0) && (
        <>
          <Seg value={kind} onChange={v => setKind(v as RescueTurn)} options={[['williamson', 'Williamson'], ['scharnow', 'Scharnow']]} />
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Man fell overboard on the</span>
            <div className="flex gap-1">
              {(['Port', 'Starboard'] as const).map(sd => (
                <button key={sd} onClick={() => setSide(sd)} className={`flex-1 py-3 rounded-xl text-xs font-bold border ${side === sd ? (sd === 'Port' ? 'bg-red-600 border-red-600' : 'bg-green-600 border-green-600') + ' text-white' : 'bg-white text-slate-500 border-slate-200'}`}>{sd}</button>
              ))}
            </div>
          </div>
          {source === 'data' ? (
            <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Turning data</span>
            <select value={picked?.[0] ?? ''} onChange={e => setTableKey(e.target.value)} className={`${SELECT} w-full`}>
              {tables.map(([k, t]) => <option key={k} value={k}>{ship.name}: {t.label}</option>)}
            </select>
          </label>
          ) : (
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <Grid>
                <Field label="Speed" unit="kn" sensor="speed" {...mf.bind('speed')} />
                <Field label="Turning circle diameter" unit={nav.LENGTH_UNITS[unit].short} {...mf.bind('dia')} />
              </Grid>
              <p className="text-[10px] text-slate-400 font-medium">The turn is taken as a steady circle of that diameter at that speed. Use the ship's tactical diameter at the wheel you would use. Rougher than the ship's own turning data.</p>
            </div>
          )}
          <UnitPick label="Distances in" unit={unit} onChange={setUnit} />
          <p className="text-xs text-slate-600 font-medium leading-relaxed">{TURNS[kind].how(side)}</p>
          {maxTurn < needed && <Warn>This table only goes to {maxTurn}° of turn, and the manoeuvre needs {needed}°. The largest recorded figures are used for the rest, so the result is not reliable.</Warn>}
          {out && (
            <Result tone={maxTurn < needed ? 'warn' : 'ok'} rows={[
              ['Time to complete', mm(out.seconds)],
              ['Ship\'s head at the end', 'reciprocal (180° from the original)'],
              ['Man bears', `${greenRed(out.manRelativeBearing)} from the ship`],
              ['Off the original track', `${show(out.lateral)} to ${out.lateral >= 0 ? 'starboard' : 'port'}`],
              ['Run back to the man', out.toRun >= 0 ? `${show(out.toRun)} to go` : `${show(out.toRun)} past him`],
              ['Distance from the man', show(out.distance)],
            ]} />
          )}
        </>
      )}
    </Panel>
    <OwnFormula id="mob" unitHint="yd" vars={[{ name: 'speed', label: 'speed (kn)', value: mSpeed }, { name: 'dia', label: 'turning circle (yd)', value: mDia === null ? null : nav.convertLength(mDia, unit, 'yards') }, { name: 'secs', label: 'time to complete (s)', value: out ? out.seconds : null }, { name: 'lat', label: 'off the track (yd)', value: out ? Math.abs(out.lateral) : null }, { name: 'dist', label: 'distance from the man (yd)', value: out ? out.distance : null }]} />
    </div>
  );
};

const UnitTool: React.FC = () => {
  const [gi, setGi] = useMemory('units:group', 0);
  const group = nav.UNIT_GROUPS[gi] ?? nav.UNIT_GROUPS[0];
  const names = Object.keys(group.units);
  const [fromRaw, setFrom] = useMemory('units:from', names[0]);
  const [toRaw, setTo] = useMemory('units:to', names[1]);
  const [val, setVal] = useMemory('units:value', '');
  const from = names.includes(fromRaw) ? fromRaw : names[0];
  const to = names.includes(toRaw) ? toRaw : names[1];
  const x = toNum(val);
  const pick = 'w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none';
  const changeGroup = (i: number) => { const n = Object.keys(nav.UNIT_GROUPS[i].units); setGi(i); setFrom(n[0]); setTo(n[1]); };
  return (
    <Panel title="Unit converter">
      <div className="flex gap-2">
        {nav.UNIT_GROUPS.map((g, i) => (
          <button key={g.name} onClick={() => changeGroup(i)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${i === gi ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{g.name}</button>
        ))}
      </div>
      <Field label="Value" value={val} onChange={setVal} />
      <Grid>
        <select value={from} onChange={e => setFrom(e.target.value)} className={pick}>{names.map(n => <option key={n}>{n}</option>)}</select>
        <select value={to} onChange={e => setTo(e.target.value)} className={pick}>{names.map(n => <option key={n}>{n}</option>)}</select>
      </Grid>
      {x !== null && <Result rows={[[`${x} ${from}`, `${Number(nav.convertUnit(x, from, to, group).toPrecision(7))} ${to}`]]} />}
    </Panel>
  );
};

const COMPASS_KEYS = ['course', 'dev', 'var'] as const;

const CompassTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [dir, setDir] = useMemory<'toTrue' | 'toCompass'>('compass:dir', 'toTrue');
  // the deviation from the selected ship's compass swing, for the heading entered (compass course; for a true course the compass heading is found by trial)
  const typed = useForm('compass', COMPASS_KEYS);
  const swing = shipParams(ship).swing;
  const crs = typed.n('course'), vr0 = typed.n('var');
  let devDefault: string | undefined;
  if (swing && crs !== null && (dir === 'toTrue' || vr0 !== null)) {
    let head = crs;
    if (dir === 'toCompass') for (let i = 0; i < 8; i++) head = nav.norm360(crs - (vr0 ?? 0) - deviationAt(swing, head));
    devDefault = String(Math.round(deviationAt(swing, head) * 10) / 10);
  }
  const c = useForm('compass', COMPASS_KEYS, { dev: devDefault });
  const g = useForm('gyro', ['gyro', 'err'] as const);
  const course = c.n('course'), dev = c.n('dev'), vr = c.n('var');
  const gyro = g.n('gyro'), err = g.n('err');
  const toTrue = dir === 'toTrue';
  return (
    <div className="space-y-3">
      <Panel title="True, magnetic and compass" note="Easterly variation and deviation are positive, westerly negative. Deviation depends on the ship's head, so use the value for that heading. With a compass swing recorded for the selected ship, the deviation is taken from it for the heading entered.">
        <div className="flex gap-2">
          {([['toTrue', 'Compass to true'], ['toCompass', 'True to compass']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setDir(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${dir === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{l}</button>
          ))}
        </div>
        <Field label={toTrue ? 'Compass course' : 'True course'} unit={toTrue ? '°C' : '°T'} {...c.bind('course')} />
        <Grid>
          <Field label="Variation" unit="° E+ W-" {...c.bind('var')} />
          <Field label="Deviation" unit="° E+ W-" {...c.bind('dev')} />
        </Grid>
        {course !== null && dev !== null && vr !== null && (
          <Result rows={toTrue
            ? [['Magnetic', bearing(course + dev)], ['True', bearing(nav.compassToTrue(course, dev, vr))]]
            : [['Magnetic', bearing(course - vr)], ['Compass', bearing(nav.trueToCompass(course, dev, vr))]]} />
        )}
      </Panel>
      <Panel title="Gyro to true">
        <Grid>
          <Field label="Gyro course" unit="°" {...g.bind('gyro')} />
          <Field label="Gyro error" unit="° E+ W-" {...g.bind('err')} />
        </Grid>
        {gyro !== null && err !== null && <Result rows={[['True', bearing(nav.trueFromGyro(gyro, err))]]} />}
      </Panel>
    <OwnFormula id="compass" unitHint="°" vars={[{ name: 'course', label: 'course (°)', value: course }, { name: 'dev', label: 'deviation (°, E+)', value: dev }, { name: 'var', label: 'variation (°, E+)', value: vr }, { name: 'gyro', label: 'gyro course (°)', value: gyro }, { name: 'err', label: 'gyro error (°, E+)', value: err }]} />
    </div>
  );
};

const AtbTool: React.FC = () => {
  const f = useForm('atb', ['brg', 'angle', 'course'] as const);
  const [mode, setMode] = useMemory<'course' | 'angle'>('atb:mode', 'course');
  const [side, setSide] = useMemory<nav.BowSide>('atb:side', 'Starboard');
  const brg = f.n('brg'), angle = f.n('angle'), course = f.n('course');

  const describe = (a: number) => (a < 15 ? 'bows on' : a > 165 ? 'stern on' : Math.abs(a - 90) < 15 ? 'beam on' : a < 90 ? 'on the bow' : 'on the quarter');
  const bowRows = (b: nav.BowAngle): [string, string][] => {
    if (b.side === null) return [['Angle on the bow', b.angle === 0 ? '0°, target heading straight at you' : '180°, target steaming directly away']];
    const green = b.side === 'Starboard';
    return [['Angle on the bow', `${Math.round(b.angle)}° ${b.side.toLowerCase()} (${green ? 'Green' : 'Red'} ${Math.round(b.angle)})`], ['Aspect', describe(b.angle)]];
  };

  return (
    <div className="space-y-3">
    <Panel title="Angle on the bow (ATB)" note="The angle between the target's head and the line of sight from the target to you, 0-180° to port or starboard. Green is starboard, red is port. Bearing is true, from you to the target.">
      <Seg value={mode} onChange={v => setMode(v as 'course' | 'angle')} options={[['course', 'Find target course'], ['angle', 'Find angle on bow']]} />
      <Field label="Bearing of target" unit="°T" {...f.bind('brg')} />
      {mode === 'course' ? (
        <>
          <Grid>
            <Field label="Angle on the bow" unit="°" hint="0 to 180" {...f.bind('angle')} />
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Side</span>
              <div className="flex gap-1">
                {(['Port', 'Starboard'] as const).map(sd => (
                  <button key={sd} onClick={() => setSide(sd)} className={`flex-1 py-3 rounded-xl text-xs font-bold border ${side === sd ? (sd === 'Port' ? 'bg-red-600 border-red-600' : 'bg-green-600 border-green-600') + ' text-white' : 'bg-white text-slate-500 border-slate-200'}`}>{sd === 'Port' ? 'Port' : 'Stbd'}</button>
                ))}
              </div>
            </div>
          </Grid>
          {angle !== null && (angle < 0 || angle > 180) && <Warn>The angle on the bow is between 0° and 180°.</Warn>}
          {brg !== null && angle !== null && angle >= 0 && angle <= 180 && (
            <Result rows={[
              ['Target course', bearing(nav.targetCourseFromBowAngle(brg, angle, angle === 0 || angle === 180 ? null : side))],
              ['Line of sight, target to you', bearing(nav.reciprocal(brg))],
            ]} />
          )}
        </>
      ) : (
        <>
          <Field label="Target course" unit="°T" {...f.bind('course')} />
          {brg !== null && course !== null && <Result rows={bowRows(nav.angleOnBow(brg, course))} />}
        </>
      )}
    </Panel>
    <OwnFormula id="atb" unitHint="°" vars={[{ name: 'brg', label: 'bearing (°T)', value: brg }, { name: 'angle', label: 'angle on the bow (°)', value: angle }, { name: 'course', label: 'target course (°T)', value: course }]} />
    </div>
  );
};

const HsaTool: React.FC = () => {
  const [mode, setMode] = useMemory<'fix' | 'dist' | 'length'>('hsa:mode', 'fix');
  return (
    <div className="space-y-3">
      <Seg value={mode} onChange={v => setMode(v as 'fix' | 'dist' | 'length')} options={[['fix', 'Position fix'], ['dist', 'Distance off'], ['length', 'Object length']]} />
      {mode === 'fix' ? <HsaFixPanel /> : mode === 'dist' ? <HsaDistancePanel /> : <HsaLengthPanel />}
    </div>
  );
};

const HsaFixPanel: React.FC = () => {
  const f = useForm('hsa-fix', ['aLat', 'aLon', 'bLat', 'bLon', 'cLat', 'cLon', 'alpha', 'beta'] as const);
  const lat = (k: 'aLat' | 'bLat' | 'cLat') => nav.parseCoord(f.v[k], 'lat');
  const lon = (k: 'aLon' | 'bLon' | 'cLon') => nav.parseCoord(f.v[k], 'lon');
  const [rangeUnit, setRangeUnit] = useUnit('hsa-fix:unit');
  const [mapFor, setMapFor] = useState<'A' | 'B' | 'C' | null>(null);   // which object is being picked on the map
  const alpha = nav.parseAngle(f.v.alpha), beta = nav.parseAngle(f.v.beta);
  const bad = (k: keyof typeof f.v, ok: boolean) => f.v[k].trim() !== '' && !ok;

  const lats = [lat('aLat'), lat('bLat'), lat('cLat')], lons = [lon('aLon'), lon('bLon'), lon('cLon')];
  const ready = lats.every(x => x !== null) && lons.every(x => x !== null) && alpha !== null && beta !== null;
  let fix: nav.HsaFix | null = null, pos: { lat: number; lon: number } | null = null;
  if (ready) {
    const lat0 = (lats[0]! + lats[1]! + lats[2]!) / 3, lon0 = (lons[0]! + lons[1]! + lons[2]!) / 3;
    const pt = (i: number) => nav.toLocalNm(lats[i]!, lons[i]!, lat0, lon0);
    fix = nav.hsaFix(pt(0), pt(1), pt(2), alpha!, beta!);
    if (!('error' in fix)) pos = nav.fromLocalNm(fix, lat0, lon0);
  }

  const obj = (name: 'A' | 'B' | 'C', latKey: 'aLat' | 'bLat' | 'cLat', lonKey: 'aLon' | 'bLon' | 'cLon', where: string) => (
    <div key={name} className="space-y-1">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Object {name} <span className="text-slate-400 normal-case font-semibold">({where})</span></p>
      <Grid>
        <Field label="Latitude" kind="lat" wide invalid={bad(latKey, lat(latKey) !== null)} {...f.bind(latKey)} />
        <Field label="Longitude" kind="lon" wide invalid={bad(lonKey, lon(lonKey) !== null)} {...f.bind(lonKey)} />
      </Grid>
      <button type="button" onClick={() => setMapFor(name)} className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold active:scale-95"><MapPin size={14} />Pick object {name} on the map</button>
      {mapFor === name && <MapPick title={`Object ${name} (${where})`} start={lat(latKey) !== null && lon(lonKey) !== null ? { lat: lat(latKey)!, lon: lon(lonKey)! } : null}
        onClose={() => setMapFor(null)} onPick={(la, lo) => { f.bind(latKey).onChange(coordText(la, 'lat')); f.bind(lonKey).onChange(coordText(lo, 'lon')); }} />}
    </div>
  );

  return (
    <Panel title="Position from two horizontal sextant angles" note="Look at the three charted objects: A is on your left, B in the middle, C on your right. Measure the angle between A and B, and between B and C. Enter positions and angles in degrees and minutes; choose N/S and E/W with the buttons. Beware a fix near the circle through all three objects.">
      {obj('A', 'aLat', 'aLon', 'left')}
      {obj('B', 'bLat', 'bLon', 'middle')}
      {obj('C', 'cLat', 'cLon', 'right')}
      <Grid>
        <Field label="Angle A to B" unit="°" kind="angle" invalid={bad('alpha', alpha !== null)} {...f.bind('alpha')} />
        <Field label="Angle B to C" unit="°" kind="angle" invalid={bad('beta', beta !== null)} {...f.bind('beta')} />
      </Grid>
      <UnitPick label="Distances in" unit={rangeUnit} onChange={setRangeUnit} />
      {fix && 'error' in fix && <Warn>{fix.error}</Warn>}
      {fix && !('error' in fix) && pos && (
        <>
          <Result tone={fix.weak ? 'warn' : 'ok'} rows={[
            ['Latitude', nav.formatCoord(pos.lat, 'lat')],
            ['Longitude', nav.formatCoord(pos.lon, 'lon')],
            ...(['A', 'B', 'C'] as const).map((n, i): [string, string] => [`Object ${n}`, `${fromNm(fix.ranges[i], rangeUnit)}, bearing ${bearing(fix.bearings[i])}`]),
          ]} />
          {fix.weak && <Warn>Weak fix: the two position circles cross at a shallow angle, so a small error in either angle moves the position a long way. This happens close to the danger circle through the objects, or when they are far off. Confirm with another bearing, a different object or a depth check.</Warn>}
        </>
      )}
    </Panel>
  );
};

const HsaDistancePanel: React.FC = () => {
  const f = useForm('hsa-dist', ['base', 'ang'] as const);
  const [unit, setUnit] = useUnit('hsa-dist:unit');
  const base = f.n('base'), ang = nav.parseAngle(f.v.ang);
  const d = base !== null && ang !== null ? nav.distanceOffHSA(base, ang) : null;
  const r = base !== null && ang !== null && ang > 0 && ang < 180 && base > 0 ? nav.positionCircleRadius(base, ang) : null;
  const show = (v: number) => nav.formatLength(v, unit);
  return (
    <div className="space-y-3">
    <Panel title="Distance off from one horizontal sextant angle" note="Valid when you are on the perpendicular bisector of the two objects, i.e. equally far from both (for example abeam the midpoint between them). Otherwise use the position fix with a third object. The answer is in the same unit as the distance between the objects.">
      <LengthField label="Distance between the objects" unit={unit} onUnit={setUnit} {...f.bind('base')} />
      <Field label="Horizontal sextant angle" unit="°" kind="angle" invalid={f.v.ang.trim() !== '' && ang === null} {...f.bind('ang')} />
      {ang !== null && (ang <= 0 || ang >= 180) && <Warn>The angle must be between 0° and 180°.</Warn>}
      {d !== null && r !== null && <Result rows={[['Distance off the line', show(d)], ['Position circle radius', show(r)]]} />}
    </Panel>
    <OwnFormula id="hsadist" unitHint="" vars={[{ name: 'B', label: 'distance between objects', value: base }, { name: 'A', label: 'angle (°)', value: ang }, { name: 'd', label: 'distance off', value: d }]} />
    </div>
  );
};

/** The length of an object from the bearings of its two ends and the distance to it. */
const HsaLengthPanel: React.FC = () => {
  const f = useForm('hsa-len', ['b1', 'b2', 'dist'] as const);
  const [unit, setUnit] = useUnit('hsa-len:unit');
  const b1 = f.n('b1'), b2 = f.n('b2'), dist = f.n('dist');
  const r = b1 !== null && b2 !== null && dist !== null ? nav.objectLengthFromBearings(dist, b1, b2) : null;
  const ready = b1 !== null && b2 !== null && dist !== null;
  const metres = r ? nav.convertLength(r.length, unit, 'metres') : 0;
  return (
    <Panel title="Length of an object from its end bearings" note="Take the bearing to each end of the object and the distance to its middle. The angle between the two bearings, with the distance, gives the length across the line of sight. If the object lies at an angle to your line of sight it is longer than this.">
      <Grid>
        <Field label="Bearing, one end" unit="°" {...f.bind('b1')} />
        <Field label="Bearing, other end" unit="°" {...f.bind('b2')} />
      </Grid>
      <LengthField label="Distance to the object" unit={unit} onUnit={setUnit} {...f.bind('dist')} />
      {ready && !r && <Warn>Needs a distance above zero and two different bearings (less than 180° apart).</Warn>}
      {r && (
        <Result rows={[
          ['Angle between bearings', `${r.angle.toFixed(2)}\u00B0`],
          ['Length of the object', nav.formatLength(r.length, unit)],
          ...(unit !== 'metres' ? [['', nav.formatLength(metres, 'metres')] as [string, string]] : []),
        ]} />
      )}
    </Panel>
  );
};

// ---- registry ----------------------------------------------------------------------------------

export interface NavTool { name: string; /** label under the icon in the NavYeo grid */ short: string; desc: string; icon: React.ReactNode; Component: React.FC<{ ship?: Ship }> }

export const NAV_TOOLS: NavTool[] = [
  { name: 'Bearing Calculator', short: 'Bearings', desc: 'Reciprocal and relative to true bearings', icon: <Navigation size={18} className="text-blue-500" />, Component: BearingTool },
  { name: 'Time / Speed / Distance', short: 'Time-Speed-Dist', desc: 'Solve any one from the other two', icon: <Clock size={18} className="text-orange-500" />, Component: TsdTool },
  { name: 'CPA / TCPA', short: 'CPA', desc: 'Closest approach to a contact', icon: <Radar size={18} className="text-red-500" />, Component: CpaTool },
  { name: 'Angle on the Bow (ATB)', short: 'ATB', desc: 'Target course from bearing and angle on the bow, or the reverse', icon: <ShipIcon size={18} className="text-sky-500" />, Component: AtbTool },
  { name: 'Course to Steer', short: 'Course to steer', desc: 'Allow for set and drift', icon: <Waves size={18} className="text-cyan-500" />, Component: CtsTool },
  { name: 'Distance Off & Horizon', short: 'Dist off', desc: 'Vertical sextant angle, visibility, radar range', icon: <Eye size={18} className="text-emerald-500" />, Component: DistanceOffTool },
  { name: 'Horizontal Sextant Angle (HSA)', short: 'HSA', desc: 'Position fix from two horizontal angles, and distance off', icon: <MapPin size={18} className="text-rose-500" />, Component: HsaTool },
  { name: 'Wheel-over Point', short: 'Wheel-over', desc: 'Where to put the wheel over for a turn', icon: <RotateCw size={18} className="text-indigo-500" />, Component: WheelOverTool },
  { name: 'Man Overboard Turn', short: 'MOB', desc: 'Williamson and Scharnow turns worked from the ship\'s turning data', icon: <LifeBuoy size={18} className="text-red-500" />, Component: MobTool },
  { name: 'ASTRO', short: 'ASTRO', desc: 'Sun Run Sun, Sun Run Merpass, four star fix, Polaris, rise, set and twilight', icon: <Sun size={18} className="text-amber-500" />, Component: AstroTool },
  { name: 'Tides', short: 'Tides', desc: 'Height of tide at a time, flood or ebb, springs or neaps', icon: <ArrowUpDown size={18} className="text-teal-500" />, Component: TidesTool },
  { name: 'Anchor', short: 'Anchor', desc: 'Cable to veer, safety, bridge and stern swinging circles, minimum swinging radius (BR 45)', icon: <Anchor size={18} className="text-slate-600" />, Component: AnchorTool },
  { name: 'Battenberg', short: 'Battenberg', desc: 'Course to steer to take or change station on a Guide, with the stations on a Battenberg diagram', icon: <Target size={18} className="text-rose-600" />, Component: BattenbergTool },
  { name: 'Compass Conversion', short: 'Compass', desc: 'True, magnetic, compass and gyro', icon: <Compass size={18} className="text-amber-500" />, Component: CompassTool },
  { name: 'Radian Rule', short: 'Radian rule', desc: 'Distance off and range from angle', icon: <Calculator size={18} className="text-purple-500" />, Component: RadianTool },
  { name: 'Unit Converter', short: 'Units', desc: 'Distance and speed units, cables, fathoms', icon: <ArrowLeftRight size={18} className="text-slate-500" />, Component: UnitTool },
];
