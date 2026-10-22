// What a new calibration record starts with, taken from the ship's own data: her particulars (the wing repeater's distances), and what she entered last time for that kind of
// record (the radar and its scale, the repeater and its distances, the sounder, the log runs). Everything stays editable on the form.
// Pure; `node tools/recordDefaults.check.ts`.

import type { Ship, SimpleRecord } from '../types.ts';

type Kind = 'radarIndex' | 'radarBearing' | 'speedLog' | 'lubberLine' | 'echoSounder';
/** The form fields carried over from the ship's last record of each kind. */
const CARRY: Record<Kind, string[]> = {
  radarIndex: ['radar_name', 'scale', 'unit', 'method'],
  radarBearing: ['radar_name'],
  speedLog: ['runs', 'dist'],
  lubberLine: ['repeater', 'method', 'side', 'offset', 'ahead'],
  echoSounder: ['sounder', 'method'],
};

const latest = (list: SimpleRecord[] | undefined): SimpleRecord | undefined => {
  let best: SimpleRecord | undefined;
  for (const r of list ?? []) if (r.fields && (!best || (r.date ?? '') >= (best.date ?? ''))) best = r;
  return best;
};
const LIST: Record<Kind, 'radarIndex' | 'radarBearing' | 'speedLog' | 'lubberLine' | 'echoSounder'> = { radarIndex: 'radarIndex', radarBearing: 'radarBearing', speedLog: 'speedLog', lubberLine: 'lubberLine', echoSounder: 'echoSounder' };
const metres = (v: number | undefined) => (v !== undefined && Number.isFinite(v) && v > 0 ? String(Math.round(v * 10) / 10) : undefined);

export function recordDefaults(kind: string, ship: Pick<Ship, 'particulars' | 'radarIndex' | 'radarBearing' | 'speedLog' | 'lubberLine' | 'echoSounder'>): Record<string, string> {
  if (!(kind in CARRY)) return {};
  const k = kind as Kind, out: Record<string, string> = {};
  const last = latest(ship[LIST[k]]);
  for (const key of CARRY[k]) if (last?.fields?.[key] !== undefined && last.fields[key] !== '') out[key] = last.fields[key];
  if (k === 'lubberLine') {
    // the ship's own data comes first: the repeater's offset and its distance to the Jackstaff, once they are in her particulars; otherwise the last record, then stem to bridge
    const off = metres(ship.particulars.repeaterOffset), ahead = metres(ship.particulars.repeaterToJackstaff);
    if (off) out.offset = off;
    if (ahead) out.ahead = ahead;
    else if (out.ahead === undefined) { const a = metres(ship.particulars.stemToBridge); if (a) out.ahead = a; }
  }
  return out;
}
