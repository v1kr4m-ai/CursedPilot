import React from 'react';
import { Ship } from '../types';
import * as nav from './navMath';
import { Slowing, Solution, place, slowing, solve, stationBearing } from './battenberg';
import { Field, Grid, Panel, Result, Seg, SideToggle, UnitPick, Warn, bearing, useForm, useMemory, useUnit } from './kit';
import { shipParams } from './shipParams';

// Battenberg: the course to steer to take or change station on a Guide (BR 45(6) paras 0423-0424), with the stations
// marked on a Battenberg-style diagram: the Guide at the centre heading up, range rings, and the bearings on her bow,
// beam, quarter and astern. Tap the diagram to place a station. The sums are in battenberg.ts.

type Side = 'Port' | 'Starboard';
const FIELDS = ['gc', 'gs', 'ss', 'a1', 'd1', 'a2', 'd2', 'loss'] as const;
const NM_PER_YD = 1 / 2025.37;

const hms = (hours: number) => { const s = Math.round(hours * 3600); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`; };
const relName = (offBowTrue: number, guideCourse: number) => {
  const r = nav.norm360(offBowTrue - guideCourse);
  return r === 0 || r === 180 ? `${String(r).padStart(3, '0')}` : r < 180 ? `Green ${String(Math.round(r)).padStart(3, '0')}` : `Red ${String(Math.round(360 - r)).padStart(3, '0')}`;
};

const SIZE = 320, C = SIZE / 2, R = 128;
const MARKS: [number, string][] = [[0, 'Ahead'], [45, 'Bow'], [90, 'Beam'], [135, 'Quarter'], [180, 'Astern']];

const Diagram: React.FC<{ guideCourse: number | null; now: { x: number; y: number } | null; station: { x: number; y: number } | null; sol: Solution | null; slow: Slowing | null; maxNm: number; unitLabel: (nm: number) => string; onTap: (angleOffBow: number, nm: number) => void }> = ({ guideCourse, now, station, sol, slow, maxNm, unitLabel, onTap }) => {
  const k = R / maxNm, rot = guideCourse ?? 0;
  const pt = (v: { x: number; y: number }) => { const a = (-rot * Math.PI) / 180, x = v.x * Math.cos(a) + v.y * Math.sin(a), y = -v.x * Math.sin(a) + v.y * Math.cos(a); return { x: C + x * k, y: C - y * k }; };
  const tap = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), s = SIZE / r.width;
    const x = (e.clientX - r.left) * s - C, y = C - (e.clientY - r.top) * s;
    const d = Math.hypot(x, y) / k;
    if (d > 0.02) onTap(nav.norm360((Math.atan2(x, y) * 180) / Math.PI), d);
  };
  const rings = [1, 2, 3, 4].map(i => (maxNm * i) / 4);
  const p1 = now && pt(now), p2 = station && pt(station), ps = slow && pt(slow.at);
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} onPointerDown={tap} role="img" aria-label="Battenberg diagram of the stations about the Guide" className="w-full max-w-sm mx-auto bg-slate-900 rounded-2xl touch-none select-none">
      {rings.map(r => <circle key={r} cx={C} cy={C} r={r * k} fill="none" stroke="#16a34a" strokeOpacity={0.45} />)}
      {rings.map(r => <text key={`t${r}`} x={C + 3} y={C - r * k + 9} fontSize={8} fill="#4ade80">{unitLabel(r)}</text>)}
      {Array.from({ length: 24 }, (_, i) => i * 15).map(a => {
        const big = a % 45 === 0, x = C + Math.sin((a * Math.PI) / 180) * R, y = C - Math.cos((a * Math.PI) / 180) * R;
        return <line key={a} x1={C} y1={C} x2={x} y2={y} stroke={big ? '#4ade80' : '#166534'} strokeOpacity={big ? 0.7 : 0.5} strokeWidth={big ? 1 : 0.6} />;
      })}
      {MARKS.flatMap(([a, label]) => (a === 0 || a === 180 ? [a] : [a, -a]).map(s => {
        const th = (s * Math.PI) / 180, x = C + Math.sin(th) * (R + 12), y = C - Math.cos(th) * (R + 12);
        return <text key={`${label}${s}`} x={x} y={y + 3} fontSize={8} textAnchor="middle" fontWeight={700} fill={s < 0 ? '#f87171' : s > 0 ? '#4ade80' : '#e2e8f0'}>{label}</text>;
      }))}
      {p1 && p2 && <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fbbf24" strokeWidth={1.6} strokeDasharray="5 3" />}
      {ps && <circle cx={ps.x} cy={ps.y} r={4} fill="none" stroke="#fb923c" strokeWidth={1.8} />}
      <polygon points={`${C},${C - 9} ${C - 5},${C + 7} ${C + 5},${C + 7}`} fill="#fff" />
      <text x={C + 8} y={C + 4} fontSize={8} fill="#e2e8f0">Guide</text>
      {p2 && <><circle cx={p2.x} cy={p2.y} r={5} fill="#22c55e" /><text x={p2.x + 7} y={p2.y - 5} fontSize={9} fontWeight={700} fill="#86efac">Station</text></>}
      {p1 && <><circle cx={p1.x} cy={p1.y} r={5} fill="#ef4444" /><text x={p1.x + 7} y={p1.y - 5} fontSize={9} fontWeight={700} fill="#fca5a5">Now</text></>}
      {sol && p2 && <text x={6} y={SIZE - 6} fontSize={8} fill="#86efac">Guide heading up · rings in {unitLabel(maxNm).replace(/[\d.]+\s*/, '')}</text>}
    </svg>
  );
};

export const BattenbergTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [unit, setUnit] = useUnit('batt:unit', 'yards');
  const sp = shipParams(ship);
  const lossYd = sp.decelMetresPerKnot === undefined ? undefined : String(Math.round((sp.decelMetresPerKnot / 0.9144) * 10) / 10);
  const f = useForm('batt', FIELDS, { loss: lossYd });
  const [side1, setSide1] = useMemory<Side>('batt:side1', 'Port');
  const [side2, setSide2] = useMemory<Side>('batt:side2', 'Starboard');
  const [placing, setPlacing] = useMemory<'now' | 'station'>('batt:placing', 'station');

  const gc = f.n('gc'), gs = f.n('gs'), ss = f.n('ss'), a1 = f.n('a1'), a2 = f.n('a2'), loss = f.n('loss');
  const toNm = (v: number | null) => (v === null ? null : nav.convertLength(v, unit, 'nm'));
  const d1 = toNm(f.n('d1')), d2 = toNm(f.n('d2'));
  const ang = (a: number | null, s: Side) => (a === null ? null : s === 'Starboard' ? a : -a);
  const o1 = ang(a1, side1), o2 = ang(a2, side2);
  const ready = gc !== null && gs !== null && gs >= 0 && ss !== null && ss > 0 && o1 !== null && o2 !== null && d1 !== null && d1 >= 0 && d2 !== null && d2 >= 0;
  const now = ready ? place(stationBearing(gc!, o1!), d1!) : null, st = ready ? place(stationBearing(gc!, o2!), d2!) : null;
  const prob = ready ? { guideCourse: gc!, guideSpeed: gs!, stationingSpeed: ss!, from: now!, to: st! } : null;
  const sols = prob ? solve(prob) : [];
  const best = sols[0] ?? null;
  const slow = prob && best && loss !== null ? slowing(prob, best, loss * NM_PER_YD) : null;
  const unitLabel = (nm: number) => nav.formatLength(nav.convertLength(nm, 'nm', unit), unit);
  const maxNm = Math.max(0.2, ...[d1, d2].filter((x): x is number => x !== null)) * 1.25;

  const onTap = (offBow: number, nm: number) => {
    const side: Side = offBow <= 180 ? 'Starboard' : 'Port', a = offBow <= 180 ? offBow : 360 - offBow;
    const dist = nav.convertLength(nm, 'nm', unit), dp = unit === 'nm' || unit === 'km' ? 2 : dist < 100 ? 0 : 1;
    const text = String(Math.round(dist * 10 ** dp) / 10 ** dp);
    if (placing === 'now') { setSide1(side); f.bind('a1').onChange(String(Math.round(a))); f.bind('d1').onChange(text); }
    else { setSide2(side); f.bind('a2').onChange(String(Math.round(a))); f.bind('d2').onChange(text); }
  };

  const row = (label: string, s: Solution): [string, string][] => [[label, bearing(s.course)], ['Relative track', `${bearing(s.relativeCourse)} at ${s.relativeSpeed.toFixed(1)} kn`], ['Time to station', hms(s.hours)]];
  const dist = prob ? Math.hypot(prob.to.x - prob.from.x, prob.to.y - prob.from.y) : 0;

  return (
    <div className="space-y-3">
      <Panel title="Guide and own speed" note="True course and speed of the Guide, and the speed you will use to close or change station (the stationing speed).">
        <Grid>
          <Field label="Guide's course" unit="°T" {...f.bind('gc')} />
          <Field label="Guide's speed" unit="kn" units {...f.bind('gs')} />
        </Grid>
        <Field label="Stationing speed (own)" unit="kn" units {...f.bind('ss')} />
        <UnitPick label="Distances in" unit={unit} onChange={setUnit} />
      </Panel>

      <Panel title="Where you are now" note="Your position from the Guide: the angle off her bow, on her port or starboard side, and the distance.">
        <SideToggle label="On the Guide's" value={side1} onChange={setSide1} />
        <Grid>
          <Field label="Angle off her bow" unit="°" {...f.bind('a1')} />
          <Field label="Distance" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('d1')} />
        </Grid>
      </Panel>

      <Panel title="Ordered station" note="Where you are to take station, in the same way. Stations are measured from the Guide's head: 000 right ahead, 090 on the starboard beam, 180 astern.">
        <SideToggle label="On the Guide's" value={side2} onChange={setSide2} />
        <Grid>
          <Field label="Angle off her bow" unit="°" {...f.bind('a2')} />
          <Field label="Distance" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('d2')} />
        </Grid>
        <Field label="Loss of speed (yards per knot)" unit="yd/kn" {...f.bind('loss')} />
      </Panel>

      <Panel title="Battenberg diagram" note="Tap the diagram to place the station (or where you are now) instead of typing it.">
        <Seg value={placing} onChange={v => setPlacing(v as 'now' | 'station')} options={[['station', 'Tap sets the station'], ['now', 'Tap sets where I am']]} />
        <Diagram guideCourse={gc} now={now} station={st} sol={best} slow={slow} maxNm={maxNm} unitLabel={unitLabel} onTap={onTap} />
      </Panel>

      {ready && sols.length === 0 && dist > 1e-6 && <Warn>That relative track cannot be made good at {ss} kn against a Guide at {gs} kn. A higher stationing speed, or a different station, is needed.</Warn>}
      {ready && dist <= 1e-6 && <p className="text-xs text-slate-500 font-medium">You are already on station.</p>}
      {best && (
        <Result rows={[
          ...row('Course to steer', best),
          ['Distance to run (relative)', unitLabel(dist)],
          ...(slow ? (slow.immediately
            ? [['Reduce speed', 'at once: the deceleration distance is more than the run'] as [string, string]]
            : [['Reduce to the Guide\'s speed when', `the Guide bears ${bearing(slow.guideBearsTrue)} (${relName(slow.guideBearsTrue, gc!)}) at ${unitLabel(slow.distance)}`] as [string, string], ['Deceleration distance', `${Math.round(slow.decelDistance / NM_PER_YD)} yd`] as [string, string]]) : []),
        ]} />
      )}
      {sols[1] && <Result tone="warn" rows={row('Other course that also works', sols[1])} />}
      {best && loss === null && ss! > gs! && <p className="text-[11px] text-slate-500 font-medium">Enter the ship's loss of speed (yards per knot) to find where to reduce speed. It comes from her deceleration runs when they are recorded.</p>}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">The course is worked from the relative velocity triangle (BR 45(6) para 0423) and does not allow for the turn: allow for advance and transfer with the Wheel-over tool, and for loss of speed in the turn. The point to reduce speed uses the deceleration distance of para 0424. Follow the OTC's signals and the ship's standing orders.</p>
    </div>
  );
};
