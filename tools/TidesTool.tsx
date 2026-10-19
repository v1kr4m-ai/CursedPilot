import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { getPosition } from '../services/position';
import { Field, Grid, Panel, Result, SELECT, Seg, Warn, toNum, useForm, useMemory } from './kit';
import { DateField } from './SunTools';
import { OwnFormula } from './OwnFormula';
import { julianDay } from './sunEphemeris';
import { parseClock, parseIsoDate, parseZone } from './sunSights';
import { Method, Tide, heightAt, moonPhase, rateAt, timeAt } from './tides';
import { DayTide, Port, SEED_PORTS, around, highWaters, nearestPort, nextTides, secondaryTides, timeline } from './tidePorts';

const hhmm = (hours: number) => {
  const total = Math.round(hours * 60), day = Math.floor(total / 1440), m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${day !== 0 ? ` (${day > 0 ? '+' : '−'}${Math.abs(day)} day)` : ''}`;
};
const NOTE_END = 'An aid: the rule of twelfths and the half-cosine curve are approximations and are less exact in ports with a distorted tide. Springs and neaps follow the Moon\'s phase, but the highest springs come a day or two after new or full Moon, and weather can alter the height. Check the tide tables for the port.';

/** The answer for a pair of tides and a time: height, flood or ebb, rate, springs or neaps. */
const Answer: React.FC<{ a: Tide; b: Tide; tw: number | null; hw: number | null; method: Method; jdUt: number | null; extra?: [string, string][] }> = ({ a, b, tw, hw, method, jdUt, extra = [] }) => {
  const inside = tw !== null && tw >= a.t && tw <= b.t;
  const h = inside ? heightAt(a, b, tw!, method) : null;
  const rate = inside ? rateAt(a, b, tw!, method) : null;
  const when = hw !== null ? timeAt(a, b, hw, method) : null;
  const phase = jdUt !== null ? moonPhase(jdUt) : null;
  const springNeap = phase && (phase.kind === 'spring' ? `Spring tides (${phase.name}, within ${phase.daysFromSyzygy.toFixed(1)} days of new or full Moon)`
    : phase.kind === 'neap' ? `Neap tides (${phase.name})` : `Between springs and neaps, ${phase.trend === 'making' ? 'making towards springs' : 'falling off towards neaps'} (${phase.name})`);
  return (
    <>
      <Result rows={[
        ...extra,
        ['Range of this tide', `${Math.abs(b.h - a.h).toFixed(2)} m`],
        ['Duration', `${Math.floor(b.t - a.t)}h ${String(Math.round(((b.t - a.t) % 1) * 60)).padStart(2, '0')}m`],
        ['Tide', b.h > a.h ? 'Flooding (rising)' : 'Ebbing (falling)'],
        ...(h !== null && rate !== null ? [[`Height at ${hhmm(tw!)}`, `${h.toFixed(2)} m`] as [string, string], ['Rate', `${rate >= 0 ? 'rising' : 'falling'} ${Math.abs(rate).toFixed(2)} m/h`] as [string, string]] : []),
        ...(when !== null ? [[`${hw!.toFixed(2)} m reached at`, hhmm(when)] as [string, string]] : []),
        ...(springNeap ? [['Moon', springNeap] as [string, string]] : []),
      ]} />
      {phase?.perigean && <p className="text-[11px] text-slate-500 font-medium">The Moon is near perigee, which makes the tides rise and fall more than usual.</p>}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{NOTE_END}</p>
    </>
  );
};

// ---- user defined: type the two tides ----------------------------------------------------------------------------------

const FIELDS = ['date', 'zone', 't1', 'h1', 't2', 'h2', 'tw', 'hw'] as const;

const ManualTides: React.FC = () => {
  const f = useForm('tide', FIELDS);
  const [first, setFirst] = useMemory<'high' | 'low'>('tide:first', 'high');
  const [method, setMethod] = useMemory<Method>('tide:method', 'twelfths');
  const date = parseIsoDate(f.v.date), zone = f.v.zone.trim() === '' ? 0 : parseZone(f.v.zone);
  const s1 = parseClock(f.v.t1), s2 = parseClock(f.v.t2), sw = parseClock(f.v.tw);
  const h1 = f.n('h1'), h2 = f.n('h2'), hw = f.n('hw');
  const second = first === 'high' ? 'low' : 'high';

  const ok = s1 !== null && s2 !== null && h1 !== null && h2 !== null;
  const t1 = ok ? s1 / 3600 : 0;
  const t2 = ok ? s2 / 3600 + (s2 <= s1 ? 24 : 0) : 0;                 // a second tide earlier on the clock is after midnight
  const wrongOrder = ok && (first === 'high' ? h1! <= h2! : h1! >= h2!);
  const a = { t: t1, h: h1 ?? 0 }, b = { t: t2, h: h2 ?? 0 };
  const good = ok && !wrongOrder && t2 - t1 <= 9;
  let tw: number | null = null;
  if (good && sw !== null) { tw = sw / 3600; if (tw < t1) tw += 24; }
  const jdUt = date && zone !== null && ok ? julianDay(date[0], date[1], date[2]) + ((tw ?? t1) - zone) / 24 : null;

  return (
    <div className="space-y-3">
      <Panel title="Tide at a given time" note="Enter the two tides either side of the time you want: a high water and the next low water, or a low water and the next high water (from the tide tables, for the port). The height between them is worked by the rule of twelfths or by the half-cosine curve.">
        <Grid>
          <DateField value={f.v.date} onChange={f.bind('date').onChange} />
          <Field label="Zone (h from UT, optional)" kind="zone" wide {...f.bind('zone')} />
        </Grid>
        <Seg value={first} onChange={v => setFirst(v as 'high' | 'low')} options={[['high', 'High water, then low'], ['low', 'Low water, then high']]} />
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{first === 'high' ? 'High' : 'Low'} water</p>
        <Grid>
          <Field label="Time" kind="time" {...f.bind('t1')} />
          <Field label="Height" unit="m" {...f.bind('h1')} />
        </Grid>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{second === 'high' ? 'High' : 'Low'} water</p>
        <Grid>
          <Field label="Time" kind="time" {...f.bind('t2')} />
          <Field label="Height" unit="m" {...f.bind('h2')} />
        </Grid>
        <Seg value={method} onChange={v => setMethod(v as Method)} options={[['twelfths', 'Rule of twelfths'], ['cosine', 'Half-cosine curve']]} />
        {wrongOrder && <Warn>The {first} water must be {first === 'high' ? 'higher' : 'lower'} than the {second} water. Check the heights.</Warn>}
        {ok && !wrongOrder && t2 - t1 > 9 && <Warn>The two tides are {(t2 - t1).toFixed(1)} hours apart, more than a tide takes. Check the times.</Warn>}
      </Panel>
      <Panel title="What do you want to know?">
        <Field label="Height at the time" kind="time" {...f.bind('tw')} />
        {tw !== null && !(tw >= t1 && tw <= t2) && <Warn>That time is outside the two tides. Enter the pair of tides either side of it.</Warn>}
        <Field label="Time when the tide reaches the height" unit="m" {...f.bind('hw')} />
        {hw !== null && good && timeAt(a, b, hw, method) === null && <Warn>That height is not reached between these two tides.</Warn>}
      </Panel>
      {good && <Answer a={a} b={b} tw={tw} hw={hw} method={method} jdUt={jdUt} />}
      {good && !date && <p className="text-[11px] text-slate-400 font-medium">Enter the date to see whether the tides are springs or neaps.</p>}
    <OwnFormula id="tides" unitHint="m" vars={[{ name: 'h1', label: 'first height (m)', value: ok ? h1 : null }, { name: 'h2', label: 'second height (m)', value: ok ? h2 : null }, { name: 't1', label: 'first time (h)', value: ok ? t1 : null }, { name: 't2', label: 'second time (h)', value: ok ? t2 : null }, { name: 'tw', label: 'time wanted (h)', value: tw }, { name: 'h', label: 'height at that time (m)', value: good && tw !== null && tw >= t1 && tw <= t2 ? heightAt(a, b, tw, method) : null }]} />
    </div>
  );
};

// ---- automatic: pick the port, the tables supply the tides ------------------------------------------------------------

type Days = Record<string, DayTide[]>;

const DayEditor: React.FC<{ title: string; rows: DayTide[]; onChange: (r: DayTide[]) => void }> = ({ title, rows, onChange }) => {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (ref.current && rows.length === 0) ref.current.open = true; }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- open an empty day once; after that the user decides
  return (
  <details ref={ref} className="bg-white rounded-xl border border-slate-200">
    <summary className="px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer">{title}{rows.length > 0 && <span className="text-slate-400 font-medium"> · {rows.length} tide{rows.length > 1 ? 's' : ''}</span>}</summary>
    <div className="px-3 pb-3 space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_5rem_2rem] gap-2 items-end">
          <Field label="Time" kind="time" value={r.time} onChange={s => onChange(rows.map((x, j) => (j === i ? { ...x, time: s } : x)))} />
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Height (m)</span>
            <input type="number" inputMode="decimal" step="any" value={Number.isFinite(r.h) ? r.h : ''} onChange={e => onChange(rows.map((x, j) => (j === i ? { ...x, h: e.target.value === '' ? NaN : parseFloat(e.target.value) } : x)))}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
          </label>
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove this tide" className="p-2 mb-1 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
        </div>
      ))}
      {rows.length < 6 && <button type="button" onClick={() => onChange([...rows, { time: '', h: NaN }])} className="flex items-center gap-1.5 text-xs font-bold text-blue-600"><Plus size={14} />Add a tide</button>}
    </div>
  </details>
  );
};

const num = (s: string) => (s.trim() === '' ? undefined : toNum(s) ?? undefined);

const PortEditor: React.FC<{ port: Port; stds: string[]; isUser: boolean; onSave: (p: Port) => void; onRemove: () => void }> = ({ port, stds, isUser, onSave, onRemove }) => {
  const [secondary, setSecondary] = useState(!!port.ref);
  const [ref, setRef] = useState(port.ref ?? stds[0] ?? '');
  const [v, setV] = useState({ dtHw: port.dtHw?.toString() ?? '', dtLw: port.dtLw?.toString() ?? '', dhHw: port.dhHw?.toString() ?? '', dhLw: port.dhLw?.toString() ?? '', lat: port.lat?.toString() ?? '', lon: port.lon?.toString() ?? '' });
  const input = (k: keyof typeof v, label: string, unit: string) => (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label} ({unit})</span>
      <input type="number" inputMode="decimal" step="any" value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
    </label>
  );
  return (
    <div className="space-y-2">
      <Seg value={secondary ? 'sec' : 'std'} onChange={x => setSecondary(x === 'sec')} options={[['std', 'Standard port'], ['sec', 'Secondary port']]} />
      {secondary && (
        <>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Worked from the standard port</span>
            <select value={ref} onChange={e => setRef(e.target.value)} className={`${SELECT} w-full`}>{stds.filter(n => n !== port.name).map(n => <option key={n}>{n}</option>)}</select>
          </label>
          <p className="text-[10px] text-slate-400 font-medium">Differences as printed in the tables for this port: plus when later or higher than the standard port, minus when earlier or lower.</p>
          <Grid>{input('dtHw', 'High water time', 'min')}{input('dtLw', 'Low water time', 'min')}{input('dhHw', 'High water height', 'm')}{input('dhLw', 'Low water height', 'm')}</Grid>
        </>
      )}
      <Grid>{input('lat', 'Latitude, +N', '°')}{input('lon', 'Longitude, +E', '°')}</Grid>
      <p className="text-[10px] text-slate-400 font-medium">Position is optional and only used to pick the nearest port from your GPS (decimal degrees, south and west negative).</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave({ name: port.name, ...(secondary ? { ref, dtHw: num(v.dtHw), dtLw: num(v.dtLw), dhHw: num(v.dhHw), dhLw: num(v.dhLw) } : {}), lat: num(v.lat), lon: num(v.lon) })}
          className="flex-1 p-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold active:scale-95">Save this port</button>
        {isUser && <button type="button" onClick={onRemove} className="p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-red-500">Remove</button>}
      </div>
    </div>
  );
};

const AutoTides: React.FC = () => {
  const f = useForm('tideauto', ['date', 'zone', 'tw', 'hw'] as const);
  const [method, setMethod] = useMemory<Method>('tide:method', 'twelfths');
  const [userPorts, setUserPorts] = useMemory<Port[]>('pref:tide:ports', []);
  const [days, setDays] = useMemory<Days>('pref:tide:days', {});
  const [portName, setPortName] = useMemory('tide:port', SEED_PORTS[7].name);
  const [gps, setGps] = useState<{ msg: string; warn: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  const ports = [...SEED_PORTS.map(p => userPorts.find(u => u.name === p.name) ?? p), ...userPorts.filter(u => !SEED_PORTS.some(p => p.name === u.name))];
  const port = ports.find(p => p.name === portName) ?? ports[0];
  const stdName = port.ref ?? port.name;
  const std = ports.find(p => p.name === stdName);
  const date = parseIsoDate(f.v.date), zone = f.v.zone.trim() === '' ? 5.5 : parseZone(f.v.zone);
  const sw = parseClock(f.v.tw), hw = num(f.v.hw);
  const dayKey = (off: number) => {
    if (!date) return null;
    const d = new Date(Date.UTC(date[0], date[1] - 1, date[2] + off));
    return `${stdName}|${d.toISOString().slice(0, 10)}`;
  };
  const rowsOf = (off: number): DayTide[] => { const k = dayKey(off); return k ? days[k] ?? [] : []; };
  const setRows = (off: number, rows: DayTide[]) => { const k = dayKey(off); if (k) setDays({ ...days, [k]: rows }); };

  const std_t = date ? timeline([-1, 0, 1].map(o => ({ offset: o * 24, tides: rowsOf(o) }))) : [];
  const all = port.ref ? secondaryTides(std_t, port) : std_t;
  const tw = sw === null ? null : sw / 3600;
  const pair = tw !== null ? around(all, tw) : null;
  const today = timeline([{ offset: 0, tides: rowsOf(0) }]);
  const jdUt = date && zone !== null && tw !== null ? julianDay(date[0], date[1], date[2]) + (tw - zone) / 24 : null;
  const hwFlags = highWaters(all);
  const dayList = all.filter(t => t.t >= 0 && t.t < 24).map(t => ({ ...t, hw: hwFlags[all.indexOf(t)] }));
  const next = tw !== null ? nextTides(all, tw) : null;

  const useGps = async () => {
    setBusy(true); setGps(null);
    try {
      const fix = await getPosition();
      const n = nearestPort(fix, ports);
      if (!n) setGps({ msg: 'No port has a position to compare with.', warn: true });
      else { setPortName(n.port.name); setGps({ msg: `Nearest port: ${n.port.name}, ${n.nm.toFixed(0)} nm from your position (GPS to ${Math.round(fix.accuracyM)} m).${n.nm > 60 ? ' That is far from any listed port: check that its tides apply where you are.' : ''}`, warn: n.nm > 60 }); }
    } catch (e) { setGps({ msg: e instanceof Error ? e.message : String(e), warn: true }); }
    finally { setBusy(false); }
  };
  const now = () => {
    const d = new Date();
    f.bind('date').onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    f.bind('tw').onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`);
  };
  const savePort = (p: Port) => setUserPorts([...userPorts.filter(u => u.name !== p.name), p]);
  const addPort = () => { const n = newName.trim(); if (n && !ports.some(p => p.name.toLowerCase() === n.toLowerCase())) { savePort({ name: n }); setPortName(n); setNewName(''); } };
  const stdNames = ports.filter(p => !p.ref).map(p => p.name);
  const needed = !date ? null : tw !== null && all.length > 0 && tw < all[0].t ? -1 : tw !== null && all.length > 0 && tw > all[all.length - 1].t ? 1 : 0;
  const label = (o: number) => `${o === -1 ? 'Day before' : o === 1 ? 'Day after' : 'Date'} (${dayKey(o)?.split('|')[1] ?? ''})`;

  return (
    <div className="space-y-3">
      <Panel title="Place and time" note="Choose the port, or use your GPS position to pick the nearest one. Tide times are in the zone of the tables (blank zone is +5:30, India).">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Port</span>
          <select value={port.name} onChange={e => { setPortName(e.target.value); setGps(null); }} className={`${SELECT} w-full`}>
            {ports.map(p => <option key={p.name} value={p.name}>{p.name}{p.ref ? ` (secondary, ${p.ref})` : ''}</option>)}
          </select>
        </label>
        <button type="button" onClick={useGps} disabled={busy} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white border border-blue-200 text-blue-600 text-xs font-bold active:scale-95 disabled:opacity-50"><MapPin size={16} />{busy ? 'Getting position…' : 'Use my GPS position'}</button>
        {gps && (gps.warn ? <Warn>{gps.msg}</Warn> : <p className="text-xs text-slate-600 font-medium">{gps.msg}</p>)}
        <Grid>
          <DateField value={f.v.date} onChange={f.bind('date').onChange} />
          <Field label="Time wanted" kind="time" {...f.bind('tw')} />
        </Grid>
        <Field label="Zone (h from UT, optional)" kind="zone" wide {...f.bind('zone')} />
        <button type="button" onClick={now} className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-blue-600 active:scale-95">Use the date and time now (this phone)</button>
        <Seg value={method} onChange={v => setMethod(v as Method)} options={[['twelfths', 'Rule of twelfths'], ['cosine', 'Half-cosine curve']]} />
      </Panel>

      <Panel title={port.ref ? `Tides at ${std?.name ?? port.ref}, the standard port` : `Tides at ${port.name}`} note={`Copy the high and low waters from the Indian Tide Tables for ${stdName}. They are kept on this phone for next time. ${port.ref ? `${port.name} is worked from them with the differences saved for it.` : ''}`}>
        {!date && <p className="text-xs text-slate-400 font-medium">Enter the date first.</p>}
        {date && ([0, -1, 1] as const).map(o => <DayEditor key={o} title={label(o)} rows={rowsOf(o)} onChange={r => setRows(o, r)} />)}
        {port.ref && !std && <Warn>The standard port {port.ref} is not in the list. Edit the port below.</Warn>}
      </Panel>

      {date && all.length >= 2 && (
        <>
          {dayList.length > 0 && (
            <Result inline rows={[...dayList.map(t => [`${t.hw ? 'High' : 'Low'} water ${hhmm(t.t)}`, `${t.h.toFixed(2)} m`] as [string, string])]} />
          )}
          {tw !== null && pair && (
            <>
              <Field label="Time when the tide reaches the height (optional)" unit="m" {...f.bind('hw')} />
              <Answer a={pair[0]} b={pair[1]} tw={tw} hw={hw ?? null} method={method} jdUt={jdUt} extra={[['Port', port.ref ? `${port.name} (from ${port.ref})` : port.name], ...(next?.hw ? [['Next high water', `${hhmm(next.hw.t)}, ${next.hw.h.toFixed(2)} m`] as [string, string]] : []), ...(next?.lw ? [['Next low water', `${hhmm(next.lw.t)}, ${next.lw.h.toFixed(2)} m`] as [string, string]] : [])]} />
            </>
          )}
          {tw !== null && !pair && needed !== null && <Warn>The time is {needed === 0 ? 'not between two tides' : `${needed < 0 ? 'before the first' : 'after the last'} tide entered`}. Enter the {needed < 0 ? 'last tide of the day before' : needed > 0 ? 'first tide of the day after' : 'tides either side'} above.</Warn>}
          {tw === null && <p className="text-xs text-slate-400 font-medium">Enter the time wanted to see the height.</p>}
        </>
      )}
      {date && today.length === 0 && all.length < 2 && <p className="text-xs text-slate-400 font-medium">Enter the tides for this date above to see the day's tides and the height at the time.</p>}

      <details className="bg-white rounded-xl border border-slate-200">
        <summary className="px-3 py-2 text-xs font-bold text-slate-600 cursor-pointer">Edit {port.name} or add a port</summary>
        <div className="px-3 pb-3 space-y-3">
          <PortEditor key={port.name + (port.ref ?? '')} port={port} stds={stdNames} isUser={userPorts.some(u => u.name === port.name)} onSave={savePort}
            onRemove={() => { setUserPorts(userPorts.filter(u => u.name !== port.name)); setPortName(SEED_PORTS[0].name); }} />
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New port name" aria-label="New port name" className="min-w-0 flex-1 p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400" />
            <button type="button" onClick={addPort} disabled={!newName.trim()} className="px-4 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-40">Add</button>
          </div>
        </div>
      </details>
    </div>
  );
};

export const TidesTool: React.FC = () => {
  const [mode, setMode] = useMemory<'auto' | 'manual'>('tide:mode', 'auto');
  return (
    <div className="space-y-3">
      <Seg value={mode} onChange={v => setMode(v as 'auto' | 'manual')} options={[['auto', 'By port (tables)'], ['manual', 'User defined']]} />
      {mode === 'auto' ? <AutoTides /> : <ManualTides />}
    </div>
  );
};
