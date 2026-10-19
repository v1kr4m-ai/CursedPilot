import React, { useEffect, useState } from 'react';
import { Compass, Gauge, LocateFixed } from 'lucide-react';
import { getPosition, readCompass } from '../services/position';
import { PREF } from './toolMemory';
import { SPEED_UNITS, SPEED_UNIT_KEYS, SpeedUnit, fromKnots, isSpeedUnit, toKnots } from './sensors';
import { useMemory } from './kit';

// A number field with a sensor button: the phone's GPS or compass fills in a course, and the GPS a speed. A speed field
// also has a unit menu (the tools work in knots; what is typed or read is converted). The store holds the value in the
// tool's own unit (degrees, or knots), so nothing downstream changes.

const clean = (n: number, dp: number) => String(Math.round(n * 10 ** dp) / 10 ** dp);

export const SensorField: React.FC<{ label: string; unit?: string; value: string; onChange: (s: string) => void; invalid?: boolean; sensor?: 'course' | 'speed'; units?: boolean }> = ({ label, unit, value, onChange, invalid, sensor, units }) => {
  const speed = sensor === 'speed' || units;
  const [rawUnit, setRawUnit] = useMemory<string>(`${PREF}speedunit`, 'kn');
  const su: SpeedUnit = isSpeedUnit(rawUnit) ? rawUnit : 'kn';
  const [source, setSource] = useMemory<'gps' | 'compass'>(`${PREF}coursesource`, 'gps');
  const show = (v: string) => (speed && v.trim() !== '' && Number.isFinite(parseFloat(v)) ? clean(fromKnots(parseFloat(v), su), 3) : v);
  const [text, setText] = useState(() => show(value));
  const [note, setNote] = useState<{ msg: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // follow a change made elsewhere (clear-all, a sensor reading) and a change of unit, but not our own echo
  useEffect(() => {
    const stored = text.trim() === '' || !Number.isFinite(parseFloat(text)) ? text : clean(speed ? toKnots(parseFloat(text), su) : parseFloat(text), 4);
    if (stored !== value) setText(show(value));
  }, [value, su]);   // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (s: string) => {
    setText(s); setNote(null);
    const n = parseFloat(s);
    onChange(s.trim() === '' || !Number.isFinite(n) ? s : clean(speed ? toKnots(n, su) : n, 4));
  };
  const fill = async () => {
    setBusy(true); setNote(null);
    try {
      if (sensor === 'course' && source === 'compass') {
        const h = await readCompass();
        onChange(clean(h.heading, 0));
        setNote({ msg: `Phone compass (magnetic), ${Math.round(h.heading)}°${h.spreadDeg > 5 ? `, unsteady by ±${Math.round(h.spreadDeg)}°: hold the phone level and still` : ''}. Check it against the ship's compass.`, bad: h.spreadDeg > 5 });
      } else {
        const p = await getPosition();
        if (sensor === 'course') {
          if (p.courseDeg === null || (p.speedKn ?? 0) < 0.5) setNote({ msg: 'GPS gives no course while the ship is hardly moving. Use the compass instead, or enter it.', bad: true });
          else { onChange(clean(p.courseDeg, 0)); setNote({ msg: `GPS course over the ground, ${Math.round(p.courseDeg)}° (true), at ${(p.speedKn ?? 0).toFixed(1)} kn.`, bad: false }); }
        } else if (p.speedKn === null) setNote({ msg: 'GPS gives no speed yet. Try again in a moment.', bad: true });
        else { onChange(clean(p.speedKn, 4)); setNote({ msg: `GPS speed over the ground, ${p.speedKn.toFixed(1)} kn (GPS to ${Math.round(p.accuracyM)} m).`, bad: false }); }
      }
    } catch (e) { setNote({ msg: e instanceof Error ? e.message : String(e), bad: true }); }
    finally { setBusy(false); }
  };

  const Icon = sensor === 'speed' ? Gauge : source === 'compass' ? Compass : LocateFixed;
  return (
    <div className="block space-y-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}{!speed && unit ? ` (${unit})` : ''}</span>
      <div className="flex gap-1.5">
        <input type="number" inputMode="decimal" step="any" value={text} onChange={e => edit(e.target.value)} aria-label={label}
          className={`min-w-0 flex-1 p-3 rounded-xl border bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400 ${invalid ? 'border-red-400' : 'border-slate-200'}`} />
        {speed && (
          <select value={su} onChange={e => setRawUnit(e.target.value)} aria-label={`${label} unit`} className="shrink-0 w-[4.6rem] p-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-blue-400">
            {SPEED_UNIT_KEYS.map(k => <option key={k} value={k}>{SPEED_UNITS[k].label}</option>)}
          </select>
        )}
        {sensor && (
          <button type="button" onClick={fill} disabled={busy} aria-label={sensor === 'course' ? `Take ${label} from the ${source === 'compass' ? 'phone compass' : 'GPS'}` : `Take ${label} from the GPS`}
            title={sensor === 'course' ? (source === 'compass' ? 'Take from the phone compass' : 'Take from the GPS') : 'Take from the GPS'}
            className={`shrink-0 w-12 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center active:scale-95 disabled:opacity-50 ${busy ? 'animate-pulse' : ''}`}><Icon size={18} /></button>
        )}
      </div>
      {sensor === 'course' && (
        <div className="flex gap-1">
          {(['gps', 'compass'] as const).map(k => (
            <button type="button" key={k} onClick={() => { setSource(k); setNote(null); }} aria-pressed={source === k}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold border ${source === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{k === 'gps' ? 'GPS course' : 'Phone compass'}</button>
          ))}
        </div>
      )}
      {note && <p className={`text-[11px] font-medium leading-snug ${note.bad ? 'text-amber-600' : 'text-slate-500'}`}>{note.msg}</p>}
    </div>
  );
};
