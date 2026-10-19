import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { Ship } from '../types';
import { shipParams } from './shipParams';
import { saveFile } from '../services/backup';
import { sightFormsHtml } from '../services/sightFormHtml';
import * as nav from './navMath';
import { Field, Grid, Panel, Result, SELECT, Seg, UnitPick, Warn, fromNm, toNum, useForm, useMemory, useUnit } from './kit';
import { calendarOf, julianDay } from './sunEphemeris';
import { FormSet, distNm, srmForms, srsForms } from './sightForm';
import { Common, Conditions, SightInput, SightResult, parseClock, parseIsoDate, parseWatchError, parseZone, srm, zoneToJd } from './sunSights';

// Sun Run Sun and Sun Run Merpass: the Sun-sight fixes of the Sun Run workbook, worked on the device.
// The sums are in sunSights.ts and sunEphemeris.ts; this file is the entry forms and the way the answers are shown.

const FIELDS = ['date', 'zone', 'lat', 'lon', 'course', 'speed', 'hoe', 'ie', 'temp', 'press', 'from', 'to', 'dwe'] as const;

/** "52°27.2'" */
export const dm = (d: number, digits = 1) => {
  let deg = Math.floor(Math.abs(d)), min = +(((Math.abs(d) - deg) * 60).toFixed(digits));
  if (min >= 60) { deg += 1; min = 0; }
  return `${d < 0 ? '-' : ''}${deg}°${min.toFixed(digits)}'`;
};

/** Zone time of a Julian day (UT) as "HH:MM:SS". */
export const clock = (jd: number, zone: number) => {
  const [, , , f] = calendarOf(jd + zone / 24 + 0.5 / 86400);
  const s = Math.floor(f * 86400);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
};

export const DateField: React.FC<{ value: string; onChange: (s: string) => void }> = ({ value, onChange }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date (zone time)</span>
    <input type="date" value={value} onChange={e => onChange(e.target.value)} aria-label="Date"
      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
  </label>
);

/** The ship, the date, and the sextant and weather: shared by both tools, so it is entered once. */
/** `run: false` leaves out course and speed; `latitude: 'optional'` lets the DR latitude be left blank (the tool does not need it). */
export function useSetup(opts: { limb?: boolean; run?: boolean; latitude?: 'required' | 'optional'; ship?: Ship } = {}) {
  const needRun = opts.run !== false, needLat = opts.latitude !== 'optional';
  const sp = shipParams(opts.ship);
  const f = useForm('sun', FIELDS, { hoe: sp.heightOfEye === undefined ? undefined : String(Math.round(sp.heightOfEye * 10) / 10) });
  const [offArc, setOffArc] = useMemory('sun:offarc', true);
  const [limb, setLimb] = useMemory<'LL' | 'UL'>('sun:limb', 'LL');
  const date = parseIsoDate(f.v.date), zone = parseZone(f.v.zone);
  const lat = nav.parseCoord(f.v.lat, 'lat'), lon = nav.parseCoord(f.v.lon, 'lon');
  const course = f.n('course'), speed = f.n('speed'), hoe = f.n('hoe');
  const ie = f.v.ie.trim() === '' ? 0 : f.n('ie'), temp = f.v.temp.trim() === '' ? 10 : f.n('temp'), press = f.v.press.trim() === '' ? 1010 : f.n('press');
  const ready = !!date && zone !== null && lon !== null
    && (needLat ? lat !== null : f.v.lat.trim() === '' || lat !== null)
    && (!needRun || (course !== null && course >= 0 && course <= 360 && speed !== null && speed >= 0))
    && hoe !== null && hoe >= 0 && ie !== null && ie >= 0 && temp !== null && press !== null && press > 0;
  const common: Common | null = ready ? {
    dr: { lat: lat ?? 0, lon: lon! }, course: course ?? 0, speed: speed ?? 0,
    cond: { hoeM: hoe!, ieMin: ie!, offArc, limb, tempC: temp!, pressMb: press! } as Conditions,
  } : null;

  /** zone clock text -> Julian day; a time earlier than `after` is taken as the next day */
  const dwe = f.v.dwe.trim() === '' ? undefined : parseWatchError(f.v.dwe);
  const [basis, setBasis] = useMemory<'zt' | 'dwt'>('sun:basis', 'zt');
  /** zone clock text (or deck watch text) -> Julian day; a time earlier than `after` is taken as the next day */
  const jdOf = (text: string, after?: number): number | null => {
    const sec = parseClock(text);
    if (!date || zone === null || sec === null) return null;
    let jd: number;
    if (basis === 'dwt') {
      // the watch keeps GMT: GMT = watch + error; the Greenwich date is the one that puts the zone time on the date entered
      const gmtSec = sec + (dwe ?? 0);
      jd = NaN;
      for (const off of [0, -1, 1]) {
        const cand = julianDay(date[0], date[1], date[2] + off, 0, 0, 0) + gmtSec / 86400;
        const z = calendarOf(cand + zone / 24 + 1e-9);
        if (z[0] === date[0] && z[1] === date[1] && z[2] === date[2]) { jd = cand; break; }
      }
      if (Number.isNaN(jd)) return null;
    } else jd = zoneToJd(date[0], date[1], date[2], 0, 0, sec, zone);
    if (after !== undefined && jd < after) jd += 1;
    return jd;
  };

  const ui = (
    <>
      <Panel title="Ship and date" note="The DR is the ship's estimated position: at the time of the first sight for the Sun fixes, at zero time for the star fix. The zone is hours from UT, east positive (India + 5:30). Temperature and pressure are used for refraction; leave blank for 10°C and 1010 mb.">
        <Grid>
          <DateField value={f.v.date} onChange={f.bind('date').onChange} />
          <Field label="Zone (h from UT)" kind="zone" wide invalid={f.v.zone.trim() !== '' && zone === null} {...f.bind('zone')} />
          <Field label={needLat ? 'DR latitude' : 'DR latitude (optional)'} kind="lat" wide invalid={f.v.lat.trim() !== '' && lat === null} {...f.bind('lat')} />
          <Field label="DR longitude" kind="lon" wide invalid={f.v.lon.trim() !== '' && lon === null} {...f.bind('lon')} />
          {needRun && <Field label="Course" unit="°T" sensor="course" {...f.bind('course')} />}
          {needRun && <Field label="Speed" unit="kn" sensor="speed" {...f.bind('speed')} />}
          <Field label="From (optional)" text hint="port" {...f.bind('from')} />
          <Field label="To (optional)" text hint="port" {...f.bind('to')} />
        </Grid>
      </Panel>
      <Panel title="Deck watch" note="Leave the watch error blank if the times you enter are already right. With a watch error the form shows the deck watch reading (G.M.T. less the error). Choose Slow or Fast, then the seconds.">
        <Seg value={basis} onChange={v => setBasis(v as 'zt' | 'dwt')} options={[['zt', 'Times are zone time'], ['dwt', 'Times are deck watch']]} />
        <Field label="Watch error (seconds)" kind="watch" wide invalid={f.v.dwe.trim() !== '' && dwe === null} {...f.bind('dwe')} />
      </Panel>
      <Panel title="Sextant and weather">
        <Grid>
          <Field label="Height of eye" unit="m" {...f.bind('hoe')} />
          <Field label="Index error" unit="′" hint="0" {...f.bind('ie')} />
        </Grid>
        <Seg value={offArc ? 'off' : 'on'} onChange={v => setOffArc(v === 'off')} options={[['off', 'Off the arc (add)'], ['on', 'On the arc (subtract)']]} />
        {opts.limb !== false && <Seg value={limb} onChange={v => setLimb(v as 'LL' | 'UL')} options={[['LL', 'Lower limb'], ['UL', 'Upper limb']]} />}
        <Grid>
          <Field label="Temperature" unit="°C" hint="10" {...f.bind('temp')} />
          <Field label="Pressure" unit="mb" hint="1010" {...f.bind('press')} />
        </Grid>
      </Panel>
    </>
  );
  return { f, common, zone, jdOf, ui, ready, dweSec: dwe ?? undefined, basis, lat, lon, date };
}

const SightDetail: React.FC<{ title: string; s: SightResult; zone: number }> = ({ title, s, zone }) => (
  <details className="bg-white rounded-xl border border-slate-200 text-xs">
    <summary className="px-3 py-2 font-bold text-slate-600 cursor-pointer">{title}: intercept {Math.abs(s.line.intercept).toFixed(1)}′ {s.line.intercept >= 0 ? 'towards' : 'away'}, Zn {String(Math.round(s.red.zn)).padStart(3, '0')}°</summary>
    <dl className="px-3 pb-3 grid grid-cols-2 gap-x-3 gap-y-1 font-medium text-slate-600">
      <dt>Zone time</dt><dd className="font-bold text-slate-800">{clock(s.jd, zone)}</dd>
      <dt>GHA Sun</dt><dd className="font-bold text-slate-800">{dm(s.sun.gha)}</dd>
      <dt>Declination</dt><dd className="font-bold text-slate-800">{dm(Math.abs(s.sun.dec))} {s.sun.dec >= 0 ? 'N' : 'S'}</dd>
      <dt>LHA (from DR)</dt><dd className="font-bold text-slate-800">{dm(s.red.lha)}</dd>
      <dt>Semi-diameter</dt><dd className="font-bold text-slate-800">{s.sun.sd.toFixed(1)}′</dd>
      <dt>Apparent altitude</dt><dd className="font-bold text-slate-800">{dm(s.apparent)}</dd>
      <dt>Corrections (total)</dt><dd className="font-bold text-slate-800">{s.corr.total >= 0 ? '+' : ''}{s.corr.total.toFixed(1)}′</dd>
      <dt>True altitude Ho</dt><dd className="font-bold text-slate-800">{dm(s.ho)}</dd>
      <dt>Calculated Hc</dt><dd className="font-bold text-slate-800">{dm(s.red.hc)}</dd>
    </dl>
  </details>
);

/** Saves the filled Sight Forms (NP 98) as a printable page. */
export const FormsButton: React.FC<{ set: FormSet; title: string; file: string; ship?: Ship }> = ({ set, title, file, ship }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await saveFile(`${file}-${new Date().toISOString().slice(0, 10)}.html`, { text: sightFormsHtml(set, { title, ship: ship?.name }) }, 'text/html', `${title} sight forms`); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); if (!/cancel/i.test(m)) setMsg(m); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-1">
      <button onClick={save} disabled={busy} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold active:scale-95 transition-all disabled:opacity-50"><FileText size={16} />Save the filled sight forms (print or PDF)</button>
      {msg && <p className="text-[11px] text-red-500 font-medium">{msg}</p>}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">The Sight Form (NP 98) in the order of its 37 lines, with the figures worked out for the chosen position, ready to check against the Nautical Almanac and the Sight Reduction Tables. Open the file in a browser to print it.</p>
    </div>
  );
};

/** The position worked by the sight forms next to the direct calculation, so the two can be compared. */
const crossRows = (set: FormSet): [string, string][] =>
  set.fixForm && set.fixDirect ? [
    ['By the sight forms', `${nav.formatCoord(set.fixForm.lat, 'lat')} ${nav.formatCoord(set.fixForm.lon, 'lon')}`],
    ['Difference from the direct figure', `${distNm(set.fixForm, set.fixDirect).toFixed(2)} nm`],
  ] : [];

export const NOTE = 'An aid for checking your own working. The Sun is worked out on the device to about a minute of arc, not taken from the Nautical Almanac, so compare with the almanac for anything that matters.';

export const SunRunSunTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const setup = useSetup({ ship });
  const { f, common, zone, jdOf } = setup;
  const g = useForm('srs', ['t1', 'a1', 't2', 'a2'] as const);
  const [unit, setUnit] = useUnit('srs:unit', 'nm');
  const j1 = jdOf(g.v.t1), j2 = j1 === null ? null : jdOf(g.v.t2, j1);
  const a1 = nav.parseAngle(g.v.a1), a2 = nav.parseAngle(g.v.a2);
  const out = common && zone !== null && j1 !== null && j2 !== null && a1 !== null && a2 !== null
    ? srsForms(common, { jd: j1, sextantDeg: a1 } as SightInput, { jd: j2, sextantDeg: a2 } as SightInput, zone, { from: f.v.from, to: f.v.to, dweSec: setup.dweSec }) : null;
  const r = out?.result ?? null;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;

  return (
    <div className="space-y-3">
      {setup.ui}
      <Panel title="Sun run Sun" note={NOTE}>
        <Grid>
          <Field label="First sight, zone time" kind="time" invalid={bad(g.v.t1, j1 !== null)} {...g.bind('t1')} />
          <Field label="Sextant altitude" unit="° ′" kind="angle" invalid={bad(g.v.a1, a1 !== null)} {...g.bind('a1')} />
          <Field label="Second sight, zone time" kind="time" invalid={bad(g.v.t2, j2 !== null)} {...g.bind('t2')} />
          <Field label="Sextant altitude" unit="° ′" kind="angle" invalid={bad(g.v.a2, a2 !== null)} {...g.bind('a2')} />
        </Grid>
        <UnitPick label="Run shown in" unit={unit} onChange={setUnit} />
        {!setup.ready && <p className="text-xs text-slate-400 font-medium">Fill in the date, zone, DR, course, speed and height of eye above.</p>}
      </Panel>
      {r && zone !== null && (
        <>
          {r.warnings.map(w => <Warn key={w}>{w}</Warn>)}
          {r.fix && (
            <Result rows={[
              ['Observed latitude', nav.formatCoord(r.fix.lat, 'lat')],
              ['Observed longitude', nav.formatCoord(r.fix.lon, 'lon')],
              ['Time of fix', clock(r.second.jd, zone)],
              ['Run between sights', fromNm(r.run, unit)],
              ['Lines cross at', `${r.cut.toFixed(0)}°`],
              ...(out ? crossRows(out.set) : []),
            ]} />
          )}
          {out && <FormsButton set={out.set} title="Sun run Sun" file="sight-forms-srs" ship={ship} />}
          <SightDetail title="First sight" s={r.first} zone={zone} />
          <SightDetail title="Second sight" s={r.second} zone={zone} />
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">DR at the second sight: {nav.formatCoord(r.dr2.lat, 'lat')} {nav.formatCoord(r.dr2.lon, 'lon')}. The first position line is carried forward by the run and crossed with the second.</p>
        </>
      )}
    </div>
  );
};

export const SunRunMerpassTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const setup = useSetup({ ship });
  const { common, zone, jdOf } = setup;
  const g = useForm('srm', ['t1', 'a1', 'tm', 'am'] as const);
  const [unit, setUnit] = useUnit('srm:unit', 'nm');
  const j1 = jdOf(g.v.t1), a1 = nav.parseAngle(g.v.a1), am = nav.parseAngle(g.v.am);
  const jm = j1 === null || g.v.tm.trim() === '' ? undefined : jdOf(g.v.tm, j1) ?? undefined;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;
  // the expected time of passage is useful before the meridian altitude has been taken
  const early = common && j1 !== null && a1 !== null ? srm(common, { jd: j1, sextantDeg: a1 }, 45) : null;
  const out = common && zone !== null && j1 !== null && a1 !== null && am !== null ? srmForms(common, { jd: j1, sextantDeg: a1 }, am, zone, { from: setup.f.v.from, to: setup.f.v.to, dweSec: setup.dweSec }, jm) : null;
  const r = out?.result ?? null;

  return (
    <div className="space-y-3">
      {setup.ui}
      <Panel title="Sun run Meridian passage" note={NOTE}>
        <Grid>
          <Field label="First sight, zone time" kind="time" invalid={bad(g.v.t1, j1 !== null)} {...g.bind('t1')} />
          <Field label="Sextant altitude" unit="° ′" kind="angle" invalid={bad(g.v.a1, a1 !== null)} {...g.bind('a1')} />
        </Grid>
        {early && zone !== null && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-700">
            Meridian passage expected at {clock(early.mpJd, zone)} zone time. Take the highest altitude around then.
          </div>
        )}
        <Grid>
          <Field label="Meridian altitude" unit="° ′" kind="angle" invalid={bad(g.v.am, am !== null)} {...g.bind('am')} />
          <Field label="Time you observed it (optional)" kind="time" invalid={bad(g.v.tm, jm !== undefined)} {...g.bind('tm')} />
        </Grid>
        <UnitPick label="Run shown in" unit={unit} onChange={setUnit} />
        {!setup.ready && <p className="text-xs text-slate-400 font-medium">Fill in the date, zone, DR, course, speed and height of eye above.</p>}
      </Panel>
      {r && zone !== null && (
        <>
          {r.warnings.map(w => <Warn key={w}>{w}</Warn>)}
          {r.fix && (
            <Result rows={[
              ['Observed latitude', nav.formatCoord(r.fix.lat, 'lat')],
              ['Observed longitude', nav.formatCoord(r.fix.lon, 'lon')],
              ['Meridian passage', `${clock(r.mpJd, zone)}${r.usedObservedTime ? ' (observed time used)' : ' (worked out)'}`],
              ['Run to meridian passage', fromNm(r.run, unit)],
              ['Meridian altitude Ho', dm(r.merHo)],
              ...(out ? crossRows(out.set) : []),
            ]} />
          )}
          {out && <FormsButton set={out.set} title="Sun run Merpass" file="sight-forms-srm" ship={ship} />}
          <SightDetail title="First sight" s={r.first} zone={zone} />
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Latitude = Sun's declination {dm(Math.abs(r.merSun.dec))} {r.merSun.dec >= 0 ? 'N' : 'S'} and zenith distance {dm(90 - r.merHo)}, taking the Sun {r.drMp.lat >= r.merSun.dec ? 'south' : 'north'} of the ship. The first position line is carried forward by the run and cut by that latitude.</p>
        </>
      )}
    </div>
  );
};

void SELECT; void toNum;
