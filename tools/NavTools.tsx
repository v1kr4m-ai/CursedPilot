import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Calculator, Clock, Compass, Eye, MapPin, Navigation, Radar, RotateCw, Ship as ShipIcon, Waves } from 'lucide-react';
import { Ship } from '../types';
import { interpolateData } from '../fishtail/utils/interpolation';
import { shipToFishtailRows } from '../fishtail/shipBridge';
import * as nav from './navMath';

// ---- shared bits ------------------------------------------------------------------------------

const toNum = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

/** Text state for a set of number fields; `bind('speed')` gives Field its value/onChange. */
function useForm<K extends string>(keys: readonly K[]) {
  const [v, setV] = useState(() => Object.fromEntries(keys.map(k => [k, ''])) as Record<K, string>);
  const bind = (k: K) => ({ value: v[k], onChange: (s: string) => setV(prev => ({ ...prev, [k]: s })) });
  const n = (k: K) => toNum(v[k]);
  return { v, bind, n };
}

const Field: React.FC<{ label: string; unit?: string; value: string; onChange: (s: string) => void; hint?: string; text?: boolean; invalid?: boolean }> = ({ label, unit, value, onChange, hint, text, invalid }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}{unit && ` (${unit})`}</span>
    <input type={text ? 'text' : 'number'} inputMode={text ? 'text' : 'decimal'} step="any" value={value} onChange={e => onChange(e.target.value)} placeholder={hint}
      className={`w-full p-3 rounded-xl border bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400 ${invalid ? 'border-red-400' : 'border-slate-200'}`} />
  </label>
);

/** Small segmented choice, used where a tool has two modes. */
function Seg<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${value === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
      ))}
    </div>
  );
}

const Panel: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
    {children}
    {note && <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{note}</p>}
  </div>
);

const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

const Result: React.FC<{ rows: [string, string][]; tone?: 'ok' | 'warn' }> = ({ rows, tone = 'ok' }) => (
  <div className={`p-3 rounded-xl text-white text-sm font-bold space-y-1 ${tone === 'warn' ? 'bg-amber-600' : 'bg-blue-600'}`}>
    {rows.map(([k, val]) => <div key={k} className="flex justify-between gap-3"><span className="opacity-80 font-semibold">{k}</span><span>{val}</span></div>)}
  </div>
);

const Warn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl text-xs font-bold">{children}</div>
);

const bearing = (d: number) => `${Math.round(nav.norm360(d)).toString().padStart(3, '0')}°`;
const hhmm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60).toString().padStart(2, '0')}m`;

// ---- tools -------------------------------------------------------------------------------------

const BearingTool: React.FC = () => {
  const f = useForm(['brg', 'head', 'rel'] as const);
  const brg = f.n('brg'), head = f.n('head'), rel = f.n('rel');
  return (
    <div className="space-y-3">
      <Panel title="Reciprocal bearing">
        <Field label="Bearing or course" unit="°" {...f.bind('brg')} />
        {brg !== null && <Result rows={[['Reciprocal', bearing(nav.reciprocal(brg))]]} />}
      </Panel>
      <Panel title="Relative to true bearing">
        <Grid>
          <Field label="Ship's head" unit="°T" {...f.bind('head')} />
          <Field label="Relative bearing" unit="°" {...f.bind('rel')} />
        </Grid>
        {head !== null && rel !== null && <Result rows={[['True bearing', bearing(nav.trueBearing(head, rel))]]} />}
      </Panel>
    </div>
  );
};

const TsdTool: React.FC = () => {
  const f = useForm(['d', 's', 't'] as const);
  const given = [f.n('d'), f.n('s'), f.n('t')].filter(x => x !== null).length;
  const r = nav.solveTSD({ distance: f.n('d'), speed: f.n('s'), minutes: f.n('t') });
  const label = r && { distance: 'Distance', speed: 'Speed', minutes: 'Time' }[r.solved];
  return (
    <Panel title="Time, speed, distance" note="Fill any two, leave the third blank.">
      <Field label="Distance" unit="nm" {...f.bind('d')} />
      <Grid>
        <Field label="Speed" unit="kn" {...f.bind('s')} />
        <Field label="Time" unit="min" {...f.bind('t')} />
      </Grid>
      {r && <Result rows={[
        [label!, r.solved === 'distance' ? `${r.distance.toFixed(2)} nm` : r.solved === 'speed' ? `${r.speed.toFixed(1)} kn` : `${r.minutes.toFixed(1)} min (${hhmm(r.minutes)})`],
      ]} />}
      {given === 2 && !r && <Warn>Speed and time must be above zero where they are divided by.</Warn>}
    </Panel>
  );
};

const RadianTool: React.FC = () => {
  const f = useForm(['dist', 'range'] as const);
  const d = f.n('dist'), r = f.n('range');
  return (
    <Panel title="Radian rule (angle = distance / range)" note="Gives the angle subtended in degrees; use the same unit for both.">
      <Grid>
        <Field label="Distance off" {...f.bind('dist')} />
        <Field label="Range" {...f.bind('range')} />
      </Grid>
      {d !== null && r !== null && r > 0 && <Result rows={[['Angle', `${nav.radianAngle(d, r).toFixed(2)}°`]]} />}
    </Panel>
  );
};

const CpaTool: React.FC = () => {
  const f = useForm(['oc', 'os', 'brg', 'rng', 'tc', 'ts'] as const);
  const v = ['oc', 'os', 'brg', 'rng', 'tc', 'ts'].map(k => f.n(k as 'oc'));
  const ready = v.every(x => x !== null);
  const r = ready ? nav.cpa({ ownCourse: v[0]!, ownSpeed: v[1]!, bearing: v[2]!, range: v[3]!, targetCourse: v[4]!, targetSpeed: v[5]! }) : null;
  return (
    <Panel title="CPA / TCPA" note="True bearing, true courses, speeds through the ground. Assumes both vessels hold course and speed.">
      <Grid>
        <Field label="Own course" unit="°T" {...f.bind('oc')} />
        <Field label="Own speed" unit="kn" {...f.bind('os')} />
        <Field label="Target bearing" unit="°T" {...f.bind('brg')} />
        <Field label="Target range" unit="nm" {...f.bind('rng')} />
        <Field label="Target course" unit="°T" {...f.bind('tc')} />
        <Field label="Target speed" unit="kn" {...f.bind('ts')} />
      </Grid>
      {r && (
        <Result tone={r.status === 'closing' && r.cpa < 1 ? 'warn' : 'ok'} rows={[
          ['CPA', `${r.cpa.toFixed(2)} nm`],
          ['TCPA', r.tcpaMinutes === null ? (r.status === 'steady' ? 'no relative motion' : 'past, opening') : `${r.tcpaMinutes.toFixed(1)} min`],
          ...(r.status === 'closing' && r.cpa >= 0.01 ? [['Bearing at CPA', bearing(r.bearingAtCpa)] as [string, string]] : []),
          ...(r.relativeCourse !== null ? [['Relative track', `${bearing(r.relativeCourse)} at ${r.relativeSpeed.toFixed(1)} kn`] as [string, string]] : []),
        ]} />
      )}
    </Panel>
  );
};

const CtsTool: React.FC = () => {
  const f = useForm(['track', 'speed', 'set', 'drift', 'dist'] as const);
  const [track, speed, set, drift] = ['track', 'speed', 'set', 'drift'].map(k => f.n(k as 'track'));
  const ready = track !== null && speed !== null && set !== null && drift !== null;
  const r = ready ? nav.courseToSteer(track!, speed!, set!, drift!) : null;
  const dist = f.n('dist');
  return (
    <Panel title="Course to steer (set and drift)" note="Speed is through the water. Set is the direction the current flows towards.">
      <Grid>
        <Field label="Track to make good" unit="°T" {...f.bind('track')} />
        <Field label="Ship speed" unit="kn" {...f.bind('speed')} />
        <Field label="Set" unit="°T" {...f.bind('set')} />
        <Field label="Drift" unit="kn" {...f.bind('drift')} />
      </Grid>
      <Field label="Distance to run (optional)" unit="nm" {...f.bind('dist')} />
      {r && ('error' in r ? <Warn>{r.error}</Warn> : (
        <Result rows={[
          ['Course to steer', bearing(r.cts)],
          ['Allowance', `${Math.abs(r.allowance).toFixed(1)}° ${r.allowance < 0 ? 'to port' : r.allowance > 0 ? 'to starboard' : ''}`.trim()],
          ['Speed over ground', `${r.sog.toFixed(1)} kn`],
          ...(dist !== null && dist >= 0 ? [['Time to run', hhmm((dist / r.sog) * 60)] as [string, string]] : []),
        ]} />
      ))}
    </Panel>
  );
};

const DistanceOffTool: React.FC = () => {
  const vsa = useForm(['h', 'a'] as const);
  const hz = useForm(['eye', 'obj'] as const);
  const h = vsa.n('h'), a = vsa.n('a'), eye = hz.n('eye'), obj = hz.n('obj');
  return (
    <div className="space-y-3">
      <Panel title="Distance off by vertical sextant angle" note="Object height is above the water level used for the angle. Ignores curvature and refraction, so use for short ranges.">
        <Grid>
          <Field label="Object height" unit="m" {...vsa.bind('h')} />
          <Field label="Sextant angle" unit="°" hint="e.g. 1.5" {...vsa.bind('a')} />
        </Grid>
        {h !== null && a !== null && h > 0 && a > 0 && a < 90 && (
          <Result rows={[['Distance off', `${nav.distanceOffVSA(h, a).toFixed(2)} nm`], ['', `${Math.round(h / Math.tan((a * Math.PI) / 180))} m`]]} />
        )}
      </Panel>
      <Panel title="Horizon and visibility" note="Visual range assumes normal refraction (2.08√h); radar uses 2.21√h. Heights in metres above sea level.">
        <Grid>
          <Field label="Height of eye / antenna" unit="m" {...hz.bind('eye')} />
          <Field label="Object height (optional)" unit="m" {...hz.bind('obj')} />
        </Grid>
        {eye !== null && eye >= 0 && (
          <Result rows={[
            ['Visual horizon', `${nav.visualHorizon(eye).toFixed(1)} nm`],
            ['Radar horizon', `${nav.radarHorizon(eye).toFixed(1)} nm`],
            ...(obj !== null && obj >= 0 ? [
              ['Object first seen at', `${nav.visibleRange(eye, obj).toFixed(1)} nm`] as [string, string],
              ['Object on radar at', `${nav.radarRange(eye, obj).toFixed(1)} nm`] as [string, string],
            ] : []),
          ]} />
        )}
      </Panel>
    </div>
  );
};

const YARDS_PER_NM = 2025;   // same tactical convention as the Fishtail module

const WheelOverTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const f = useForm(['turn', 'adv', 'tr'] as const);
  const rows = useMemo(() => (ship ? shipToFishtailRows(ship) : []), [ship]);
  const tables = useMemo(() => {
    const m = new Map<string, { label: string; rows: typeof rows }>();
    rows.forEach(r => {
      const key = `${r.ownSpeed}|${r.rudder}|${r.side}`;
      if (!m.has(key)) m.set(key, { label: `${r.ownSpeed} kn, ${r.rudder}° wheel, ${r.side === 'port' ? 'port' : 'starboard'}`, rows: [] });
      m.get(key)!.rows.push(r);
    });
    return [...m.entries()];
  }, [rows]);
  const [tableKey, setTableKey] = useState('');   // '' = type advance and transfer by hand
  const table = tables.find(([k]) => k === tableKey)?.[1];

  const turn = f.n('turn');
  let adv = f.n('adv'), tr = f.n('tr'), outside = false;
  if (table && turn !== null && Math.abs(turn) >= 1) {
    const maxHeading = Math.max(...table.rows.map(r => r.heading));
    outside = Math.abs(turn) > maxHeading;
    ({ advance: adv, transfer: tr } = interpolateData(Math.abs(turn), table.rows));
  }
  const dist = adv !== null && tr !== null && turn !== null ? nav.wheelOverDistance(adv, tr, turn) : null;

  return (
    <Panel title="Wheel-over point" note="Approximate: takes advance and transfer at the heading change and assumes the ship is on the new track by the end of the turn. Confirm against your ship's own turning trials and standing orders.">
      <Field label="Course alteration" unit="°" hint="1 to 179, either side" {...f.bind('turn')} />
      {tables.length > 0 && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Turning data</span>
          <select value={tableKey} onChange={e => setTableKey(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none">
            <option value="">Enter advance and transfer by hand</option>
            {tables.map(([k, t]) => <option key={k} value={k}>{ship!.name}: {t.label}</option>)}
          </select>
        </label>
      )}
      {!table && (
        <Grid>
          <Field label="Advance" unit="yd" {...f.bind('adv')} />
          <Field label="Transfer" unit="yd" {...f.bind('tr')} />
        </Grid>
      )}
      {outside && <Warn>That alteration is larger than anything in the table, so the largest recorded advance and transfer are used. Treat the result with caution.</Warn>}
      {turn !== null && Math.abs(turn) >= 1 && Math.abs(turn) < 180 && adv !== null && tr !== null && dist !== null && (
        <Result rows={[
          ...(table ? [['Advance / transfer', `${Math.round(adv)} / ${Math.round(tr)} yd`] as [string, string]] : []),
          ['Wheel over', `${Math.round(dist)} yd before the turn point`],
          ['', `${(dist / (YARDS_PER_NM / 10)).toFixed(1)} cables`],
        ]} />
      )}
      {turn !== null && (Math.abs(turn) < 1 || Math.abs(turn) >= 180) && <Warn>Enter an alteration between 1° and 179°.</Warn>}
    </Panel>
  );
};

const UnitTool: React.FC = () => {
  const [gi, setGi] = useState(0);
  const group = nav.UNIT_GROUPS[gi];
  const names = Object.keys(group.units);
  const [from, setFrom] = useState(names[0]);
  const [to, setTo] = useState(names[1]);
  const [val, setVal] = useState('');
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

const CompassTool: React.FC = () => {
  const c = useForm(['course', 'dev', 'var'] as const);
  const g = useForm(['gyro', 'err'] as const);
  const [dir, setDir] = useState<'toTrue' | 'toCompass'>('toTrue');
  const course = c.n('course'), dev = c.n('dev'), vr = c.n('var');
  const gyro = g.n('gyro'), err = g.n('err');
  const toTrue = dir === 'toTrue';
  return (
    <div className="space-y-3">
      <Panel title="True, magnetic and compass" note="Easterly variation and deviation are positive, westerly negative. Deviation depends on the ship's head, so use the value for that heading.">
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
    </div>
  );
};

const AtbTool: React.FC = () => {
  const f = useForm(['brg', 'angle', 'course'] as const);
  const [mode, setMode] = useState<'course' | 'angle'>('course');
  const [side, setSide] = useState<nav.BowSide>('Starboard');
  const brg = f.n('brg'), angle = f.n('angle'), course = f.n('course');

  const describe = (a: number) => (a < 15 ? 'bows on' : a > 165 ? 'stern on' : Math.abs(a - 90) < 15 ? 'beam on' : a < 90 ? 'on the bow' : 'on the quarter');
  const bowRows = (b: nav.BowAngle): [string, string][] => {
    if (b.side === null) return [['Angle on the bow', b.angle === 0 ? '0°, target heading straight at you' : '180°, target steaming directly away']];
    const green = b.side === 'Starboard';
    return [['Angle on the bow', `${Math.round(b.angle)}° ${b.side.toLowerCase()} (${green ? 'Green' : 'Red'} ${Math.round(b.angle)})`], ['Aspect', describe(b.angle)]];
  };

  return (
    <Panel title="Angle on the bow (ATB)" note="The angle between the target's head and the line of sight from the target to you, 0-180° to port or starboard. Green is starboard, red is port. Bearing is true, from you to the target.">
      <Seg value={mode} onChange={setMode} options={[['course', 'Find target course'], ['angle', 'Find angle on bow']]} />
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
  );
};

const NM_PER: Record<string, number> = { 'nautical miles': 1, 'cables': 0.1, 'metres': 1 / 1852, 'yards': 0.9144 / 1852 };

const HsaTool: React.FC = () => {
  const [mode, setMode] = useState<'fix' | 'dist'>('fix');
  return (
    <div className="space-y-3">
      <Seg value={mode} onChange={setMode} options={[['fix', 'Position fix'], ['dist', 'Distance off']]} />
      {mode === 'fix' ? <HsaFixPanel /> : <HsaDistancePanel />}
    </div>
  );
};

const HsaFixPanel: React.FC = () => {
  const f = useForm(['aLat', 'aLon', 'bLat', 'bLon', 'cLat', 'cLon', 'alpha', 'beta'] as const);
  const lat = (k: 'aLat' | 'bLat' | 'cLat') => nav.parseCoord(f.v[k], 'lat');
  const lon = (k: 'aLon' | 'bLon' | 'cLon') => nav.parseCoord(f.v[k], 'lon');
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
        <Field label="Latitude" text hint="51 28.5 N" invalid={bad(latKey, lat(latKey) !== null)} {...f.bind(latKey)} />
        <Field label="Longitude" text hint="1 12.3 W" invalid={bad(lonKey, lon(lonKey) !== null)} {...f.bind(lonKey)} />
      </Grid>
    </div>
  );

  return (
    <Panel title="Position from two horizontal sextant angles" note="Look at the three charted objects: A is on your left, B in the middle, C on your right. Measure the angle between A and B, and between B and C. Positions as on the chart (51 28.5 N, 1 12.3 W, or decimal degrees); angles in degrees (26.57) or degrees and minutes (26 34.2). Beware a fix near the circle through all three objects.">
      {obj('A', 'aLat', 'aLon', 'left')}
      {obj('B', 'bLat', 'bLon', 'middle')}
      {obj('C', 'cLat', 'cLon', 'right')}
      <Grid>
        <Field label="Angle A to B" unit="°" text hint="26.57" invalid={bad('alpha', alpha !== null)} {...f.bind('alpha')} />
        <Field label="Angle B to C" unit="°" text hint="36 52" invalid={bad('beta', beta !== null)} {...f.bind('beta')} />
      </Grid>
      {fix && 'error' in fix && <Warn>{fix.error}</Warn>}
      {fix && !('error' in fix) && pos && (
        <>
          <Result tone={fix.weak ? 'warn' : 'ok'} rows={[
            ['Latitude', nav.formatCoord(pos.lat, 'lat')],
            ['Longitude', nav.formatCoord(pos.lon, 'lon')],
            ...(['A', 'B', 'C'] as const).map((n, i): [string, string] => [`Object ${n}`, `${fix.ranges[i].toFixed(2)} nm (${(fix.ranges[i] * 10).toFixed(1)} cables), bearing ${bearing(fix.bearings[i])}`]),
          ]} />
          {fix.weak && <Warn>Weak fix: the two position circles cross at a shallow angle, so a small error in either angle moves the position a long way. This happens close to the danger circle through the objects, or when they are far off. Confirm with another bearing, a different object or a depth check.</Warn>}
        </>
      )}
    </Panel>
  );
};

const HsaDistancePanel: React.FC = () => {
  const f = useForm(['base', 'ang'] as const);
  const [unit, setUnit] = useState('cables');
  const base = f.n('base'), ang = nav.parseAngle(f.v.ang);
  const d = base !== null && ang !== null ? nav.distanceOffHSA(base, ang) : null;
  const r = base !== null && ang !== null && ang > 0 && ang < 180 && base > 0 ? nav.positionCircleRadius(base, ang) : null;
  const show = (v: number) => `${v.toFixed(2)} ${unit} (${(v * NM_PER[unit]).toFixed(3)} nm)`;
  return (
    <Panel title="Distance off from one horizontal sextant angle" note="Valid when you are on the perpendicular bisector of the two objects, i.e. equally far from both (for example abeam the midpoint between them). Otherwise use the position fix with a third object.">
      <Grid>
        <Field label="Distance between the objects" {...f.bind('base')} />
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit</span>
          <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none">
            {Object.keys(NM_PER).map(u => <option key={u}>{u}</option>)}
          </select>
        </label>
      </Grid>
      <Field label="Horizontal sextant angle" unit="°" text hint="26.57 or 26 34.2" invalid={f.v.ang.trim() !== '' && ang === null} {...f.bind('ang')} />
      {ang !== null && (ang <= 0 || ang >= 180) && <Warn>The angle must be between 0° and 180°.</Warn>}
      {d !== null && r !== null && <Result rows={[['Distance off the line', show(d)], ['Position circle radius', show(r)]]} />}
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
  { name: 'Compass Conversion', short: 'Compass', desc: 'True, magnetic, compass and gyro', icon: <Compass size={18} className="text-amber-500" />, Component: CompassTool },
  { name: 'Radian Rule', short: 'Radian rule', desc: 'Distance off and range from angle', icon: <Calculator size={18} className="text-purple-500" />, Component: RadianTool },
  { name: 'Unit Converter', short: 'Units', desc: 'Distance and speed units, cables, fathoms', icon: <ArrowLeftRight size={18} className="text-slate-500" />, Component: UnitTool },
];
