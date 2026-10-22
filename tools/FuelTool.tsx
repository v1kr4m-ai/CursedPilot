import React from 'react';
import { Ship } from '../types';
import { Field, Grid, Panel, Result, SELECT, Seg, Warn, useForm, useMemory } from './kit';
import { bySpeed, byRpm, endurance, hm, passage, perMile, points } from './fuel';

// Fuel Planning: works on the fuel data the ship has filled in (Calibration Data, Fuel Data): fuel left to distance, or distance to fuel
// needed, at a regime and RPM or at a speed. The sums are in fuel.ts.

export const FuelTool: React.FC<{ ship?: Ship }> = ({ ship }) => {
  const f = useForm('fuel', ['fuel', 'dist', 'speed'] as const);
  const [mode, setMode] = useMemory<'forward' | 'reverse'>('fuel:mode', 'forward');
  const [by, setBy] = useMemory<'rpm' | 'speed'>('fuel:by', 'rpm');
  const [regimeId, setRegimeId] = useMemory<string>('fuel:regime', '');
  const [rpm, setRpm] = useMemory<string>('fuel:rpm', '');
  const data = ship?.fuelData;
  const regimes = (data?.regimes ?? []).filter(r => points(r).length > 0);
  if (!ship) return <p className="text-xs text-slate-500 font-medium">Choose your ship first (star it in the Fleet): the tool uses the fuel data entered for that ship.</p>;
  if (!regimes.length) return <p className="text-xs text-slate-500 font-medium">{ship.name} has no usable fuel data yet. Open the ship, then Calibration Data, then Fuel Data, start from the template and fill in at least one regime with a speed and a fuel rate.</p>;

  const regime = regimes.find(r => r.id === regimeId) ?? regimes[0];
  const pts = points(regime);
  const rpmRow = by === 'rpm' ? (byRpm(regime, rpm) ?? pts[0]) : null;
  const wantSpeed = f.n('speed');
  const atSpeed = by === 'speed' && wantSpeed !== null && wantSpeed >= 0 ? bySpeed(regime, wantSpeed) : null;
  const speed = by === 'rpm' ? rpmRow?.speed ?? null : atSpeed?.speed ?? null;
  const rate = by === 'rpm' ? rpmRow?.rate ?? null : atSpeed?.rate ?? null;
  const fuel = f.n('fuel'), dist = f.n('dist');
  const fwd = mode === 'forward' && fuel !== null && fuel >= 0 && speed !== null && rate !== null ? endurance(fuel, speed, rate) : null;
  const rev = mode === 'reverse' && dist !== null && dist >= 0 && speed !== null && rate !== null ? passage(dist, speed, rate) : null;
  const cap = data?.capacity ? Number(data.capacity) : null;
  const pm = speed !== null && rate !== null ? perMile(speed, rate) : null;

  return (
    <div className="space-y-2">
      <Seg value={mode} onChange={v => setMode(v as 'forward' | 'reverse')} options={[['forward', 'Fuel to distance'], ['reverse', 'Distance to fuel']]} />
      <Panel title="Engine regime" note={`From the fuel data entered for ${ship.name}. Choose the regime, then the RPM, or a speed (the fuel rate is read between the rows).`}>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Regime</span>
          <select value={regime.id} onChange={e => setRegimeId(e.target.value)} className={`${SELECT} w-full`}>{regimes.map(r => <option key={r.id} value={r.id}>{r.name || 'Unnamed regime'}</option>)}</select>
        </label>
        <Seg value={by} onChange={v => setBy(v as 'rpm' | 'speed')} options={[['rpm', 'By RPM'], ['speed', 'By speed']]} />
        {by === 'rpm' ? (
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engine RPM</span>
            <select value={rpmRow?.rpm ?? ''} onChange={e => setRpm(e.target.value)} className={`${SELECT} w-full`}>{pts.map((p, i) => <option key={i} value={p.rpm}>{p.rpm ? `${p.rpm} RPM` : `${p.speed} kn`} ({p.speed} kn, {p.rate} t/h)</option>)}</select>
          </label>
        ) : <Field label="Speed" unit="kn" {...f.bind('speed')} />}
      </Panel>
      <Panel title={mode === 'forward' ? 'Fuel on board' : 'Passage'}>
        {mode === 'forward' ? <Field label="Fuel remaining" unit="tonnes" {...f.bind('fuel')} /> : <Field label="Distance to go" unit="nm" {...f.bind('dist')} />}
        {mode === 'forward' && cap !== null && Number.isFinite(cap) && cap > 0 && fuel !== null && <p className="text-[10px] font-semibold text-slate-400">{Math.round((fuel / cap) * 100)} % of the {cap} t capacity.</p>}
      </Panel>
      {speed !== null && rate !== null && (
        <Result rows={[
          ['Speed and fuel rate', `${speed.toFixed(1)} kn at ${rate.toFixed(2)} t/h${atSpeed?.outside ? ' (outside the entered range: nearest row used)' : ''}`],
          ...(fwd ? [['Endurance', hm(fwd.hours)] as [string, string], ['Distance', `${fwd.distanceNm.toFixed(0)} nm`] as [string, string]] : []),
          ...(rev ? [['Time', hm(rev.hours)] as [string, string], ['Fuel needed', `${rev.fuelTonnes.toFixed(1)} t`] as [string, string]] : []),
          ...(pm !== null ? [['Fuel per mile', `${(pm * 1000).toFixed(0)} kg`] as [string, string]] : []),
        ]} />
      )}
      {by === 'speed' && wantSpeed !== null && !atSpeed && <Warn>Enter a speed of zero or more.</Warn>}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Works from the figures entered for the ship: keep a reserve, and allow for weather, fouling and speed changes.</p>
    </div>
  );
};
