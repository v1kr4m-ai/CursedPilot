import React from 'react';
import { Ship } from '../types';
import * as nav from './navMath';
import { evaluate } from './expr';
import { HORIZON_SETS, correctedAngle, correctedElevation, dippingRange, distanceBeyondHorizon, distanceByHeight, distanceByHorizon, distanceByWidth, dipMinutes, horizon } from './rangeFormulas';
import { Card, Field, Grid, LengthField, Result, SELECT, Seg, UnitPick, Warn, fromNm, useForm, useMemory, useUnit } from './kit';
import { shipParams } from './shipParams';

// Distance Off & Horizon as two cards: VSA (range from a sextant angle, by the method of the book the user works from,
// or their own formula) and Horizon and visibility. The BR 45(1)(1) formulae are in rangeFormulas.ts.

type Method = 'height' | 'width' | 'beyond' | 'horizon' | 'own';
const METHODS: [Method, string][] = [
  ['height', 'Height of object, base visible (BR 45 8.1)'],
  ['width', 'Width of object (BR 45 8.1a)'],
  ['beyond', 'Object beyond the horizon (BR 45 App 6, A6.1)'],
  ['horizon', 'Horizon method, no height (BR 45 8.3)'],
  ['own', 'My own formula'],
];

const VSA_FIELDS = ['elev', 'tide', 'width', 'angle', 'ie', 'eye', 'summit', 'expr'] as const;

const VsaCard: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const sp = shipParams(ship);
  const f = useForm('vsa2', VSA_FIELDS, { eye: sp.heightOfEye === undefined ? undefined : String(Math.round(sp.heightOfEye * 10) / 10) });
  const [method, setMethod] = useMemory<Method>('vsa:method', 'height');
  const [hUnit, setHUnit] = useUnit('vsa:height', nav.DEFAULT_HEIGHT_UNIT);
  const [wUnit, setWUnit] = useUnit('vsa:width', nav.DEFAULT_HEIGHT_UNIT);
  const [sUnit, setSUnit] = useUnit('vsa:summit', nav.DEFAULT_HEIGHT_UNIT);
  const [dUnit, setDUnit] = useUnit('vsa:dist');
  const [ownUnit, setOwnUnit] = useMemory<'metres' | 'nm'>('vsa:ownunit', 'metres');
  const toM = (v: number | null, u: nav.LengthUnit) => (v === null ? null : nav.convertLength(v, u, 'metres'));
  const obs = nav.parseAngle(f.v.angle), ie = f.v.ie.trim() === '' ? 0 : f.n('ie'), eye = f.n('eye');
  const tide = f.v.tide.trim() === '' ? 0 : f.n('tide');
  const elevM = toM(f.n('elev'), hUnit), widthM = toM(f.n('width'), wUnit), summitM = toM(f.n('summit'), sUnit);
  const ang = obs !== null && ie !== null ? correctedAngle(obs, ie) : null;
  const dm = (deg: number) => { const a = Math.abs(deg), d = Math.floor(a), m = (a - d) * 60; return `${deg < 0 ? '−' : ''}${d}° ${m.toFixed(1)}'`; };

  let rows: [string, string][] = [], warn: string | null = null;
  if (ang !== null && obs !== null) {
    if (method === 'height' && elevM !== null && tide !== null && elevM > 0) {
      const el = correctedElevation(elevM, tide), d = distanceByHeight(el, ang);
      if (Number.isFinite(d)) rows = [['Distance off', fromNm(d, dUnit)], ['Corrected angle', dm(ang)], ['Elevation used', `${el.toFixed(2)} m`]];
    } else if (method === 'width' && widthM !== null && widthM > 0) {
      const d = distanceByWidth(widthM, ang);
      if (Number.isFinite(d)) rows = [['Distance off', fromNm(d, dUnit)], ['Corrected angle', dm(ang)]];
    } else if (method === 'beyond' && summitM !== null && eye !== null && eye >= 0) {
      const b = distanceBeyondHorizon(summitM, eye, obs, ie ?? 0);
      if (b) rows = [['Distance off', fromNm(b.distanceNm, dUnit)], ['Apparent altitude', dm(b.apparentDeg)], ['Refraction', `${b.refractionMin.toFixed(1)}′`], ['True altitude', dm(b.trueDeg)]];
      else warn = 'These values give no distance. The summit must be higher than the eye, and the angle must be measured from the sea horizon.';
    } else if (method === 'horizon' && eye !== null && eye > 0) {
      const b = distanceByHorizon(eye, obs, ie ?? 0);
      if (b) rows = [['Distance off', fromNm(b.distanceNm, dUnit)], ['Angle below the horizontal', `${b.thetaMin.toFixed(1)}′`], ['Dip', `${dipMinutes(eye).toFixed(1)}′`]];
      else warn = 'The angle is too small for the height of eye: the object would be beyond the horizon.';
    } else if (method === 'own') {
      const r = evaluate(f.v.expr, { H: elevM ?? 0, W: widthM ?? 0, A: ang, h: eye ?? 0, a: obs, ie: ie ?? 0 });
      if ('value' in r) rows = [['Distance off', ownUnit === 'nm' ? fromNm(r.value, dUnit) : fromNm(r.value / 1852, dUnit)], ['Corrected angle', dm(ang)]];
      else warn = r.error;
    }
  }
  const sel = method;

  return (
    <Card title="VSA: distance off by sextant angle" note="Pick the method of the book you use. The corrected angle is the observed angle plus the index error (plus to add, minus to take off).">
      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</span>
        <select value={method} onChange={e => setMethod(e.target.value as Method)} className={`${SELECT} w-full`}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      {(sel === 'height' || sel === 'own') && <LengthField label="Height of object (elevation above MHWS)" unit={hUnit} onUnit={setHUnit} {...f.bind('elev')} />}
      {sel === 'height' && <Field label="Tide below MHWS (minus if above)" unit="m" {...f.bind('tide')} />}
      {(sel === 'width' || sel === 'own') && <LengthField label="Width of object" unit={wUnit} onUnit={setWUnit} {...f.bind('width')} />}
      {sel === 'beyond' && <LengthField label="Height of the summit" unit={sUnit} onUnit={setSUnit} {...f.bind('summit')} />}
      {(sel === 'beyond' || sel === 'horizon' || sel === 'own') && <Field label="Height of eye" unit="m" {...f.bind('eye')} />}
      <Grid>
        <Field label={sel === 'horizon' ? 'Angle below the horizon' : 'Observed angle'} unit="° ′" kind="angle" invalid={f.v.angle.trim() !== '' && obs === null} {...f.bind('angle')} />
        <Field label="Index error" unit="′" {...f.bind('ie')} />
      </Grid>
      {sel === 'own' && (
        <div className="space-y-2">
          <Field label="Formula" text hint="H / tan(A)" {...f.bind('expr')} />
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Names: H height of object (m), W width (m), A corrected angle, a observed angle, ie index error (′), h height of eye (m). Angles are in degrees. Use + − * / ^ ( ), sqrt( ), sin( ), cos( ), tan( ), cot( ), asin( ), acos( ), atan( ), ln( ), log( ), exp( ), pi.</p>
          <Seg value={ownUnit} onChange={v => setOwnUnit(v as 'metres' | 'nm')} options={[['metres', 'Formula gives metres'], ['nm', 'Formula gives n miles']]} />
        </div>
      )}
      <UnitPick label="Distance off in" unit={dUnit} onChange={setDUnit} />
      {rows.length > 0 && <Result rows={rows} />}
      {warn && <Warn>{warn}</Warn>}
      {sel === 'beyond' && <p className="text-[10px] text-amber-600 font-medium leading-relaxed">Long-range and approximate: abnormal refraction spoils it, and it should not be used on a peak that is part of a chain unless it is positively identified (BR 45 App 6).</p>}
      {sel === 'height' && <p className="text-[10px] text-slate-400 font-medium leading-relaxed">The charted elevation of a light is to the centre of the lens, above MHWS or MHHW. Without the tide correction the range comes out less than the true one, which is on the safe side.</p>}
    </Card>
  );
};

const HorizonCard: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const sp = shipParams(ship);
  const f = useForm('horizon', ['eye', 'obj', 'cv', 'cr'] as const, { eye: sp.heightOfEye === undefined ? undefined : String(Math.round(sp.heightOfEye * 10) / 10) });
  const [set, setSet] = useMemory<string>('horizon:set', 'br45');
  const [hUnit, setHUnit] = useUnit('horizon:height', nav.DEFAULT_HEIGHT_UNIT);
  const [dUnit, setDUnit] = useUnit('horizon:dist');
  const own = set === 'own';
  const coef = own ? { visual: f.n('cv'), radar: f.n('cr') } : { visual: HORIZON_SETS[set]?.visual ?? 2.08, radar: HORIZON_SETS[set]?.radar ?? 2.23 };
  const eye = f.n('eye'), obj = f.n('obj');
  const eyeM = eye === null ? null : nav.convertLength(eye, hUnit, 'metres'), objM = obj === null ? null : nav.convertLength(obj, hUnit, 'metres');
  const rows: [string, string][] = [];
  if (eyeM !== null && eyeM >= 0) {
    if (coef.visual !== null) rows.push(['Visual horizon', fromNm(horizon(eyeM, coef.visual), dUnit)]);
    if (coef.radar !== null) rows.push(['Radar horizon', fromNm(horizon(eyeM, coef.radar), dUnit)]);
    if (objM !== null && objM >= 0) {
      if (coef.visual !== null) rows.push(['Object first seen at (rising or dipping range)', fromNm(dippingRange(eyeM, objM, coef.visual), dUnit)]);
      if (coef.radar !== null) rows.push(['Object on radar at', fromNm(dippingRange(eyeM, objM, coef.radar), dUnit)]);
    }
  }
  return (
    <Card title="Horizon and visibility" note="Distance in nautical miles = coefficient x the square root of the height in metres. Choose the book whose figures you use, or enter your own coefficients.">
      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Formula</span>
        <select value={set} onChange={e => setSet(e.target.value)} className={`${SELECT} w-full`}>
          {Object.entries(HORIZON_SETS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          <option value="own">My own coefficients</option>
        </select>
      </label>
      {own && <Grid><Field label="Visual coefficient" {...f.bind('cv')} /><Field label="Radar coefficient" {...f.bind('cr')} /></Grid>}
      <UnitPick label="Heights in" unit={hUnit} onChange={setHUnit} />
      <Grid>
        <Field label="Height of eye / antenna" unit={nav.LENGTH_UNITS[hUnit].short} {...f.bind('eye')} />
        <Field label="Object height (optional)" unit={nav.LENGTH_UNITS[hUnit].short} {...f.bind('obj')} />
      </Grid>
      <UnitPick label="Ranges in" unit={dUnit} onChange={setDUnit} />
      {rows.length > 0 && <Result rows={rows} />}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">BR 45 allows about 8% for refraction in the optical horizon (2.08) and more for the radar horizon (2.23). Super-refraction can add 15% to 20% to radar ranges. Heights are above sea level.</p>
    </Card>
  );
};

const dmText = (deg: number) => { const a = Math.abs(deg), d = Math.floor(a), m = (a - d) * 60; return `${deg < 0 ? '−' : ''}${d}° ${m.toFixed(1)}′`; };

/** Interpolation between two table readings of range and angle, for reading a distance-off or sextant-angle table. */
const InterpCard: React.FC = () => {
  const g = useForm('vsa-interp', ['r1', 'a1', 'r2', 'a2', 'want'] as const);
  const [find, setFind] = useMemory<'angle' | 'range'>('vsa:find', 'angle');
  const [imode, setImode] = useMemory<'linear' | 'inverse'>('vsa:imode', 'linear');
  const [u, setU] = useUnit('vsa:interp');
  const r1 = g.n('r1'), r2 = g.n('r2'), a1 = nav.parseAngle(g.v.a1), a2 = nav.parseAngle(g.v.a2);
  const wantAngle = nav.parseAngle(g.v.want), wantRange = g.n('want');
  let found: string | null = null;
  if (r1 !== null && r2 !== null && a1 !== null && a2 !== null) {
    if (find === 'angle' && wantRange !== null) { const v = nav.interpolate(r1, a1, r2, a2, wantRange, imode); if (v !== null) found = dmText(v); }
    if (find === 'range' && wantAngle !== null) { const v = nav.interpolate(a1, r1, a2, r2, wantAngle, imode); if (v !== null) found = nav.formatLength(v, u); }
  }
  return (
    <Card title="Interpolate between two table readings" closed note="Two known pairs of range and angle from a table, and the value in between. Straight line is how a table is read; Inverse follows the radian rule (the angle falls as the range grows) and is better over a wide span.">
      <UnitPick label="Ranges in" unit={u} onChange={setU} />
      <Grid>
        <Field label="Range 1" unit={nav.LENGTH_UNITS[u].short} {...g.bind('r1')} />
        <Field label="Angle 1" unit="° ′" kind="angle" {...g.bind('a1')} />
        <Field label="Range 2" unit={nav.LENGTH_UNITS[u].short} {...g.bind('r2')} />
        <Field label="Angle 2" unit="° ′" kind="angle" {...g.bind('a2')} />
      </Grid>
      <Seg value={find} onChange={v => setFind(v as 'angle' | 'range')} options={[['angle', 'Find the angle'], ['range', 'Find the range']]} />
      <Seg value={imode} onChange={v => setImode(v as 'linear' | 'inverse')} options={[['linear', 'Straight line'], ['inverse', 'Inverse']]} />
      {find === 'angle' ? <Field label="Range wanted" unit={nav.LENGTH_UNITS[u].short} {...g.bind('want')} /> : <Field label="Angle wanted" unit="° ′" kind="angle" {...g.bind('want')} />}
      {found && <Result rows={[[find === 'angle' ? 'Angle' : 'Range', found]]} />}
    </Card>
  );
};

/** Relative bearing of a contact and whether she can be sighted: the horizon range from the heights, and the visibility if known. */
const SightingCard: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const sp = shipParams(ship);
  const f = useForm('sighting', ['oc', 'brg', 'rng', 'eye', 'obj', 'vis'] as const, { eye: sp.heightOfEye === undefined ? undefined : String(Math.round(sp.heightOfEye * 10) / 10) });
  const oc = f.n('oc'), brg = f.n('brg'), rng = f.n('rng'), eye = f.n('eye'), obj = f.n('obj'), vis = f.n('vis');
  const rel = oc !== null && brg !== null ? ((brg - oc + 540) % 360) - 180 : null;
  const geo = eye !== null && eye >= 0 && obj !== null && obj >= 0 ? dippingRange(eye, obj, HORIZON_SETS.br45?.visual ?? 2.08) : null;
  const limit = geo === null ? (vis !== null && vis > 0 ? vis : null) : vis !== null && vis > 0 ? Math.min(geo, vis) : geo;
  const rows: [string, string][] = [];
  if (rel !== null) rows.push(['Relative bearing', Math.abs(rel) < 0.5 || Math.abs(Math.abs(rel) - 180) < 0.5 ? `${String(Math.round(Math.abs(rel))).padStart(3, '0')}°` : `${rel > 0 ? 'Green' : 'Red'} ${String(Math.round(Math.abs(rel))).padStart(2, '0')}°`]);
  if (geo !== null) rows.push(['Horizon (geometric) range', `${geo.toFixed(1)} nm`]);
  if (limit !== null) rows.push(['Sighted at', `${limit.toFixed(1)} nm${vis !== null && vis > 0 && geo !== null && vis < geo ? ' (limited by the visibility)' : ''}`]);
  if (limit !== null && rng !== null) rows.push([rng <= limit ? 'Now' : 'Not yet', rng <= limit ? 'she is within the range she can be sighted' : `${(rng - limit).toFixed(1)} nm to go before she can be sighted`]);
  return (
    <Card title="Relative bearing and visibility" closed note="Her relative bearing from own course and her true bearing, and whether she can be seen: the horizon range from the heights of eye and object (BR 45 coefficient 2.08), cut down by the visibility when that is less.">
      <Grid>
        <Field label="Own course" unit="°T" {...f.bind('oc')} />
        <Field label="Her bearing" unit="°T" {...f.bind('brg')} />
        <Field label="Range" unit="nm" {...f.bind('rng')} />
        <Field label="Visibility" unit="nm" {...f.bind('vis')} />
        <Field label="Height of eye" unit="m" {...f.bind('eye')} />
        <Field label="Height of object" unit="m" {...f.bind('obj')} />
      </Grid>
      {rows.length > 0 && <Result rows={rows} />}
    </Card>
  );
};

export const DistanceOffTool: React.FC<{ ship?: Ship }> = ({ ship }) => (
  <div className="space-y-2">
    <VsaCard ship={ship} />
    <InterpCard />
    <HorizonCard ship={ship} />
    <SightingCard ship={ship} />
  </div>
);
