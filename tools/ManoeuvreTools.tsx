import React from 'react';
import { Field, Grid, Panel, Result, Seg, SideToggle, bearing, useForm, useMemory } from './kit';
import { abreastTurn, angleForSeparation, columnTurn, distanceToRegain, lateralFeet, stopwatchSeconds, streamAllowance, surgeYards, throwOffToRegain, YD_PER_CABLE, yardsRun } from './manoeuvres';

// The tools of the Mathematics of Manoeuvres notes: Corpen (alter course in station), Regain Track and RAS Approach. The sums are in
// manoeuvres.ts. Distances are in cables or yards (200 yards a cable), speeds in knots.

const mmss = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60).toString().padStart(2, '0')} s`;
const norm = (d: number) => ((d % 360) + 360) % 360;

// ---- Corpen --------------------------------------------------------------------------------------------------------------------
const CF = ['kn', 'dc', 'adv', 'tr', 'tt', 'rg', 'rc', 'nt', 'ls'] as const;

export const CorpenTool: React.FC = () => {
  const f = useForm('corpen', CF);
  const [mode, setMode] = useMemory<'column' | 'abreast'>('corpen:mode', 'column');
  const [turnSide, setTurnSide] = useMemory<'Port' | 'Starboard'>('corpen:side', 'Starboard');
  const kn = f.n('kn'), dc = f.n('dc'), adv = f.n('adv'), tr = f.n('tr'), tt = f.n('tt'), rg = f.n('rg'), ls = f.n('ls');
  const ok = kn !== null && kn > 0;
  const stop = ok && dc !== null && dc > 0 ? stopwatchSeconds(dc * YD_PER_CABLE, kn!) : null;
  const col = mode === 'column' && ok && dc !== null && adv !== null && tt !== null ? columnTurn({ knots: kn!, distance: dc * YD_PER_CABLE, advance: adv, transfer: tr ?? adv, turnSeconds: tt, regainSeconds: rg ?? 0 }) : null;
  const abr = mode === 'abreast' && ok && dc !== null && tr !== null && tt !== null ? abreastTurn({ knots: kn!, range: dc * YD_PER_CABLE, transfer: tr, turnSeconds: tt, lossYards: ls ?? 0 }) : null;
  const t = col ?? abr;
  const bears = t ? 90 - Math.round(t.radian) : null;

  return (
    <div className="space-y-2">
      <Seg value={mode} onChange={v => setMode(v as 'column' | 'abreast')} options={[['column', 'Corpen (Guide ahead)'], ['abreast', "Corpen 'S' (abreast)"]]} />
      <Panel title="Station" note={mode === 'column' ? 'Own ship stationed astern of the Guide. The Guide alters course by Corpen; you follow to the same turning point, or turn early by the radian rule.' : 'Ships abreast. The Guide turns at once and the other ship continues ahead, then turns early so as to end abreast of the Guide.'}>
        <Grid><Field label="Speed" unit="kn" units {...f.bind('kn')} /><Field label={mode === 'column' ? 'Distance astern' : 'Distance abeam'} unit="cables" {...f.bind('dc')} /></Grid>
        <SideToggle label="Turning to" value={turnSide} onChange={setTurnSide} />
      </Panel>
      <Panel title="Own ship's turn (90°)" closed note="From the ship's turning data for a 90° turn. Transfer is taken as the advance if left blank. The time of the turn is how long she takes to complete it.">
        <Grid>{mode === 'column' && <Field label="Advance" unit="yd" {...f.bind('adv')} />}<Field label="Transfer" unit="yd" {...f.bind('tr')} /></Grid>
        <Grid><Field label="Time to turn" unit="s" {...f.bind('tt')} />{mode === 'column' ? <Field label="Time to regain speed" unit="s" {...f.bind('rg')} /> : <Field label="Distance lost in turn" unit="yd" {...f.bind('ls')} />}</Grid>
      </Panel>
      {stop !== null && mode === 'column' && (
        <Result rows={[
          ['Stopwatch', `alter ${mmss(stop)} after the Guide orders the wheel over`],
          ...(col ? [['Radian rule', `alter when the Guide bears ${bears}° off your bow on the ${turnSide.toLowerCase()} side (${col.radian.toFixed(1)}°; exact ${col.exact.toFixed(1)}°, so ${(90 - col.exact).toFixed(0)}°)`] as [string, string], ['Guide runs meanwhile', `${Math.round(col.guideRun)} yd`] as [string, string]] : []),
        ]} />
      )}
      {abr && <Result rows={[
        ['Guide draws ahead', `${Math.round(abr.netAhead)} yd (Guide runs ${Math.round(abr.guideRun)} yd in the turn)`],
        ['Radian rule', `alter when the Guide bears ${bears}° off your beam toward the bow (${abr.radian.toFixed(1)}°; exact ${abr.exact.toFixed(1)}°)`],
      ]} />}
      {mode === 'column' && !col && stop === null && <p className="text-[11px] text-slate-500 font-medium">Enter speed and distance for the stopwatch time, and the turn data for the radian-rule bearing.</p>}
      <Panel title="Other ways to judge it" closed note="True mark: when the Guide wheels, put a true mark on her blip on the PPI; she must keep coming toward own ship, and when her blip is at the centre, order the wheel. Follow the wake: trace the Guide's path with your bow in the middle of her wake and turn when the bow tends to leave it. The wake is clearer on the inner side (made by the bow) and diffuse on the outer side (made by the stern). Whichever you use, watch the Guide and check bearing and range." >
        <p className="text-[11px] text-slate-500 font-medium leading-snug">The radian rule is L = R x angle / 60. In a column, tan(angle) = advance / (transfer + (distance - Guide's run)).</p>
      </Panel>
    </div>
  );
};

// ---- Regain Track ----------------------------------------------------------------------------------------------------------------
const RF = ['kn', 'off', 'th', 'min', 'st', 'sk'] as const;
export const RegainTrackTool: React.FC = () => {
  const f = useForm('regain', RF);
  const kn = f.n('kn'), off = f.n('off'), th = f.n('th'), min = f.n('min'), st = f.n('st'), sk = f.n('sk');
  const ok = kn !== null && kn > 0 && off !== null && off >= 0;
  const dist = ok && th !== null && th > 0 ? distanceToRegain(off!, th) : null;                 // cables
  const runCables = ok && min !== null && min > 0 ? yardsRun(kn!, min * 60) / YD_PER_CABLE : null;
  const need = runCables !== null ? throwOffToRegain(off!, runCables) : null;
  const allow = st !== null && sk !== null ? streamAllowance(st, sk) : null;
  return (
    <div className="space-y-2">
      <Panel title="Off track" note="How far off the track you are, in cables, and your speed.">
        <Grid><Field label="Off track" unit="cables" {...f.bind('off')} /><Field label="Speed" unit="kn" units {...f.bind('kn')} /></Grid>
      </Panel>
      <Panel title="Time to regain, for a throw-off" note="Alter by a throw-off angle toward the track; the distance to run is off-track x 60 / angle.">
        <Field label="Throw-off angle" unit="°" {...f.bind('th')} />
        {dist !== null && <Result inline rows={[['Distance to regain track', `${dist.toFixed(1)} cables`], ['Time at this speed', mmss((dist * YD_PER_CABLE * 3600) / (kn! * 2000))]]} />}
      </Panel>
      <Panel title="Throw-off for a time to regain" note="Say how soon you want to be back on track.">
        <Field label="Regain track in" unit="min" {...f.bind('min')} />
        {need !== null && <Result inline rows={[['Distance run', `${runCables!.toFixed(1)} cables`], ['Throw-off needed', `${need.toFixed(1)}°`]]} />}
      </Panel>
      <Panel title="Holding the track in a stream" closed note="To stay on track with a stream across it, steer into the stream by an angle whose sine is stream speed / own speed.">
        <Grid><Field label="Stream rate" unit="kn" {...f.bind('st')} /><Field label="Own speed" unit="kn" {...f.bind('sk')} /></Grid>
        {allow !== null && <Result inline rows={[['Steer into the stream by', `${allow.toFixed(1)}°`]]} />}
        {st !== null && sk !== null && allow === null && <p className="text-[11px] text-amber-700 font-medium">The stream is as fast as the ship or faster: she cannot hold the track.</p>}
      </Panel>
    </div>
  );
};

// ---- RAS approach ----------------------------------------------------------------------------------------------------------------
const AF = ['brg', 'rc', 'sep', 'v1', 'v2', 'vs', 'ts', 'crs'] as const;
export const RasApproachTool: React.FC = () => {
  const f = useForm('rasapp', AF);
  const [side, setSide] = useMemory<'Port' | 'Starboard'>('rasapp:side', 'Port');
  const brg = f.n('brg'), rc = f.n('rc'), sep = f.n('sep') ?? 120, v1 = f.n('v1'), v2 = f.n('v2'), vs = f.n('vs'), ts = f.n('ts'), crs = f.n('crs');
  const theta = rc !== null && rc > 0 ? angleForSeparation(sep, rc) : null;
  const steer = theta !== null && brg !== null ? norm(brg + (side === 'Port' ? theta : -theta)) : null;
  const surge = v1 !== null && v2 !== null && vs !== null && ts !== null ? surgeYards(v1, v2, vs, ts) : null;
  const surgeC = surge !== null ? surge / YD_PER_CABLE : null;
  const theta2 = surgeC !== null && surgeC > 0 ? angleForSeparation(sep, surgeC) : null;
  return (
    <div className="space-y-2">
      <Panel title="Supplying ship's RAS point" note="Bearing and range of the RAS point from own ship (the receiving ship), and on which side the supplier will be.">
        <Grid><Field label="RAS point bearing" unit="°T" {...f.bind('brg')} /><Field label="Range" unit="cables" {...f.bind('rc')} /></Grid>
        <SideToggle label="Supplier to" value={side} onChange={setSide} />
        <Field label="Working separation" unit="ft" {...f.bind('sep')} hint="120 if blank" />
      </Panel>
      {theta !== null && <Result rows={[
        ['Angle for the separation', `${theta.toFixed(1)}° (L = R x angle x 10)`],
        ...(steer !== null ? [['Steer', `${bearing(steer)} for ${Math.round(sep)} ft abeam`] as [string, string]] : []),
        ...(rc !== null && brg !== null ? [['At this range, every degree off', `${(rc * 10).toFixed(0)} ft`] as [string, string]] : []),
      ]} />}
      <Panel title="When to come down in speed" closed note="While you slow from the approach speed to the supplier's speed you run further than she does (the surge). Start slowing that far short of the abeam station.">
        <Grid><Field label="Approach speed" unit="kn" units {...f.bind('v1')} /><Field label="Speed after" unit="kn" units {...f.bind('v2')} /></Grid>
        <Grid><Field label="Supplier's speed" unit="kn" units {...f.bind('vs')} /><Field label="Time to slow" unit="s" {...f.bind('ts')} /></Grid>
        <Field label="Own course (optional)" unit="°T" {...f.bind('crs')} />
        {surge !== null && <Result inline rows={[
          ['Surge', `${Math.round(surge)} yd (${(surgeC as number).toFixed(1)} cables)`],
          ...(theta2 !== null ? [['Come down in speed when the supplier bears', crs !== null ? `${bearing(norm(crs + (side === 'Port' ? -theta2 : theta2)))} (${theta2.toFixed(0)}° on the ${side.toLowerCase()} bow)` : `${theta2.toFixed(0)}° on the ${side.toLowerCase()} bow`] as [string, string]] : []),
        ]} />}
      </Panel>
    </div>
  );
};
