import React from 'react';
import { Ship } from '../types';
import * as nav from './navMath';
import { shipParams } from './shipParams';
import { OwnFormula } from './OwnFormula';
import { CABLE_M, CableType, SHACKLE_M, benignCable, cableRequired, circles, spacing } from './anchor';
import { Field, Grid, LengthField, Panel, Result, Seg, UnitPick, Warn, useForm, useMemory, useUnit } from './kit';

// Anchor: the cable to veer and the swinging circles, by the formulae in BR 45(1)(2) Chapter 14. The sums are in anchor.ts.

const FIELDS = ['depth', 'tide', 'veered', 'usable', 'len', 'stem', 'margin', 'len2', 'veered2'] as const;

const Rings: React.FC<{ rings: { r: number; label: string; color: string; dash?: boolean }[]; show: (m: number) => string }> = ({ rings, show }) => {
  const max = Math.max(...rings.map(x => x.r)), size = 300, c = size / 2, k = 128 / max;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Swinging circles about the anchor" className="w-full max-w-xs mx-auto bg-slate-50 rounded-2xl border border-slate-200">
      {[...rings].sort((a, b) => b.r - a.r).map(x => <circle key={x.label} cx={c} cy={c} r={x.r * k} fill="none" stroke={x.color} strokeWidth={1.6} strokeDasharray={x.dash ? '4 3' : undefined} />)}
      <circle cx={c} cy={c} r={3} fill="#0f172a" /><text x={c + 5} y={c + 12} fontSize={9} fill="#0f172a">anchor</text>
      {[...rings].sort((a, b) => b.r - a.r).map((x, i) => <text key={x.label} x={c} y={c - x.r * k - 3 + (i % 2 ? 0 : 0)} fontSize={8.5} fontWeight={700} textAnchor="middle" fill={x.color}>{x.label} {show(x.r)}</text>)}
    </svg>
  );
};

export const AnchorTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const [type, setType] = useMemory<CableType>('anchor:type', 'steel');
  const [depthUnit, setDepthUnit] = useUnit('anchor:depth', 'metres');
  const [unit, setUnit] = useUnit('anchor:unit', 'metres');
  // the selected ship's own figures, shown in the unit chosen; typing over one overrides it
  const sp = shipParams(ship);
  const inUnit = (m?: number) => (m === undefined ? undefined : String(Math.round(nav.convertLength(m, 'metres', unit) * 10) / 10));
  const f = useForm('anchor', FIELDS, { len: inUnit(sp.length), stem: inUnit(sp.stemToStandard), usable: sp.cableShackles === undefined ? undefined : String(sp.cableShackles) });
  const toM = (v: number | null) => (v === null ? null : nav.convertLength(v, unit, 'metres'));
  const show = (m: number) => nav.formatLength(nav.convertLength(m, 'metres', unit), unit);

  // cable to veer: the greatest depth expected is the charted depth plus the maximum height of tide
  const depth = f.n('depth'), tide = f.v.tide.trim() === '' ? 0 : f.n('tide');
  const total = depth !== null && tide !== null ? depth + tide : null;
  const byFathoms = depthUnit === 'fathoms';
  const need = total !== null && total > 0 ? (byFathoms ? cableRequired(total, 'fathoms', type) : cableRequired(nav.convertLength(total, depthUnit, 'metres'), 'metres', type)) : null;

  // swinging circles
  const len = toM(f.n('len')), stem = toM(f.n('stem')), usable = f.n('usable');
  const veered = f.v.veered.trim() === '' && need !== null ? Math.ceil(need) : f.n('veered');
  const margin = f.v.margin.trim() === '' ? CABLE_M : toM(f.n('margin'));
  const ok = len !== null && len > 0 && veered !== null && veered >= 0 && margin !== null;
  const c = ok ? circles({ shipLength: len!, stemToStandard: stem ?? 0, veeredShackles: veered!, maxUsableShackles: usable ?? veered!, safetyMargin: margin! }) : null;
  const len2 = toM(f.n('len2')), veered2 = f.n('veered2');
  const other = c && len2 !== null && len2 > 0 && veered2 !== null ? circles({ shipLength: len2, stemToStandard: 0, veeredShackles: veered2, maxUsableShackles: veered2, safetyMargin: margin! }) : null;
  const normal = other ? spacing(c!.normalMsr, other.normalMsr) : null, reduced = other ? spacing(c!.reducedMsr, other.reducedMsr) : null;

  return (
    <div className="space-y-2">
      <Panel title="Length of cable to veer" note="BR 45(1)(2) para 1411. Use the greatest depth expected while at anchor: the charted depth plus the maximum height of tide. The formulae are for a fine-hulled vessel in calm conditions with up to 5 kn of stream; in strong wind or stream more cable will be needed.">
        <Seg value={type} onChange={v => setType(v as CableType)} options={[['steel', 'Forged steel cable'], ['bronze', 'Aluminium bronze']]} />
        <LengthField label="Charted depth" unit={depthUnit} onUnit={setDepthUnit} {...f.bind('depth')} />
        <Field label="Maximum height of tide (optional)" unit={nav.LENGTH_UNITS[depthUnit].short} {...f.bind('tide')} />
        {need !== null && (
          <Result rows={[
            ['Cable to veer', `${need.toFixed(1)} shackles`],
            ['Rounded up', `${Math.ceil(need)} shackles (${Math.round(Math.ceil(need) * SHACKLE_M)} m)`],
            ['Formula', byFathoms ? (type === 'steel' ? '14.2: 2 √depth (fm)' : '14.3/14.4: √(1.3 depth (fm))') : (type === 'steel' ? '14.1: 1½ √depth (m)' : '14.3: √depth (m)')],
            ['In 15–20 kn wind, stream under 2 kn', `${benignCable(need).toFixed(1)} shackles (cut by 60%)`],
          ]} />
        )}
        {total !== null && total <= 0 && <Warn>Enter a depth above zero.</Warn>}
      </Panel>

      <Panel title="Swinging circles" note="BR 45(1)(2) paras 1410d, 1412 and 1415b. A shackle is 15 fathoms (27.4 m). Leave the cable veered blank to use the shackles required above, rounded up.">
        <UnitPick label="Lengths in" unit={unit} onChange={setUnit} />
        <Grid>
          <Field label="Length of ship" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('len')} />
          <Field label="Stem to standard compass" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('stem')} />
          <Field label="Cable veered" unit="shackles" hint={need !== null ? String(Math.ceil(need)) : undefined} {...f.bind('veered')} />
          <Field label="Cable available to veer" unit="shackles" hint="same as veered" {...f.bind('usable')} />
        </Grid>
        <Field label="Safety margin (blank is 1 cable)" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('margin')} />
        {c && (
          <>
            <Result rows={[
              ['Safety swinging circle', show(c.safety)],
              ['Bridge swinging circle', show(c.bridge)],
              ['Stern swinging circle', show(c.stern)],
              ['Minimum swinging radius, normal', show(c.normalMsr)],
              ['Minimum swinging radius, reduced', show(c.reducedMsr)],
            ]} />
            <Rings show={show} rings={[
              { r: c.safety, label: 'Safety', color: '#dc2626' },
              { r: c.normalMsr, label: 'Stern / Normal MSR', color: '#2563eb' },
              ...(c.bridge < c.normalMsr - 1 ? [{ r: c.bridge, label: 'Bridge', color: '#16a34a' }] : []),
              { r: c.reducedMsr, label: 'Reduced MSR', color: '#d97706', dash: true },
            ]} />
          </>
        )}
        {veered !== null && usable !== null && usable < veered && <Warn>The cable available to veer is less than the cable veered.</Warn>}
      </Panel>

      <Panel closed title="Distance from another ship (optional)" note="Para 1412. Double MSR: the two radii added, the least risk of fouling. Single MSR: the larger radius, which uses less room but there is more risk of fouling. Reduced MSR: if the cables of adjacent ships may foul, use a figure greater than 45 m or the normal MSR.">
        <Grid>
          <Field label="Other ship's length" unit={nav.LENGTH_UNITS[unit].short} {...f.bind('len2')} />
          <Field label="Other ship's cable veered" unit="shackles" {...f.bind('veered2')} />
        </Grid>
        {normal && reduced && (
          <Result rows={[
            ['Double normal MSR apart', show(normal.double)],
            ['Single normal MSR apart', show(normal.single)],
            ['Double reduced MSR apart', show(reduced.double)],
            ['Single reduced MSR apart', show(reduced.single)],
          ]} />
        )}
      </Panel>
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">An aid worked from the formulae of BR 45(1)(2) Chapter 14. The Safety Swinging Circle must be clear of the minimum LDL; the Bridge Swinging Circle is for the anchor watch, since a fix of the Bridge outside it means the ship is dragging.</p>
    <OwnFormula id="anchor" unitHint="m" vars={[{ name: 'depth', label: 'greatest depth (m)', value: total !== null ? nav.convertLength(total, depthUnit, 'metres') : null }, { name: 'need', label: 'cable required (shackles)', value: need }, { name: 'L', label: 'length of ship (m)', value: len }, { name: 'stem', label: 'stem to standard (m)', value: stem }, { name: 'veered', label: 'cable veered (shackles)', value: veered }, { name: 'avail', label: 'cable available (shackles)', value: usable }, { name: 'safety', label: 'safety circle (m)', value: c ? c.safety : null }, { name: 'bridge', label: 'bridge circle (m)', value: c ? c.bridge : null }, { name: 'stern', label: 'stern circle (m)', value: c ? c.stern : null }]} />
    </div>
  );
};
