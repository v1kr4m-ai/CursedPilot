import React from 'react';
import { Field, Grid, Panel, Result, Seg, Warn, useForm, useMemory } from './kit';
import { STATIONS, angleOut, distanceLost360, reverseOrder, roundTheClock } from './stationChanges';
import type { Station } from './stationChanges';

// Station Changes: the manoeuvres of BR 45(6) paras 0427 to 0429: the suggested solution for changing between the standard stations
// (round the clock), reversing the order of ships in column, and losing distance by a 360 degree turn. The sums are in stationChanges.ts.

const TABS = [['clock', 'Round the clock'], ['reverse', 'Reverse the column'], ['lose', 'Lose distance']] as const;
const KEYS = ['gs', 'ss', 'ships', 'sp', 'cs', 'os', 'pk', 'tm', 'ts', 'loss'] as const;
const pick = 'w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700';

export const StationChangesTool: React.FC = () => {
  const f = useForm('stchg', KEYS);
  const [tab, setTab] = useMemory<string>('stchg:tab', 'clock');
  const [from, setFrom] = useMemory<Station>('stchg:from', 'Ahead');
  const [to, setTo] = useMemory<Station>('stchg:to', 'Astern');
  const [sides, setSides] = useMemory<'same' | 'opposite'>('stchg:sides', 'opposite');
  const n = (k: typeof KEYS[number]) => f.n(k);
  const gs = n('gs'), ss = n('ss'), ships = n('ships'), sp = n('sp'), cs = n('cs'), os = n('os'), pk = n('pk'), tm = n('tm'), ts = n('ts'), loss = n('loss');

  const sol = roundTheClock(from, to, sides);
  const per = to === 'Quarter' ? 4 : 2;
  const out = gs !== null && ss !== null && ss > gs ? angleOut(gs, ss, per) : null;
  const rev = ships !== null && sp !== null && cs !== null && ss !== null && pk !== null ? reverseOrder({ ships, spacing: sp, columnSpeed: cs, stationingSpeed: ss, orderedSpeed: os ?? 7, perKnot: pk }) : null;
  const secs = (tm ?? 0) * 60 + (ts ?? 0);
  const lost = gs !== null && secs > 0 && pk !== null ? distanceLost360({ guideSpeed: gs, turnSeconds: secs, speedLoss: loss ?? 0, perKnot: pk }) : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Station change">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border ${tab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>)}
      </div>

      {tab === 'clock' && (
        <>
          <Panel title="Change of station at standard distance" note="BR 45(6) para 0429: suggested solutions for a generic frigate or destroyer. Turning data and weather vary, so refine them in practice.">
            <Grid>
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span><select value={from} onChange={e => setFrom(e.target.value as Station)} className={pick}>{STATIONS.map(s => <option key={s}>{s}</option>)}</select></label>
              <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span><select value={to} onChange={e => setTo(e.target.value as Station)} className={pick}>{STATIONS.map(s => <option key={s}>{s}</option>)}</select></label>
            </Grid>
            {from === 'Abeam' && to === 'Abeam' && <Seg value={sides} onChange={v => setSides(v as 'same' | 'opposite')} options={[['opposite', 'To the other side'], ['same', 'Same side']]} />}
          </Panel>
          {sol ? (
            <>
              <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1.5">
                <p className="text-xs font-bold text-slate-700">{sol.speed} manoeuvre <span className="text-[10px] font-semibold text-blue-600">BR 45(6) para {sol.para}</span></p>
                {sol.text.map((t, i) => <p key={i} className="text-xs text-slate-600 font-medium leading-snug">{t}</p>)}
              </div>
              {sol.warning && <Warn>Serious risk of collision and danger to personnel if ships alter toward the Guide from standard distance on the beam, if initially ahead for bearing or inside for distance.</Warn>}
              {sol.speed === 'Stationing speed' && (from === 'Astern' && (to === 'Abeam' || to === 'Quarter')) && (
                <Panel title="Angle to steer out" note={`Rule of thumb: ${per} degrees for each knot of relative speed${to === 'Quarter' ? ' (astern to quarter)' : ' (astern to abeam)'}.`}>
                  <Grid><Field label="Guide's speed" unit="kn" units {...f.bind('gs')} /><Field label="Stationing speed" unit="kn" units {...f.bind('ss')} /></Grid>
                  {out !== null && <Result inline rows={[['Steer out about', `${out.toFixed(0)}°`]]} />}
                </Panel>
              )}
            </>
          ) : <p className="text-xs text-slate-500 font-medium">{from === to && from !== 'Abeam' ? 'Those are the same station.' : 'Para 0429 does not give a suggested solution for that change. Battenberg works out the course to steer for any change of station.'}</p>}
        </>
      )}

      {tab === 'reverse' && (
        <Panel title="Reverse the order of ships in column" note="BR 45(6) para 0428: the rear ship runs at one knot less than stationing speed past the others, who reduce to 7 knots (or the speed ordered). The time and the sea room needed ahead of the leader.">
          <Grid><Field label="Ships in the column" {...f.bind('ships')} /><Field label="Spacing" unit="yd" {...f.bind('sp')} /></Grid>
          <Grid><Field label="Column speed" unit="kn" units {...f.bind('cs')} /><Field label="Stationing speed" unit="kn" units {...f.bind('ss')} /></Grid>
          <Grid><Field label="Others reduce to (7 if blank)" unit="kn" units {...f.bind('os')} /><Field label="Gain/loss of speed" unit="yd/kn" {...f.bind('pk')} /></Grid>
          {rev && <Result inline rows={[
            ['Length of the column', `${Math.round(rev.lengthYards)} yd`],
            ['Time for the manoeuvre', `${rev.minutes.toFixed(1)} min`],
            ['Rear ship runs', `${rev.distanceNm.toFixed(2)} nm`],
            ['Sea room ahead of the leader', `${rev.seaRoomNm.toFixed(1)} nm (${rev.seaRoomNoMarginNm.toFixed(2)} nm + 25 % margin)`],
          ]} />}
          {ships !== null && sp !== null && cs !== null && ss !== null && pk !== null && !rev && <Warn>Needs at least two ships and a stationing speed well above the speed the others reduce to.</Warn>}
        </Panel>
      )}

      {tab === 'lose' && (
        <>
          <Panel title="Losing distance by a 360° turn" note="BR 45(6) para 0427c: a first approximation. The Guide steams on while you go round, and the speed lost in the turn costs the acceleration distance to recover. Build the table for your ship from her own turning data, and check it in practice.">
            <Grid><Field label="Guide's speed" unit="kn" units {...f.bind('gs')} /><Field label="Gain/loss of speed" unit="yd/kn" {...f.bind('pk')} /></Grid>
            <Grid><Field label="Time for the 360° turn" unit="min" {...f.bind('tm')} /><Field label="and" unit="sec" {...f.bind('ts')} /></Grid>
            <Field label="Speed lost in the turn" unit="kn" {...f.bind('loss')} />
            {lost !== null && <Result inline rows={[['Distance lost', `${Math.round(lost)} yd (${(lost / 200).toFixed(1)} cables)`]]} />}
          </Panel>
          <p className="text-[11px] text-slate-500 font-medium leading-snug">Other ways to lose distance (para 0427): reduce speed for a short distance, using the deceleration and acceleration distances per knot; or make a fishtail, turning out a set angle, steadying if needed, back twice that, then onto the original course. Fishtails recorded for the ship are in her Calibration Data.</p>
        </>
      )}
    </div>
  );
};
