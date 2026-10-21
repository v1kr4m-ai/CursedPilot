import React from 'react';
import { Field, Grid, Panel, Result, Seg, Warn, bearing, useForm, useMemory } from './kit';
import { approach, closeFaster, contactFromPlots, passAt, pos, vec } from './relvel';
import type { Obs } from './relvel';

// Relative Motion: the REL-VEL docket's problems solved without a plot: the other ship's course and speed from her plotted track, when she
// is a given range off, passing her at a distance, and getting as close as possible to a faster ship. The sums are in relvel.ts. Ranges in n miles.

const MODES = [['plots', 'Her course from a plot'], ['range', 'When at a range'], ['pass', 'Pass at a distance'], ['faster', 'Close a faster ship']] as const;
const KEYS = ['oc', 'os', 'brg', 'rng', 'tc', 'ts', 'rg', 'vis', 'pd', 'm0', 'b0', 'r0', 'm1', 'b1', 'r1', 'm2', 'b2', 'r2', 'm3', 'b3', 'r3', 'm4', 'b4', 'r4'] as const;
const minStr = (m: number) => `${m.toFixed(1)} min`;
const clock = (m: number) => (m < 120 ? minStr(m) : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);

export const RelMotionTool: React.FC = () => {
  const f = useForm('relmo', KEYS);
  const [mode, setMode] = useMemory<string>('relmo:mode', 'plots');
  const n = (k: typeof KEYS[number]) => f.n(k);
  const oc = n('oc'), os = n('os'), brg = n('brg'), rng = n('rng'), tc = n('tc'), ts = n('ts'), rg = n('rg'), vis = n('vis'), pd = n('pd');
  const own = oc !== null && os !== null && os >= 0;
  const target = brg !== null && rng !== null && rng > 0 && tc !== null && ts !== null && ts >= 0;
  const p0 = brg !== null && rng !== null ? pos(brg, rng) : null;

  const obs: Obs[] = [0, 1, 2, 3, 4].map(i => { const m = n(`m${i}` as 'm0'), b = n(`b${i}` as 'b0'), r = n(`r${i}` as 'r0'); return m !== null && b !== null && r !== null && r > 0 ? { minutes: m, bearing: b, range: r } : null; }).filter((o): o is Obs => o !== null);
  const contact = mode === 'plots' && own ? contactFromPlots(oc!, os!, obs) : null;
  const contactRange = contact && rg !== null && rg > 0 ? approach(pos(obs[obs.length - 1].bearing, obs[obs.length - 1].range), contact.rel, rg) : null;

  const rel = target && own ? { x: vec(tc!, ts!).x - vec(oc!, os!).x, y: vec(tc!, ts!).y - vec(oc!, os!).y } : null;
  const ap = mode === 'range' && rel && p0 ? approach(p0, rel, rg ?? undefined) : null;
  const sightEv = mode === 'range' && rel && p0 && vis !== null && vis > 0 ? approach(p0, rel, vis) : null;
  const passes = mode === 'pass' && p0 && tc !== null && ts !== null && os !== null && pd !== null && pd > 0 ? passAt(p0, tc, ts, os, pd) : [];
  const faster = mode === 'faster' && p0 && tc !== null && ts !== null && os !== null && os > 0 ? closeFaster(p0, tc, ts, os) : null;

  const targetFields = (
    <Panel title="The other ship" note="Her bearing and range from you, and her true course and speed.">
      <Grid><Field label="Bearing" unit="°T" {...f.bind('brg')} /><Field label="Range" unit="nm" {...f.bind('rng')} /></Grid>
      <Grid><Field label="Her course" unit="°T" {...f.bind('tc')} /><Field label="Her speed" unit="kn" {...f.bind('ts')} /></Grid>
    </Panel>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Problem">
        {MODES.map(([k, label]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border ${mode === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>)}
      </div>
      <Panel title="Own ship" note={mode === 'pass' || mode === 'faster' ? 'The speed you have available. Own course is the answer.' : 'Own true course and speed.'}>
        <Grid>{mode !== 'pass' && mode !== 'faster' && <Field label="Own course" unit="°T" sensor="course" {...f.bind('oc')} />}<Field label={mode === 'pass' || mode === 'faster' ? 'Available speed' : 'Own speed'} unit="kn" sensor="speed" {...f.bind('os')} /></Grid>
      </Panel>

      {mode === 'plots' && (
        <>
          <Panel title="Plotted positions" note="Time (minutes from the first), bearing and range of the other ship. Two or more; more points average out the plotting error.">
            {[0, 1, 2, 3, 4].map(i => <Grid key={i}><Field label={`Time ${i + 1}`} unit="min" {...f.bind(`m${i}` as 'm0')} /><Field label="Bearing" unit="°T" {...f.bind(`b${i}` as 'b0')} /><Field label="Range" unit="nm" {...f.bind(`r${i}` as 'r0')} /></Grid>)}
          </Panel>
          {contact && <Result rows={[['Her course and speed', `${bearing(contact.course)} at ${contact.speed.toFixed(1)} kn`], ['Relative track', `${bearing(contact.relCourse)} at ${contact.relSpeed.toFixed(1)} kn`]]} />}
          {own && obs.length >= 2 && !contact && <Warn>The times must differ.</Warn>}
          {contact && <Field label="When will she be this far off? Range" unit="nm" {...f.bind('rg')} />}
          {contactRange && <Result inline rows={contactRange.events.length ? contactRange.events.map((e, i): [string, string] => [i ? 'And leaves that range after' : 'At that range after the last plot', `${clock(e.minutes)}, bearing ${bearing(e.bearing)}`]) : [['She does not come that close', `closest ${contactRange.cpa.toFixed(1)} nm`]]} />}
        </>
      )}

      {mode !== 'plots' && targetFields}

      {mode === 'range' && (
        <Panel title="When" note="The time she is a given range off, and when she will be sighted.">
          <Grid><Field label="Range of interest" unit="nm" {...f.bind('rg')} /><Field label="Visibility" unit="nm" {...f.bind('vis')} /></Grid>
          {ap && <Result inline rows={[
            ...ap.events.slice(0, 2).map((e, i): [string, string] => [i ? 'Leaves that range after' : 'At that range after', `${clock(e.minutes)}, bearing ${bearing(e.bearing)}`]),
            ...(rg !== null && rg > 0 && ap.events.length === 0 ? [['That range is not reached', `closest ${ap.cpa.toFixed(1)} nm`] as [string, string]] : []),
            ['Closest approach', `${ap.cpa.toFixed(2)} nm after ${clock(ap.cpaMinutes)}, bearing ${bearing(ap.cpaBearing)}`],
            ...(sightEv && sightEv.events[0] ? [['Sighted after', `${clock(sightEv.events[0].minutes)}, bearing ${bearing(sightEv.events[0].bearing)}`] as [string, string]] : []),
          ]} />}
        </Panel>
      )}

      {mode === 'pass' && (
        <Panel title="Pass at a distance" note="Keep outside this distance. The tool gives the course to pass ahead of her and the course to pass astern.">
          <Field label="Pass outside" unit="nm" {...f.bind('pd')} />
          {passes.length > 0 && <Result rows={passes.map((p): [string, string] => [`Pass ${p.side}`, `steer ${bearing(p.course)}; closest after ${clock(p.minutes)}, she bears ${bearing(p.bearing)}`])} />}
          {p0 && pd !== null && pd > 0 && rng !== null && pd >= rng && <Warn>She is already inside that distance.</Warn>}
          {p0 && pd !== null && pd > 0 && rng !== null && pd < rng && tc !== null && ts !== null && os !== null && passes.length === 0 && <Warn>With {os} kn no course keeps outside {pd} nm.</Warn>}
        </Panel>
      )}

      {mode === 'faster' && faster && (
        <Result rows={[
          ['Steer', bearing(faster.course)],
          ['Closest approach', `${faster.cpa.toFixed(2)} nm after ${clock(faster.minutes)}`],
          ['She bears then', bearing(faster.bearing)],
          ...(faster.cpa < 0.05 ? [['This speed is enough to close her fully', 'on a steady bearing'] as [string, string]] : []),
        ]} />
      )}
      {mode === 'faster' && p0 && os !== null && os > 0 && target && !faster && <Warn>She is opening on every course.</Warn>}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Worked as the REL-VEL docket's relative velocity triangle, by calculation instead of a plot: the answers agree with the docket to within plotting accuracy. Distances in n miles.</p>
    </div>
  );
};
