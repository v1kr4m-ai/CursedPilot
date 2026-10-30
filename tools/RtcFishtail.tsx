import React, { useMemo, useState } from 'react';
import { Ship } from '../types';
import { Field, Grid, Panel, Result, Seg, useForm, useMemory } from './kit';
import type { Fishtail, Station } from './stationChanges';
import { shipToFishtailRows } from '../fishtail/shipBridge';
import { computeFishtail, fishtailAngles, tableKeyOf, tableRows } from '../fishtail/compute';
import { ManeuverType, SideOfTurn } from '../fishtail/types';
import ManeuverVisualizer from '../fishtail/components/ManeuverVisualizer';
import '../fishtail/fishtail.css';

// The fishtail a round-the-clock solution calls for (BR 45(6) para 0429), worked from the ship's own turning data with the Fishtail
// Calculator's plot, radar and graphs, the two stations marked about the Guide.

const KIND: Record<Fishtail['kind'], ManeuverType> = { half: ManeuverType.HALF, full: ManeuverType.FULL, distorted: ManeuverType.DISTORTED };
const BEARING: Record<Station, number> = { Ahead: 0, 'Bow (45)': 45, Abeam: 90, Quarter: 135, Astern: 180 };
const NAME: Record<Fishtail['kind'], string> = { half: 'Half fishtail', full: 'Full fishtail', distorted: 'Unbalanced fishtail' };

export const RtcFishtail: React.FC<{ ship?: Ship; fishtail: Fishtail; from: Station; to: Station }> = ({ ship, fishtail, from, to }) => {
  const rows = useMemo(() => (ship ? shipToFishtailRows(ship) : []), [ship]);
  const tables = useMemo(() => [...new Map(rows.map(r => [tableKeyOf(r), r])).values()], [rows]);
  const f = useForm(`rtc:${fishtail.kind}`, ['a1', 'a2', 'gs', 'rng'] as const);   // blank: the book's angles and 1000 yd
  const [side, setSide] = useMemory<'Port' | 'Starboard'>('rtc:side', 'Starboard');
  const [keyRaw, setKey] = useMemory<string>('rtc:table', '');
  const [scale, setScale] = useState(1000);
  const key = tables.some(t => tableKeyOf(t) === keyRaw) ? keyRaw : tables[0] ? tableKeyOf(tables[0]) : '';
  const a1 = f.n('a1') ?? fishtail.angle, a2 = f.n('a2') ?? fishtail.a2 ?? null, gs = f.n('gs'), rng = f.n('rng') ?? 1000;

  if (!ship) return <p className="text-[11px] text-slate-500 font-medium">Choose My Ship to work the fishtail from her turning data.</p>;
  if (!tables.length) return <p className="text-[11px] text-slate-500 font-medium">{ship.name} has no turning data: add it under Calibration Data, Turning Trials, to see the fishtail.</p>;

  const type = KIND[fishtail.kind];
  const ready = a1 > 0 && gs !== null && gs >= 0 && (type !== ManeuverType.DISTORTED || (a2 !== null && a2 > 0));
  const angles = ready ? fishtailAngles(type, side === 'Starboard' ? SideOfTurn.STARBOARD : SideOfTurn.PORT, a1, a2 ?? 0) : [];
  const result = ready ? computeFishtail(tableRows(rows, key), type, angles, gs!) : null;
  // the stations about the Guide, on the side the ship turns out to (away from the Guide)
  const at = (st: Station) => { const b = side === 'Port' ? (360 - BEARING[st]) % 360 : BEARING[st]; return { x: rng * Math.sin((b * Math.PI) / 180), y: rng * Math.cos((b * Math.PI) / 180), name: st, bearing: b, range: rng }; };
  const sel = 'w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700';
  return (
    <Panel title={`${NAME[fishtail.kind]}: ${angles.length ? angles.map(a => `${Math.abs(a)}°`).join(' / ') : ''}`} note="Worked from the ship's own turning table: the advance, transfer and time of each turn, with the Guide steaming on at her speed. The plot, radar and graphs are the Fishtail Calculator's.">
      <Seg value={side} onChange={v => setSide(v as 'Port' | 'Starboard')} options={[['Starboard', 'Turn out to starboard'], ['Port', 'Turn out to port']]} />
      <Grid>
        <Field label={fishtail.kind === 'distorted' ? 'Out (first turn)' : 'Angle'} unit="°" hint={String(fishtail.angle)} {...f.bind('a1')} />
        {fishtail.kind === 'distorted' && <Field label="Then (last turn)" unit="°" hint={String(fishtail.a2 ?? '')} {...f.bind('a2')} />}
        <Field label="Guide's speed" unit="kn" units {...f.bind('gs')} />
        <Field label="Standard distance" unit="yd" hint="1000" {...f.bind('rng')} />
      </Grid>
      <label className="block space-y-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Turning table</span>
        <select value={key} onChange={e => setKey(e.target.value)} className={sel}>
          {tables.map(t => <option key={tableKeyOf(t)} value={tableKeyOf(t)}>{`${t.ownSpeed} kn · ${t.rudder}° wheel · ${t.side}`}</option>)}
        </select></label>
      {result && (
        <>
          <Result inline rows={[
            ['Lateral separation', `${Math.round(result.lateral_separation)} yd`],
            ['Drop astern of the Guide', `${Math.round(result.drop_distance)} yd`],
            ['Time', `${Math.floor(result.total_time / 60)} min ${Math.round(result.total_time % 60)} s`],
          ]} />
          <div className="original-palette rounded-2xl bg-slate-950 text-slate-50 p-2">
            <ManeuverVisualizer result={result} yardScale={scale} onSetScale={setScale}
              stationSolver={{ enabled: true, initialStation: at(from), targetStation: at(to) }} />
          </div>
        </>
      )}
      {!ready && <p className="text-[11px] text-slate-500 font-medium">Enter the Guide's speed{fishtail.kind === 'distorted' ? ' and both angles' : ''}.</p>}
    </Panel>
  );
};
