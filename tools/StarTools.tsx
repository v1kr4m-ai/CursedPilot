import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { Ship } from '../types';
import { saveFile } from '../services/backup';
import { rapidFormHtml } from '../services/rapidFormHtml';
import * as nav from './navMath';
import { Field, Grid, Panel, Result, SELECT, Seg, UnitPick, Warn, fromNm, useForm, useMemory, useUnit } from './kit';
import { FormsButton, NOTE, clock, dm, useSetup } from './SunTools';
import { StarPlan, fourStarFix, planFourStar, rapidFix } from './fourStar';
import type { RapidResult } from './fourStar';
import type { StarSightIn } from './fourStar';
import { STARS } from './stars';
import { BODY_NAMES } from './bodies';
import { targetByName, targetKey, targetName, targetTag } from './targets';
import { parseAngle } from './navMath';
import { parseStopwatch } from './sunSights';

// Four star fix (the rapid method): when to start the stopwatch and which stars to take, then the sights reduced on
// the Sight Form and the four position lines crossed. The sums are in fourStar.ts; this is the entry forms.

const SLOTS = [1, 2, 3, 4] as const;
const FIELDS = ['interval', 'k1', 'k2', 'k3', 'k4', 't1', 't2', 't3', 't4', 'a1', 'a2', 'a3', 'a4'] as const;

const RapidBlock: React.FC<{ r: RapidResult; zone: number; zeroJd: number; setup: ReturnType<typeof useSetup>; ship?: Ship }> = ({ r, zone, zeroJd, setup, ship }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const c = setup.common;
  const save = async () => {
    if (!c) return;
    setBusy(true); setMsg(null);
    try {
      const html = rapidFormHtml(r, { header: { from: setup.f.v.from, to: setup.f.v.to, co: `${Math.round(c.course)}°`, spd: `${c.speed}`, he: `${c.cond.hoeM} m` }, zone, zeroJd, dr: c.dr, ship: ship?.name });
      await saveFile(`rapid-star-fix-${new Date().toISOString().slice(0, 10)}.html`, { text: html }, 'text/html', 'Rapid star fix');
    } catch (e) { const m = e instanceof Error ? e.message : String(e); if (!/cancel/i.test(m)) setMsg(m); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-700 space-y-1">
        <div>Chosen position {nav.formatCoord(r.ap.lat, 'lat')} {nav.formatCoord(r.ap.lon, 'lon')}, LHA Aries {r.chosenLhaAries}° at t0 {clock(r.t0Jd, zone)}.</div>
        <div>Every star is reduced from this one position and its altitude brought to t0.</div>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"><th className="py-1">Star</th><th>Tab. alt.</th><th>Zn</th><th>Time corr.</th><th>Intercept</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {r.lines.map(l => (
            <tr key={targetKey(l.target)} className="font-bold text-slate-800">
              <td className="py-1.5">{l.name}</td><td>{dm(l.tabHc)}</td><td>{String(Math.round(l.zn)).padStart(3, '0')}°</td>
              <td>{l.rotation >= 0 ? '+' : '−'}{Math.abs(l.rotation).toFixed(1)}′</td><td>{Math.abs(l.intercept).toFixed(1)}′ {l.intercept >= 0 ? 'to' : 'from'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={save} disabled={busy} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold active:scale-95 transition-all disabled:opacity-50"><FileText size={16} />Save the rapid sight form (print or PDF)</button>
      {msg && <p className="text-[11px] text-red-500 font-medium">{msg}</p>}
    </div>
  );
};

const PlanBlock: React.FC<{ plan: StarPlan; zone: number; dweSec?: number; onUse: () => void }> = ({ plan, zone, dweSec, onUse }) => (
  <div className="space-y-2">
    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-700 space-y-1">
      <div>Civil twilight {clock(plan.twilightJd, zone)}, start looking from {clock(plan.startJd, zone)}.</div>
      <div>Start the stopwatch at <span className="text-base">{clock(plan.zeroJd, zone)}</span> zone time (GMT {clock(plan.zeroJd, 0)}).</div>
      {dweSec !== undefined && <div>Deck watch to start the stopwatch: <span className="text-base">{clock(plan.zeroJd - dweSec / 86400, 0)}</span> (watch error {dweSec >= 0 ? '+' : '−'}{Math.abs(dweSec)}s).</div>}
      <div>Take all four stars between 0:00 and 4:00 on the stopwatch, about 2:00 on average. LHA Aries {plan.chosenLhaAries}° at {clock(plan.t0Jd, zone)}.</div>
    </div>
    <table className="w-full text-xs">
      <thead><tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"><th className="py-1">Star</th><th>Mag.</th><th>Altitude</th><th>Bearing</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {plan.suggested.map(c => <tr key={targetKey(c.target)} className="font-bold text-slate-800"><td className="py-1.5">{targetName(c.target)} <span className="text-slate-400 font-medium">{targetTag(c.target)}</span></td><td>{c.mag.toFixed(1)}</td><td>{dm(c.hc)}</td><td>{String(Math.round(c.zn)).padStart(3, '0')}°</td></tr>)}
      </tbody>
    </table>
    <button onClick={onUse} className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-blue-600 active:scale-95 transition-all">Use these four stars below</button>
    {plan.candidates.length > plan.suggested.length && (
      <details className="bg-white rounded-xl border border-slate-200 text-xs">
        <summary className="px-3 py-2 font-bold text-slate-600 cursor-pointer">All {plan.candidates.length} stars above the horizon then</summary>
        <div className="px-3 pb-3 columns-2 font-medium text-slate-600">
          {[...plan.candidates].sort((a, b) => a.zn - b.zn).map(c => <div key={targetKey(c.target)}>{targetName(c.target)}: {Math.round(c.hc)}° / {String(Math.round(c.zn)).padStart(3, '0')}°</div>)}
        </div>
      </details>
    )}
  </div>
);

export const FourStarTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const setup = useSetup({ ship });   // the limb is shown for the Moon
  const { f: sf, common, zone, jdOf, ready } = setup;
  const g = useForm('star', FIELDS);
  const [kind, setKind] = useMemory<'morning' | 'evening'>('star:kind', 'evening');
  const [timeMode, setTimeMode] = useMemory<'watch' | 'clock'>('star:timemode', 'watch');
  const [fixAt, setFixAt] = useMemory<'zero' | 'last'>('star:fixat', 'zero');
  const [method, setMethod] = useMemory<'forms' | 'rapid'>('star:method', 'forms');
  const [unit, setUnit] = useUnit('star:unit', 'nm');
  const interval = g.v.interval.trim() === '' ? 10 : g.n('interval');

  // the plan needs the DR and the date: local noon of that date in the zone
  const noonJd = jdOf('12:00:00');
  const plan = common && noonJd !== null && interval !== null && interval >= 0 && interval <= 60 ? planFourStar(common.dr, noonJd, kind, interval) : null;
  const noPlan = common && noonJd !== null && !plan;

  const useSuggested = () => plan?.suggested.forEach((c, i) => g.bind(`k${i + 1}` as (typeof FIELDS)[number]).onChange(targetName(c.target)));

  // the sights that are complete
  const sights: StarSightIn[] = [];
  const zeroJd = plan?.zeroJd ?? null;
  for (const i of SLOTS) {
    const target = targetByName(g.v[`k${i}` as (typeof FIELDS)[number]]);
    const alt = parseAngle(g.v[`a${i}` as (typeof FIELDS)[number]]);
    const text = g.v[`t${i}` as (typeof FIELDS)[number]];
    let jd: number | null = null;
    if (timeMode === 'watch') { const s = parseStopwatch(text); jd = s !== null && zeroJd !== null ? zeroJd + s / 86400 : null; }
    else jd = jdOf(text, noonJd ?? undefined);
    if (target && alt !== null && jd !== null) sights.push({ target, jd, sextantDeg: alt });
  }
  const refJd = zeroJd ?? (sights.length ? Math.min(...sights.map(s => s.jd)) : null);
  const out = common && zone !== null && refJd !== null && sights.length >= 2 ? fourStarFix(common, refJd, sights, zone, { from: sf.v.from, to: sf.v.to, dweSec: setup.dweSec }, fixAt) : null;
  const r = out?.result ?? null;
  const fixJdChosen = refJd === null ? null : fixAt === 'zero' ? refJd : Math.max(refJd, ...sights.map(s => s.jd));
  const rapid = common && plan && fixJdChosen !== null && sights.length >= 2 ? rapidFix(common, plan.t0Jd, sights, fixJdChosen) : null;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;

  return (
    <div className="space-y-2">
      {setup.ui}
      <Panel title="Four star fix: plan" note="The DR is the ship's position at zero time, when the stopwatch starts. Choose morning or evening, and how many minutes before civil twilight to begin (10 is usual). The tool works out the time to start the stopwatch so that LHA Aries is a whole number of degrees, then suggests four well-spread stars.">
        <Seg value={kind} onChange={v => setKind(v as 'morning' | 'evening')} options={[['morning', 'Morning stars'], ['evening', 'Evening stars']]} />
        <Field label="Start this many minutes before twilight" unit="min" hint="10" {...g.bind('interval')} />
        {!ready && <p className="text-xs text-slate-400 font-medium">Fill in the date, zone, DR, course, speed and height of eye above.</p>}
        {noPlan && <Warn>There is no civil twilight at this latitude and date, so the stars cannot be planned. You can still enter sights with the zone time.</Warn>}
        {plan && zone !== null && <PlanBlock plan={plan} zone={zone} dweSec={setup.dweSec} onUse={useSuggested} />}
      </Panel>

      <Panel title="Four star fix: sights" note={NOTE}>
        <Seg value={timeMode} onChange={v => setTimeMode(v as 'watch' | 'clock')} options={[['watch', 'Stopwatch reading'], ['clock', 'Zone time']]} />
        {SLOTS.map(i => {
          const k = `k${i}` as (typeof FIELDS)[number], t = `t${i}` as (typeof FIELDS)[number], a = `a${i}` as (typeof FIELDS)[number];
          return (
            <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Star {i}</p>
              <select value={g.v[k]} onChange={e => g.bind(k).onChange(e.target.value)} aria-label={`Star ${i}`} className={`${SELECT} w-full`}>
                <option value="">Choose the star</option>
                <optgroup label="Stars">{STARS.map(s => <option key={s.no} value={s.name}>{s.no}. {s.name} (mag {s.v.toFixed(1)})</option>)}</optgroup>
                <optgroup label="Planets and Moon">{BODY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
              </select>
              <Grid>
                {timeMode === 'watch'
                  ? <Field label="Stopwatch" kind="stopwatch" invalid={bad(g.v[t], parseStopwatch(g.v[t]) !== null)} {...g.bind(t)} />
                  : <Field label="Zone time" kind="time" invalid={bad(g.v[t], jdOf(g.v[t]) !== null)} {...g.bind(t)} />}
                <Field label="Sextant altitude" unit="° ′" kind="angle" invalid={bad(g.v[a], parseAngle(g.v[a]) !== null)} {...g.bind(a)} />
              </Grid>
            </div>
          );
        })}
        <Seg value={fixAt} onChange={v => setFixAt(v as 'zero' | 'last')} options={[['zero', 'Position at zero time'], ['last', 'Position at last sight']]} />
        <Seg value={method} onChange={v => setMethod(v as 'forms' | 'rapid')} options={[['forms', 'Each star on a Sight Form'], ['rapid', 'Rapid: one chosen position']]} />
        {sights.some(x => x.target.kind === 'body' && x.target.name === 'Moon') && <p className="text-[11px] text-slate-500 font-medium">The Moon: the limb chosen above (lower or upper) is applied, with the horizontal parallax and the semi-diameter, both worked out for the time.</p>}
        <UnitPick label="Run shown in" unit={unit} onChange={setUnit} />
        {timeMode === 'watch' && !plan && <p className="text-xs text-slate-400 font-medium">The stopwatch times are counted from the zero time in the plan above, so the plan must be complete (or use zone times).</p>}
      </Panel>

      {r && zone !== null && out && (
        <>
          {r.warnings.map(w => <Warn key={w}>{w}</Warn>)}
          {r.fix && (
            <Result rows={[
              ['Observed latitude', nav.formatCoord(r.fix.lat, 'lat')],
              ['Observed longitude', nav.formatCoord(r.fix.lon, 'lon')],
              ['Time of fix', clock(r.fixJd, zone)],
              ['Lines miss the fix by up to', `${r.maxResidual.toFixed(2)} nm`],
              ...(r.direct ? [['Direct calculation', `${nav.formatCoord(r.direct.lat, 'lat')} ${nav.formatCoord(r.direct.lon, 'lon')}`] as [string, string]] : []),
              ...(method === 'rapid' && rapid?.fix ? [['By the rapid method', `${nav.formatCoord(rapid.fix.lat, 'lat')} ${nav.formatCoord(rapid.fix.lon, 'lon')}`] as [string, string]] : []),
            ]} />
          )}
          {method === 'forms' && <FormsButton set={out.set} title="Four star fix" file="sight-forms-4star" ship={ship} />}
          {method === 'rapid' && (rapid && plan
            ? <RapidBlock r={rapid} zone={zone} zeroJd={plan.zeroJd} setup={setup} ship={ship} />
            : <Warn>The rapid method needs the plan above (stopwatch times counted from zero time), so it cannot be used when there is no twilight to plan on.</Warn>)}
          <details className="bg-white rounded-xl border border-slate-200 text-xs">
            <summary className="px-3 py-2 font-bold text-slate-600 cursor-pointer">The {r.lines.length} lines</summary>
            <table className="w-full px-3 pb-3 text-xs">
              <thead><tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"><th className="px-3 py-1">Star</th><th>Zone time</th><th>Zn</th><th>Run to fix</th><th>Miss</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {r.lines.map(l => (
                  <tr key={targetKey(l.target)} className="font-bold text-slate-800">
                    <td className="px-3 py-1.5">{l.name}</td><td>{clock(l.jd, zone)}</td><td>{String(Math.round(l.zn)).padStart(3, '0')}°</td>
                    <td>{fromNm(l.run, unit)}</td><td>{Math.abs(l.residual).toFixed(2)} nm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Each star is reduced from its own chosen position on its own form, the lines are carried to the time of the fix by the course and speed, and the best crossing of all of them is taken.</p>
        </>
      )}
    </div>
  );
};

