import React from 'react';
import { Field, Grid, Panel, Result, Seg, SideToggle, Warn, bearing, useForm, useMemory } from './kit';
import { abreastTurn, angleForSeparation, columnTurn, distanceToRegain, stopwatchSeconds, streamAllowance, throwOffToRegain, YD_PER_CABLE, yardsRun } from './manoeuvres';
import { EVOLUTIONS, decelRate, dimsOf, plan } from './rasApproach';
import type { Dims, Evolution } from './rasApproach';
import type { Ship } from '../types';

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
// The Guide (supplier) and the approach ship (receiver) are picked from the fleet; their bridge, RAS point and fuelling point positions and their
// breadths come from the ships' particulars (a figure typed in a box takes the place of the ship's). The sums are in rasApproach.ts.
const AF = ['brg', 'rc', 'gs', 'as', 'dr', 'sep', 'sb', 'gb', 'gr', 'gf', 'gw', 'ab', 'ar', 'af', 'aw'] as const;
const sideName = (d: number) => `${Math.round(Math.abs(d))}°`;
export const RasApproachTool: React.FC<{ ship?: Ship; fleet?: Ship[] }> = ({ ship, fleet }) => {
  const ships = fleet && fleet.length ? fleet : ship ? [ship] : [];
  const [evo, setEvo] = useMemory<Evolution>('rasapp:evo', 'RASAP');
  const [guideId, setGuideId] = useMemory<string>('rasapp:guide', '');
  const [apprId, setApprId] = useMemory<string>('rasapp:appr', '');
  const [side, setSide] = useMemory<'Port' | 'Starboard'>('rasapp:side', 'Port');
  const approach = ships.find(s => s.id === apprId) ?? ship ?? ships[0];
  const guide = ships.find(s => s.id === guideId && s.id !== approach?.id) ?? ships.find(s => s.id !== approach?.id);
  const gd = dimsOf(guide), ad = dimsOf(approach), rate = decelRate(approach);
  const str = (v: number | undefined) => (v === undefined ? undefined : String(Math.round(v * 10) / 10));
  const f = useForm('rasapp2', AF, { gb: str(gd.bridge), gr: str(gd.ras), gf: str(gd.fuel), gw: str(gd.breadth), ab: str(ad.bridge), ar: str(ad.ras), af: str(ad.fuel), aw: str(ad.breadth), dr: str(rate), sep: '120', sb: '400' });
  const brg = f.n('brg'), rc = f.n('rc'), gs = f.n('gs'), as = f.n('as'), dr = f.n('dr'), sep = f.n('sep') ?? 120, sb = f.n('sb') ?? 400;
  const guideDims: Dims = { bridge: f.n('gb') ?? undefined, ras: f.n('gr') ?? undefined, fuel: f.n('gf') ?? undefined, breadth: f.n('gw') ?? undefined };
  const apprDims: Dims = { bridge: f.n('ab') ?? undefined, ras: f.n('ar') ?? undefined, fuel: f.n('af') ?? undefined, breadth: f.n('aw') ?? undefined };
  const p = gs !== null && as !== null && dr !== null ? plan({ evolution: evo, guide: guideDims, approach: apprDims, guideSpeed: gs, approachSpeed: as, decelKnPerMin: dr, separationFt: sep, standbyYd: sb }) : null;
  const point = EVOLUTIONS[evo].pointName;
  // the course to steer on the approach: the Guide's point at a bearing and range from the approach ship's bridge, to pass at the final lateral distance
  const lateralFt = p && p.lateralYd > 0 ? p.lateralYd * 3 : sep;
  const theta = rc !== null && rc > 0 ? angleForSeparation(lateralFt, rc) : null;
  const steer = theta !== null && brg !== null ? norm(brg + (side === 'Port' ? theta : -theta)) : null;
  const sel = 'w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700';
  return (
    <div className="space-y-2">
      <Panel title="Evolution" note="What is matched at the final station: the two bridges, the two RAS points or the two fuelling points.">
        <Seg value={evo} onChange={v => setEvo(v as Evolution)} options={(Object.keys(EVOLUTIONS) as Evolution[]).map(k => [k, k] as const)} />
        <p className="text-[11px] font-semibold text-slate-500">{EVOLUTIONS[evo].label}</p>
      </Panel>
      <Panel title="The ships" note="The Guide supplies; the approach ship comes alongside. Their figures come from the ships' own data; type in a box to use another figure.">
        <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guide ship</span>
          <select value={guide?.id ?? ''} onChange={e => setGuideId(e.target.value)} className={sel}>{ships.filter(s => s.id !== approach?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approach ship</span>
          <select value={approach?.id ?? ''} onChange={e => setApprId(e.target.value)} className={sel}>{ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <p className="text-[10px] font-semibold text-slate-400">Metres from the stem. Guide</p>
        <Grid><Field label="Bridge" unit="m" {...f.bind('gb')} /><Field label="RAS point" unit="m" {...f.bind('gr')} /><Field label="Fuelling point" unit="m" {...f.bind('gf')} /><Field label="Breadth" unit="m" {...f.bind('gw')} /></Grid>
        <p className="text-[10px] font-semibold text-slate-400">Approach ship</p>
        <Grid><Field label="Bridge" unit="m" {...f.bind('ab')} /><Field label="RAS point" unit="m" {...f.bind('ar')} /><Field label="Fuelling point" unit="m" {...f.bind('af')} /><Field label="Breadth" unit="m" {...f.bind('aw')} /></Grid>
      </Panel>
      <Panel title="Speeds and slowing" note="The approach ship runs up at the approach speed and comes down to the Guide's. The deceleration rate comes from her latest deceleration run.">
        <Grid><Field label="Guide's speed" unit="kn" units {...f.bind('gs')} /><Field label="Approach speed" unit="kn" units {...f.bind('as')} /></Grid>
        <Grid><Field label="Deceleration rate" unit="kn/min" {...f.bind('dr')} /><Field label="Working separation" unit="ft" {...f.bind('sep')} /></Grid>
        <Field label="Stand-by station astern of the final station" unit="yd" {...f.bind('sb')} />
      </Panel>
      {p && p.missing.length > 0 && <Warn>Needs {p.missing.join(', ')}: enter it in the box above or in the ship's data.</Warn>}
      {p && p.missing.length === 0 && (
        <Result rows={[
          ['Speed advantage', `${p.advantage.toFixed(1)} kn`],
          ['Surge while slowing', `${Math.round(p.surgeYd)} yd (${(p.surgeYd / 200).toFixed(1)} cables) in ${(p.slowMinutes * 60).toFixed(0)} s`],
          ['Start slowing when the Guide\'s ' + point, `bears ${sideName(p.slowBearing)} on your ${side.toLowerCase()} bow from the bridge, at ${Math.round(p.slowRangeYd)} yd`],
          ['Then, at the final station', `${point}s abreast ${Math.round(p.lateralYd)} yd apart centre to centre; your stem ${Math.abs(p.stemOffsetM).toFixed(1)} m ${p.stemOffsetM >= 0 ? 'ahead of' : 'astern of'} hers`],
          ['From the stand-by station', p.atOnce ? 'slow at once: it is inside the surge' : `run ${Math.round(p.runYd)} yd (${p.runMinutes.toFixed(1)} min), slow, on station after ${p.totalMinutes.toFixed(1)} min`],
        ]} />
      )}
      {p === null && gs !== null && as !== null && as <= gs && <Warn>The approach ship needs a speed above the Guide's.</Warn>}
      <Panel title="Course to steer on the approach" closed note={`The bearing and range of the Guide's ${point} from your bridge now, and the side the Guide is on. The course leaves the final lateral distance between the ships' centre lines.`}>
        <Grid><Field label={`Bearing of her ${point}`} unit="°T" {...f.bind('brg')} /><Field label="Range" unit="cables" {...f.bind('rc')} /></Grid>
        <SideToggle label="Guide to your" value={side} onChange={setSide} />
        {theta !== null && <Result inline rows={[['Angle off for the separation', `${theta.toFixed(1)}° (L = R x angle x 10)`], ...(steer !== null ? [['Steer', bearing(steer)] as [string, string]] : [])]} />}
      </Panel>
    </div>
  );
};
