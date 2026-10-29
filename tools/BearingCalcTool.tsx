import React from 'react';
import * as nav from './navMath';
import { Field, Grid, LengthField, Panel, Result, Seg, Warn, bearing, fromNm, useForm, useMemory, useUnit } from './kit';
import { trackTable } from './trackBearing';

// Bearing Calculator: an object on a steady course, its bearing and range every 5 cables or 1 nm along the track, from the bearing and range at the start (or at the end).

const STEPS = [['cables', '5 cables'], ['mile', '1 nm']] as const;
const STEP_NM = { cables: 0.5, mile: 1 };
const brg1 = (d: number) => `${nav.norm360(d).toFixed(1).padStart(5, '0')}°`;

export const BearingCalcTool: React.FC = () => {
  const f = useForm('trackbrg', ['brg', 'course', 'range', 'count'] as const, { count: '10' });
  const [unit, setUnit] = useUnit('trackbrg:range');
  const [known, setKnown] = useMemory<'initial' | 'final'>('trackbrg:known', 'initial');
  const [step, setStep] = useMemory<'cables' | 'mile'>('trackbrg:step', 'cables');
  const range = f.n('range');
  const t = f.n('brg') !== null && f.n('course') !== null && range !== null && f.n('count') !== null
    ? trackTable({ bearing: f.n('brg')!, course: f.n('course')!, range: nav.convertLength(range, unit, 'nm'), known, step: STEP_NM[step], count: f.n('count')! })
    : null;
  const filled = [f.n('brg'), f.n('course'), range].every(v => v !== null);
  const label = known === 'initial' ? 'Run from the start' : 'Run still to go';
  return (
    <div className="space-y-2">
      <Panel title="Bearing and range along a track" note="An object on a steady course, seen from a fixed point (for a moving ship use the relative track from the Relative Motion tool). Give its bearing and range at one point of the track and its course: the table gives its bearing and range at each interval along the track.">
        <Seg value={known} options={[['initial', 'Initial range'], ['final', 'Final range']] as const} onChange={v => setKnown(v as 'initial' | 'final')} />
        <Grid>
          <Field label={known === 'initial' ? 'Bearing at the start' : 'Bearing at the end'} unit="°T" {...f.bind('brg')} />
          <Field label="Course of the object" unit="°T" {...f.bind('course')} />
        </Grid>
        <LengthField label={known === 'initial' ? 'Initial range' : 'Final range'} unit={unit} onUnit={setUnit} {...f.bind('range')} />
        <Seg value={step} options={STEPS} onChange={v => setStep(v as 'cables' | 'mile')} />
        <Field label="Number of intervals" {...f.bind('count')} />
        {t && <Result rows={[['Closest approach', `${fromNm(t.cpa.range, unit)} on ${brg1(t.cpa.bearing)}`], ['', t.cpa.fromKnown > 1e-9 ? `${fromNm(t.cpa.fromKnown, unit)} further on` : t.cpa.fromKnown < -1e-9 ? `${fromNm(-t.cpa.fromKnown, unit)} back along the track` : 'at the given point']]} />}
        {filled && !t && <Warn>Needs a range above zero and at least one interval.</Warn>}
        {t && (
          <table className="w-full text-xs font-bold text-slate-700 tabular-nums">
            <thead><tr className="text-[9px] uppercase tracking-wider text-slate-400 text-right"><th className="text-left py-1">{label}</th><th>Bearing</th><th>Range</th></tr></thead>
            <tbody>
              {t.rows.map(r => (
                <tr key={r.run} className={`text-right border-t border-slate-100 ${r.isKnown ? 'bg-blue-50 text-blue-700' : ''}`}>
                  <td className="text-left py-1">{fromNm(known === 'initial' ? r.run : t.rows[t.rows.length - 1].run - r.run, unit)}</td>
                  <td>{brg1(r.bearing)}</td>
                  <td>{fromNm(r.range, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
};
