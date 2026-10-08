import React from 'react';
import * as nav from './navMath';
import { Field, Grid, Panel, Result, SELECT, Seg, UnitPick, Warn, fromNm, toNum, useForm, useMemory, useUnit } from './kit';
import { calendarOf } from './sunEphemeris';
import { Common, Conditions, SightInput, SightResult, parseClock, parseIsoDate, parseZone, srm, srs, zoneToJd } from './sunSights';

// Sun Run Sun and Sun Run Merpass: the Sun-sight fixes of the Sun Run workbook, worked on the device.
// The sums are in sunSights.ts and sunEphemeris.ts; this file is the entry forms and the way the answers are shown.

const FIELDS = ['date', 'zone', 'lat', 'lon', 'course', 'speed', 'hoe', 'ie', 'temp', 'press'] as const;

/** "52°27.2'" */
const dm = (d: number, digits = 1) => {
  let deg = Math.floor(Math.abs(d)), min = +(((Math.abs(d) - deg) * 60).toFixed(digits));
  if (min >= 60) { deg += 1; min = 0; }
  return `${d < 0 ? '-' : ''}${deg}°${min.toFixed(digits)}'`;
};

/** Zone time of a Julian day (UT) as "HH:MM:SS". */
const clock = (jd: number, zone: number) => {
  const [, , , f] = calendarOf(jd + zone / 24 + 0.5 / 86400);
  const s = Math.floor(f * 86400);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
};

const DateField: React.FC<{ value: string; onChange: (s: string) => void }> = ({ value, onChange }) => (
  <label className="block space-y-1">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date (zone time)</span>
    <input type="date" value={value} onChange={e => onChange(e.target.value)} aria-label="Date"
      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
  </label>
);

/** The ship, the date, and the sextant and weather: shared by both tools, so it is entered once. */
function useSetup() {
  const f = useForm('sun', FIELDS);
  const [offArc, setOffArc] = useMemory('sun:offarc', true);
  const [limb, setLimb] = useMemory<'LL' | 'UL'>('sun:limb', 'LL');
  const date = parseIsoDate(f.v.date), zone = parseZone(f.v.zone);
  const lat = nav.parseCoord(f.v.lat, 'lat'), lon = nav.parseCoord(f.v.lon, 'lon');
  const course = f.n('course'), speed = f.n('speed'), hoe = f.n('hoe');
  const ie = f.v.ie.trim() === '' ? 0 : f.n('ie'), temp = f.v.temp.trim() === '' ? 10 : f.n('temp'), press = f.v.press.trim() === '' ? 1010 : f.n('press');
  const ready = !!date && zone !== null && lat !== null && lon !== null && course !== null && course >= 0 && course <= 360 && speed !== null && speed >= 0
    && hoe !== null && hoe >= 0 && ie !== null && ie >= 0 && temp !== null && press !== null && press > 0;
  const common: Common | null = ready ? {
    dr: { lat: lat!, lon: lon! }, course: course!, speed: speed!,
    cond: { hoeM: hoe!, ieMin: ie!, offArc, limb, tempC: temp!, pressMb: press! } as Conditions,
  } : null;

  /** zone clock text -> Julian day; a time earlier than `after` is taken as the next day */
  const jdOf = (text: string, after?: number): number | null => {
    const sec = parseClock(text);
    if (!date || zone === null || sec === null) return null;
    let jd = zoneToJd(date[0], date[1], date[2], 0, 0, sec, zone);
    if (after !== undefined && jd < after) jd += 1;
    return jd;
  };

  const ui = (
    <>
      <Panel title="Ship and date" note="The DR is the ship's estimated position at the time of the first sight. The zone is hours from UT, east positive (India +5:30). Temperature and pressure are used for refraction; leave blank for 10°C and 1010 mb.">
        <Grid>
          <DateField value={f.v.date} onChange={f.bind('date').onChange} />
          <Field label="Zone (h from UT)" hint="+5:30" text invalid={f.v.zone.trim() !== '' && zone === null} {...f.bind('zone')} />
          <Field label="DR latitude" hint="15 20 N" text invalid={f.v.lat.trim() !== '' && lat === null} {...f.bind('lat')} />
          <Field label="DR longitude" hint="78 35 E" text invalid={f.v.lon.trim() !== '' && lon === null} {...f.bind('lon')} />
          <Field label="Course" unit="°T" {...f.bind('course')} />
          <Field label="Speed" unit="kn" {...f.bind('speed')} />
        </Grid>
      </Panel>
      <Panel title="Sextant and weather">
        <Grid>
          <Field label="Height of eye" unit="m" {...f.bind('hoe')} />
          <Field label="Index error" unit="′" hint="0" {...f.bind('ie')} />
        </Grid>
        <Seg value={offArc ? 'off' : 'on'} onChange={v => setOffArc(v === 'off')} options={[['off', 'Off the arc (add)'], ['on', 'On the arc (subtract)']]} />
        <Seg value={limb} onChange={v => setLimb(v as 'LL' | 'UL')} options={[['LL', 'Lower limb'], ['UL', 'Upper limb']]} />
        <Grid>
          <Field label="Temperature" unit="°C" hint="10" {...f.bind('temp')} />
          <Field label="Pressure" unit="mb" hint="1010" {...f.bind('press')} />
        </Grid>
      </Panel>
    </>
  );
  return { f, common, zone, jdOf, ui, ready };
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

const NOTE = 'An aid for checking your own working. The Sun is worked out on the device to about a minute of arc, not taken from the Nautical Almanac, so compare with the almanac for anything that matters.';

export const SunRunSunTool: React.FC = () => {
  const setup = useSetup();
  const { f, common, zone, jdOf } = setup;
  const g = useForm('srs', ['t1', 'a1', 't2', 'a2'] as const);
  const [unit, setUnit] = useUnit('srs:unit', 'nm');
  const j1 = jdOf(g.v.t1), j2 = j1 === null ? null : jdOf(g.v.t2, j1);
  const a1 = nav.parseAngle(g.v.a1), a2 = nav.parseAngle(g.v.a2);
  const r = common && j1 !== null && j2 !== null && a1 !== null && a2 !== null
    ? srs(common, { jd: j1, sextantDeg: a1 } as SightInput, { jd: j2, sextantDeg: a2 } as SightInput) : null;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;

  return (
    <div className="space-y-3">
      {setup.ui}
      <Panel title="Sun run Sun" note={NOTE}>
        <Grid>
          <Field label="First sight, zone time" hint="09:15:00" text invalid={bad(g.v.t1, j1 !== null)} {...g.bind('t1')} />
          <Field label="Sextant altitude" unit="° ′" hint="52 15.0" text invalid={bad(g.v.a1, a1 !== null)} {...g.bind('a1')} />
          <Field label="Second sight, zone time" hint="11:45:00" text invalid={bad(g.v.t2, j2 !== null)} {...g.bind('t2')} />
          <Field label="Sextant altitude" unit="° ′" hint="79 30.0" text invalid={bad(g.v.a2, a2 !== null)} {...g.bind('a2')} />
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
            ]} />
          )}
          <SightDetail title="First sight" s={r.first} zone={zone} />
          <SightDetail title="Second sight" s={r.second} zone={zone} />
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">DR at the second sight: {nav.formatCoord(r.dr2.lat, 'lat')} {nav.formatCoord(r.dr2.lon, 'lon')}. The first position line is carried forward by the run and crossed with the second.</p>
        </>
      )}
    </div>
  );
};

export const SunRunMerpassTool: React.FC = () => {
  const setup = useSetup();
  const { common, zone, jdOf } = setup;
  const g = useForm('srm', ['t1', 'a1', 'tm', 'am'] as const);
  const [unit, setUnit] = useUnit('srm:unit', 'nm');
  const j1 = jdOf(g.v.t1), a1 = nav.parseAngle(g.v.a1), am = nav.parseAngle(g.v.am);
  const jm = j1 === null || g.v.tm.trim() === '' ? undefined : jdOf(g.v.tm, j1) ?? undefined;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;
  // the expected time of passage is useful before the meridian altitude has been taken
  const early = common && j1 !== null && a1 !== null ? srm(common, { jd: j1, sextantDeg: a1 }, 45) : null;
  const r = common && j1 !== null && a1 !== null && am !== null ? srm(common, { jd: j1, sextantDeg: a1 }, am, jm) : null;

  return (
    <div className="space-y-3">
      {setup.ui}
      <Panel title="Sun run Meridian passage" note={NOTE}>
        <Grid>
          <Field label="First sight, zone time" hint="09:15:00" text invalid={bad(g.v.t1, j1 !== null)} {...g.bind('t1')} />
          <Field label="Sextant altitude" unit="° ′" hint="52 15.0" text invalid={bad(g.v.a1, a1 !== null)} {...g.bind('a1')} />
        </Grid>
        {early && zone !== null && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-700">
            Meridian passage expected at {clock(early.mpJd, zone)} zone time. Take the highest altitude around then.
          </div>
        )}
        <Grid>
          <Field label="Meridian altitude" unit="° ′" hint="70 50.0" text invalid={bad(g.v.am, am !== null)} {...g.bind('am')} />
          <Field label="Time you observed it (optional)" hint="11:40:25" text invalid={bad(g.v.tm, jm !== undefined)} {...g.bind('tm')} />
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
            ]} />
          )}
          <SightDetail title="First sight" s={r.first} zone={zone} />
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Latitude = Sun's declination {dm(Math.abs(r.merSun.dec))} {r.merSun.dec >= 0 ? 'N' : 'S'} and zenith distance {dm(90 - r.merHo)}, taking the Sun {r.drMp.lat >= r.merSun.dec ? 'south' : 'north'} of the ship. The first position line is carried forward by the run and cut by that latitude.</p>
        </>
      )}
    </div>
  );
};

void SELECT; void toNum;
