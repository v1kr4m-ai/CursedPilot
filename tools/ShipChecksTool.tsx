import React from 'react';
import { Field, Grid, Panel, Result, Seg, SideToggle, bearing, useForm, useMemory } from './kit';
import { correctedSpeed, echoError, groundSpeed, jackstaffReads, logCorrection, radarBearingError, rangeIndexError, soundingReportStep, toeInAngle, twoMarkIndexError } from './shipChecks';

// Ship Checks: the calibrations and checks of Handbook on Navigation chapter 8: radar range and bearing error, the speed log
// (BR 45(3) para 0427), the lubber's line of a repeater, and the echo sounder. The sums are in shipChecks.ts.

const FIELDS = ['tr', 'rr', 'cd', 'm1', 'm2', 'rb', 'ob', 'dist', 't1', 'l1', 't2', 'l2', 't3', 'l3', 't4', 'l4', 'rd', 'off', 'ahead', 'head', 'lead', 'echo', 'depth'] as const;
const sgn = (v: number, d = 2) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

export const ShipChecksTool: React.FC = () => {
  const f = useForm('shipchecks', FIELDS);
  const [runsN, setRunsN] = useMemory<'2' | '4'>('shipchecks:runs', '2');
  const [side, setSide] = useMemory<'Port' | 'Starboard'>('shipchecks:side', 'Port');
  const n = (k: typeof FIELDS[number]) => f.n(k);

  const tr = n('tr'), rr = n('rr'), cd = n('cd'), m1 = n('m1'), m2 = n('m2'), rb = n('rb'), ob = n('ob');
  const dist = n('dist') ?? 1, count = Number(runsN);
  const runs = Array.from({ length: count }, (_, i) => { const t = n(`t${i + 1}` as 't1'), l = n(`l${i + 1}` as 'l1'); return t !== null && t > 0 && l !== null && l > 0 ? { ground: groundSpeed(dist, t), log: l } : null; });
  const log = runs.every(r => r) && dist > 0 ? logCorrection(runs as { ground: number; log: number }[]) : null;
  const reading = n('rd');
  const off = n('off'), ahead = n('ahead'), head = n('head');
  const e = off !== null && ahead !== null && ahead > 0 ? toeInAngle(off, ahead) : null;
  const lead = n('lead'), echo = n('echo'), depth = n('depth');

  return (
    <div className="space-y-2">
      <Panel title="Radar range index error" note="Alongside, compare the charted and radar range of a conspicuous object. Add the error to radar ranges to get true ranges.">
        <Grid><Field label="True (charted) range" unit="nm" {...f.bind('tr')} /><Field label="Radar range" unit="nm" {...f.bind('rr')} /></Grid>
        {tr !== null && rr !== null && <Result inline rows={[['Index error', `${sgn(rangeIndexError(tr, rr), 3)} nm`]]} />}
        <p className="text-[10px] font-semibold text-slate-400">Two-mark method: passing between two objects, measure both ranges.</p>
        <Grid><Field label="Charted distance between" unit="nm" {...f.bind('cd')} /><Field label="Radar range 1" unit="nm" {...f.bind('m1')} /></Grid>
        <Field label="Radar range 2" unit="nm" {...f.bind('m2')} />
        {cd !== null && m1 !== null && m2 !== null && <Result inline rows={[['Index error (half the difference)', `${sgn(twoMarkIndexError(cd, m1, m2), 3)} nm`]]} />}
      </Panel>

      <Panel title="Radar bearing error" closed note="Take the visual and radar bearing of an object seen well by both. Allow for gyro error first.">
        <Grid><Field label="Visual bearing" unit="°" {...f.bind('rb')} /><Field label="Radar bearing" unit="°" {...f.bind('ob')} /></Grid>
        {rb !== null && ob !== null && <Result inline rows={[['Bearing error', `${sgn(radarBearingError(rb, ob), 1)}°`], ['Adjust radar bearings by', `${sgn(radarBearingError(rb, ob), 1)}°`]]} />}
      </Panel>

      <Panel title="Speed log calibration" note="Runs over a measured distance, at constant revolutions. Two runs when the stream is steady or nil; four runs (two each way) when it is changing. Give each run's time and the mean log speed.">
        <Seg value={runsN} onChange={v => setRunsN(v as '2' | '4')} options={[['2', 'Two runs'], ['4', 'Four runs']]} />
        <Field label="Measured distance (1 if blank)" unit="nm" {...f.bind('dist')} />
        {Array.from({ length: count }, (_, i) => (
          <Grid key={i}><Field label={`Run ${i + 1} time`} unit="s" {...f.bind(`t${i + 1}` as 't1')} /><Field label={`Run ${i + 1} log speed`} unit="kn" {...f.bind(`l${i + 1}` as 'l1')} /></Grid>
        ))}
        {runs.some(r => r) && <p className="text-[10px] font-semibold text-slate-400">Ground speeds: {runs.map((r, i) => r ? `run ${i + 1} ${r.ground.toFixed(2)} kn` : null).filter(Boolean).join(', ')}</p>}
        {log && (
          <>
            <Result inline rows={[
              ['Percentage speed log correction', `${sgn(log.percent, 1)} %`],
              ['Log error (log less ground)', `${sgn(log.errorKn, 2)} kn · ${sgn(log.errorPercent, 1)} % of log speed`],
              ['Mean ground · mean log', `${log.meanGround.toFixed(2)} · ${log.meanLog.toFixed(2)} kn`],
            ]} />
            <p className="text-[11px] text-slate-500 font-medium leading-snug">{log.percent >= 0 ? 'Increase' : 'Reduce'} the log by {Math.abs(log.percent).toFixed(1)} % to read true water speed. The correction is always a percentage of the log (water) speed. It should be good to about ±1 %.</p>
            <Field label="Log reading to correct" unit="kn" {...f.bind('rd')} />
            {reading !== null && <Result inline rows={[['True water speed', `${correctedSpeed(reading, log.percent).toFixed(2)} kn`]]} />}
          </>
        )}
        <p className="text-[10px] text-slate-400 font-medium leading-snug">Calibrate at 6, 12, 18, 24 kn and so on through the speed range, in calm weather and little swell, rudder used sparingly, settled on course for 5 minutes first. Note the log every 15 s (every 10 s above 20 kn).</p>
      </Panel>

      <Panel title="Lubber's line of a repeater" closed note="A wing repeater off the centre line is toed in so that it points at the Jackstaff. The Jackstaff should read the ship's head plus the toe-in angle (port side) or minus it (starboard side).">
        <SideToggle label="Repeater on the" value={side} onChange={setSide} />
        <Grid><Field label="Offset from centre line" unit="m" {...f.bind('off')} /><Field label="Distance to Jackstaff, fore and aft" unit="m" {...f.bind('ahead')} /></Grid>
        <Field label="Ship's head (optional)" unit="°" {...f.bind('head')} />
        {e !== null && <Result inline rows={[['Toe-in angle', `${e.toFixed(2)}°`], ...(head !== null ? [['Jackstaff should read', bearing(jackstaffReads(head, e, side))] as [string, string]] : [])]} />}
      </Panel>

      <Panel title="Echo sounder" closed note="Compare against the hand lead line, preferably before leaving harbour. Give both to the same datum.">
        <Grid><Field label="Lead line depth" unit="m" {...f.bind('lead')} /><Field label="Echo sounder depth" unit="m" {...f.bind('echo')} /></Grid>
        {lead !== null && echo !== null && <Result inline rows={[['Error (lead less echo)', `${sgn(echoError(lead, echo), 2)} m`]]} />}
        <Field label="Depth being sounded" unit="m" {...f.bind('depth')} />
        {depth !== null && depth >= 0 && <Result inline rows={[['Report every', `${soundingReportStep(depth)} m change, and at least once a minute`]]} />}
        <p className="text-[10px] text-slate-400 font-medium leading-snug">Calibrate on each entry to dry dock, annually, after refit or repair, when in doubt, and preferably before every cast-off. The report is suffixed Steady, Deepening, Shoaling or Below Minimum Depth.</p>
      </Panel>
    </div>
  );
};
