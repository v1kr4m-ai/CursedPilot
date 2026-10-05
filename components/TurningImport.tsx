import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Ship, TurningDataSet } from '../types';
import { IMPORT_ACCEPT, parseTurningFile } from '../fishtail/importTables';
import { TableMeta, rowsToTurningSets } from '../fishtail/tableConvert';

export interface ImportMessage { kind: 'ok' | 'error'; text: string }

interface Props {
  ship: Ship | undefined;
  onImport: (shipId: string, sets: TurningDataSet[]) => void;
  onMessage: (m: ImportMessage) => void;
  /** classes for the clickable label */
  className?: string;
  title?: string;
  children: React.ReactNode;
}

const WHEELS = [5, 10, 15, 20, 25];

/**
 * A button that imports turning data into a vessel from Excel, CSV, Word (.docx) or JSON. If the file does not say which
 * speed, wheel angle and side its rows belong to, a small dialog asks. The existing rows for the same table and turn
 * amount are replaced; nothing else is touched.
 */
const TurningImport: React.FC<Props> = ({ ship, onImport, onMessage, className, title, children }) => {
  const [pending, setPending] = useState<{ rows: Record<string, unknown>[]; name: string } | null>(null);
  const [speed, setSpeed] = useState('12');
  const [wheel, setWheel] = useState('15');
  const [side, setSide] = useState<TableMeta['side']>('Starboard');

  const apply = (rows: Record<string, unknown>[], name: string, meta?: TableMeta) => {
    if (!ship) return;
    const { sets, skipped } = rowsToTurningSets(rows, meta);
    const count = sets.reduce((n, s) => n + s.data.length, 0);
    if (!count) { onMessage({ kind: 'error', text: 'No usable rows found. Each row needs a turn amount and a numeric speed and wheel angle.' }); return; }
    const detail = `${count} row${count === 1 ? '' : 's'} in ${sets.length} table${sets.length === 1 ? '' : 's'}`;
    if (!confirm(`Import ${detail} from "${name}" into ${ship.name}? Rows for the same speed, wheel angle, side and turn amount are replaced; everything else is kept.${skipped ? ` ${skipped} row(s) that could not be placed will be skipped.` : ''}`)) return;
    onImport(ship.id, sets);
    onMessage({ kind: 'ok', text: `Imported ${detail} into ${ship.name}` });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ship) return;
    try {
      const parsed = await parseTurningFile(file);
      if (parsed.needsMeta) setPending({ rows: parsed.rows, name: file.name });
      else apply(parsed.rows, file.name);
    } catch (err) {
      onMessage({ kind: 'error', text: `Import failed: ${err instanceof Error ? err.message : err}` });
    }
  };

  const field = 'w-full p-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-bold text-slate-900 focus:border-blue-400';
  const label = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1';

  return (
    <>
      <label className={className} title={title ?? 'Import turning data from Excel, CSV, Word or JSON'}>
        {children}
        <input type="file" className="hidden" accept={IMPORT_ACCEPT} onChange={onFile} disabled={!ship} />
      </label>

      {pending && ship && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setPending(null)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={e => {
              e.preventDefault();
              const s = parseFloat(speed), w = parseFloat(wheel);
              if (!Number.isFinite(s) || !Number.isFinite(w)) return;
              const rows = pending.rows, name = pending.name;
              setPending(null);
              apply(rows, name, { speed: s, wheel: w, side });
            }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">Which table is this?</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{pending.rows.length} rows in "{pending.name}" have no speed, wheel angle or side. Say what they were recorded at.</p>
              </div>
              <button type="button" onClick={() => setPending(null)} aria-label="Cancel" className="p-2 bg-slate-50 text-slate-400 rounded-full"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className={label}>Speed (kn)</label><input required type="number" step="any" min="0" value={speed} onChange={e => setSpeed(e.target.value)} className={field} /></div>
              <div className="space-y-1"><label className={label}>Wheel angle ({'°'})</label>
                <input required type="number" step="any" min="0" list="wheel-angles" value={wheel} onChange={e => setWheel(e.target.value)} className={field} />
                <datalist id="wheel-angles">{WHEELS.map(w => <option key={w} value={w} />)}</datalist>
              </div>
            </div>
            <div className="space-y-1">
              <span className={label}>Side of turn</span>
              <div className="grid grid-cols-2 gap-2">
                {(['Port', 'Starboard'] as const).map(sd => (
                  <button key={sd} type="button" onClick={() => setSide(sd)} aria-pressed={side === sd}
                    className={`py-3 rounded-xl text-xs font-bold border ${side === sd ? (sd === 'Port' ? 'bg-red-600 border-red-600' : 'bg-green-600 border-green-600') + ' text-white' : 'bg-white text-slate-500 border-slate-200'}`}>{sd}</button>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Continue</button>
          </form>
        </div>
      )}
    </>
  );
};

export default TurningImport;
