import React from 'react';
import * as nav from './navMath';
import { Field, Grid, Panel, Result, Seg, Warn, useForm, useMemory } from './kit';
import { NOTE, clock, dm, useSetup } from './SunTools';
import { polarisLatitude } from './polaris';
import { amplitude, compassError, dipDegrees, sunBearing, sunTimes } from './riseSet';
import { parseAngle } from './navMath';

// Polaris latitude, and Sun rise, set and twilight times with the gyro or compass error from a bearing. The sums are in
// polaris.ts and riseSet.ts; this is the entry forms.

const hm = (jd: number | null, zone: number) => (jd === null ? '—' : clock(jd, zone).slice(0, 5));

export const PolarisTool: React.FC = () => {
  const setup = useSetup({ limb: false, run: false, latitude: 'optional' });
  const { common, jdOf, lon, lat, zone } = setup;
  const g = useForm('polaris', ['t', 'a'] as const);
  const jd = jdOf(g.v.t), alt = parseAngle(g.v.a);
  const r = common && jd !== null && alt !== null && lon !== null ? polarisLatitude({ jd, lon, sextantDeg: alt, cond: common.cond }) : null;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;
  const warnings = r ? [...r.warnings] : [];
  if (r && lat !== null && Math.abs(r.lat - lat) > 1) warnings.push(`The latitude from Polaris is ${Math.abs(r.lat - lat).toFixed(1)}° from the DR. Check the time, the longitude and the altitude.`);

  return (
    <div className="space-y-3">
      {setup.ui}
      <Panel title="Latitude from Polaris" note={`Polaris is within a degree of the celestial pole, so its true altitude is the latitude, corrected for how far it is from the pole at that moment. Only the longitude (for the hour angle) matters in the DR: a degree out in longitude is under a minute of latitude. ${NOTE}`}>
        <Grid>
          <Field label="Time of sight" hint="19:15:00" text invalid={bad(g.v.t, jd !== null)} {...g.bind('t')} />
          <Field label="Sextant altitude" unit="° ′" hint="8 20.2" text invalid={bad(g.v.a, alt !== null)} {...g.bind('a')} />
        </Grid>
        {!setup.ready && <p className="text-xs text-slate-400 font-medium">Fill in the date, zone, DR longitude and height of eye above.</p>}
      </Panel>
      {r && zone !== null && jd !== null && (
        <>
          {warnings.map(w => <Warn key={w}>{w}</Warn>)}
          <Result rows={[
            ['Latitude', nav.formatCoord(r.lat, 'lat')],
            ['True altitude', dm(r.ho)],
            ['a0 + a1 + a2', dm(r.sumA / 60)],
            ['LHA Aries', dm(r.lhaAries)],
          ]} />
          <details className="bg-white rounded-xl border border-slate-200 text-xs">
            <summary className="px-3 py-2 font-bold text-slate-600 cursor-pointer">The working</summary>
            <dl className="px-3 pb-3 grid grid-cols-2 gap-x-3 gap-y-1 font-medium text-slate-600">
              <dt>G.M.T.</dt><dd className="font-bold text-slate-800">{clock(jd, 0)}</dd>
              <dt>GHA Aries</dt><dd className="font-bold text-slate-800">{dm(r.ariesGha)}</dd>
              <dt>DR longitude</dt><dd className="font-bold text-slate-800">{lon !== null ? nav.formatCoord(lon, 'lon') : ''}</dd>
              <dt>LHA Aries</dt><dd className="font-bold text-slate-800">{dm(r.lhaAries)}</dd>
              <dt>Polaris SHA and Dec</dt><dd className="font-bold text-slate-800">{dm(r.sha)} / {dm(r.dec)} N</dd>
              <dt>LHA Polaris</dt><dd className="font-bold text-slate-800">{dm(r.lhaPolaris)}</dd>
              <dt>Apparent altitude</dt><dd className="font-bold text-slate-800">{dm(r.apparent)}</dd>
              <dt>Refraction (A3)</dt><dd className="font-bold text-slate-800">{r.refraction.toFixed(1)}′</dd>
              <dt>True altitude Ho</dt><dd className="font-bold text-slate-800">{dm(r.ho)}</dd>
              <dt>First-order term</dt><dd className="font-bold text-slate-800">{r.first.toFixed(1)}′</dd>
              <dt>Second-order term</dt><dd className="font-bold text-slate-800">{r.second.toFixed(1)}′</dd>
              <dt>Lat = Ho − 1° + (a0+a1+a2)</dt><dd className="font-bold text-slate-800">{nav.formatCoord(r.lat, 'lat')}</dd>
            </dl>
            <p className="px-3 pb-3 text-[10px] text-slate-400 font-medium leading-relaxed">The almanac splits a0 + a1 + a2 into three table values in its own way; their sum is the figure above. Compare the sum with your almanac working.</p>
          </details>
        </>
      )}
    </div>
  );
};

export const RiseSetTool: React.FC = () => {
  const setup = useSetup({ limb: false, run: false });
  const { common, jdOf, zone } = setup;
  const g = useForm('riseset', ['t', 'b'] as const);
  const [horizon, setHorizon] = useMemory<'almanac' | 'eye'>('riseset:horizon', 'almanac');
  const [event, setEvent] = useMemory<'rise' | 'set'>('riseset:event', 'rise');
  const noon = jdOf('12:00:00');
  const dip = common && horizon === 'eye' ? dipDegrees(common.cond.hoeM) : 0;
  const t = common && noon !== null ? sunTimes(common.dr, noon, dip) : null;

  // true bearing at the sight: at the time entered, or at the rising or setting itself
  const obsJd = g.v.t.trim() === '' ? null : jdOf(g.v.t, noon !== null && event === 'set' ? noon : undefined);
  const observed = parseAngle(g.v.b);
  const trueAt = common && t ? (obsJd !== null ? sunBearing(common.dr, obsJd).zn : event === 'rise' ? t.riseBearing : t.setBearing) : null;
  const err = trueAt !== null && trueAt !== undefined && observed !== null ? compassError(trueAt, observed) : null;
  const bad = (text: string, ok: boolean) => text.trim() !== '' && !ok;

  return (
    <div className="space-y-3">
      {setup.ui}
      <Panel title="Rising, setting and twilight" note="For the DR position and the date. Almanac times are for the Sun's upper limb on a sea-level horizon with standard refraction; 'as seen from the height of eye' allows for the dip of the horizon. Twilight is for the Sun's centre 6°, 12° and 18° below the horizon.">
        <Seg value={horizon} onChange={v => setHorizon(v as 'almanac' | 'eye')} options={[['almanac', 'Almanac (sea level)'], ['eye', 'From the height of eye']]} />
        {!setup.ready && <p className="text-xs text-slate-400 font-medium">Fill in the date, zone, DR and height of eye above.</p>}
      </Panel>
      {t && zone !== null && (
        <>
          <Result rows={[
            ['Sunrise', hm(t.rise, zone)], ['Meridian passage', hm(t.meridianPassage, zone)], ['Sunset', hm(t.set, zone)],
            ['Civil twilight', `${hm(t.civil[0], zone)}  ${hm(t.civil[1], zone)}`],
            ['Nautical twilight', `${hm(t.nautical[0], zone)}  ${hm(t.nautical[1], zone)}`],
            ['Astronomical twilight', `${hm(t.astronomical[0], zone)}  ${hm(t.astronomical[1], zone)}`],
            ...(t.rise !== null && t.set !== null ? [['Length of the day', `${Math.floor((t.set - t.rise) * 24)}h ${String(Math.round(((t.set - t.rise) * 24) % 1 * 60)).padStart(2, '0')}m`] as [string, string]] : []),
          ]} />
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Zone times, start then end for the twilights. A dash means the Sun does not reach that altitude on this date at this latitude. Meridian passage: LMT {hm(t.meridianPassage, setup.lon === null ? 0 : setup.lon / 15)}, Sun's declination {dm(Math.abs(t.dec))} {t.dec >= 0 ? 'N' : 'S'}.</p>
          {(t.rise === null || t.set === null) && <Warn>The Sun does not rise or set on this date at this latitude.</Warn>}
          <Panel title="True bearing and gyro or compass error" note="The Sun's true bearing at rising or setting (the amplitude), or at any time you enter. Enter the bearing you read from the gyro or compass to get its error: true bearing less observed, east positive.">
            <Result rows={[
              ['Rising bearing', t.riseBearing === null ? '—' : `${t.riseBearing.toFixed(1)}° T  (${amplitude(t.riseBearing, 'rise')})`],
              ['Setting bearing', t.setBearing === null ? '—' : `${t.setBearing.toFixed(1)}° T  (${amplitude(t.setBearing, 'set')})`],
            ]} />
            <Seg value={event} onChange={v => setEvent(v as 'rise' | 'set')} options={[['rise', 'Observed at rising'], ['set', 'Observed at setting']]} />
            <Grid>
              <Field label="Time observed (optional)" hint="05:58:30" text invalid={bad(g.v.t, obsJd !== null)} {...g.bind('t')} />
              <Field label="Bearing read" unit="°" hint="101.5" text invalid={bad(g.v.b, observed !== null)} {...g.bind('b')} />
            </Grid>
            {trueAt !== null && trueAt !== undefined && <p className="text-xs font-medium text-slate-600">True bearing of the Sun {obsJd !== null ? 'at that time' : `at ${event === 'rise' ? 'rising' : 'setting'}`}: <b>{trueAt.toFixed(1)}° T</b></p>}
            {err !== null && <Result rows={[['Error', `${Math.abs(err).toFixed(1)}° ${err > 0 ? 'East' : err < 0 ? 'West' : ''}`.trim()], ['The compass reads', err > 0 ? 'too low' : err < 0 ? 'too high' : 'true']]} />}
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">If you leave the time blank the bearing is taken at the moment of rising or setting (upper limb on the horizon). For a bearing taken a little after rising or before setting, enter the time.</p>
          </Panel>
        </>
      )}
    </div>
  );
};
