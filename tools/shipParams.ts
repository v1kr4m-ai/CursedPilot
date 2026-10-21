// The parameters of the selected ship that the NavYeo tools use as their starting values. Everything here is optional: a
// ship that lacks a figure simply gives none, and the tool asks for it by hand. Pure; `node tools/shipParams.check.ts` checks it.
import type { Ship, SimpleRecord } from '../types.ts';
import { coefficients, readDeviations } from './compassSwing.ts';
import type { Coefficients } from './compassSwing.ts';

export interface ShipParams {
  /** metres */
  length?: number; breadth?: number; stemToStandard?: number; stemToBridge?: number; draught?: number;
  /** tonnes */
  displacement?: number;
  /** knots */
  maxSpeed?: number;
  /** metres: a particular called "Height of eye" (or "H.O.E.") added under the ship's extra particulars */
  heightOfEye?: number;
  /** shackles of cable the anchor can veer: an extra particular whose heading mentions the cable or shackles */
  cableShackles?: number;
  /** what the cable is made of, when the ship's particulars say */
  cableType?: 'steel' | 'bronze';
  /** metres the ship runs while slowing, per knot lost, from her deceleration runs */
  decelMetresPerKnot?: number;
  /** the compass swing's coefficients, from the latest swing with all eight headings */
  swing?: Coefficients;
}

const pos = (n: unknown): number | undefined => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);
/** the first number in a piece of free text ("5.5 m", "about 30 knots") */
export const firstNumber = (s: string | undefined): number | undefined => {
  const m = /\d+(?:\.\d+)?/.exec(s ?? '');
  return m ? pos(parseFloat(m[0])) : undefined;
};

const asMetres = (value: string, unit: string | undefined): number | undefined => {
  const v = firstNumber(value);
  if (v === undefined) return undefined;
  const u = (unit ?? 'm').trim().toLowerCase();
  if (/^(ft|feet|foot)$/.test(u)) return v * 0.3048;
  if (/^(yd|yds|yards?)$/.test(u)) return v * 0.9144;
  if (/^(fm|fathoms?)$/.test(u)) return v * 1.8288;
  return v;
};

/** Metres per knot lost, taken from the latest deceleration run that gives a distance. */
function decelPerKnot(records: SimpleRecord[]): number | undefined {
  const runs = records.filter(r => /decel/i.test(r.fields?.type ?? '') && firstNumber(r.fields?.distance) !== undefined);
  const r = [...runs].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
  if (!r) return undefined;
  const from = parseFloat(r.fields?.from ?? ''), to = parseFloat(r.fields?.to ?? ''), d = firstNumber(r.fields?.distance);
  return Number.isFinite(from) && Number.isFinite(to) && from > to && d !== undefined ? d / (from - to) : undefined;
}

export function shipParams(ship?: Ship): ShipParams {
  if (!ship) return {};
  const p = ship.particulars, out: ShipParams = {
    length: pos(p?.lengthOverall) ?? firstNumber(ship.info?.length), breadth: pos(p?.breadthOverall) ?? firstNumber(ship.info?.beam),
    stemToStandard: pos(p?.stemToStandard), stemToBridge: pos(p?.stemToBridge), displacement: pos(p?.displacement) ?? firstNumber(ship.info?.displacement),
    draught: firstNumber(ship.info?.draught), maxSpeed: firstNumber(ship.info?.speed),
    // the dedicated particulars first; an extra particular with the right heading still works for ships set up before they existed
    heightOfEye: pos(p?.heightOfEye), cableShackles: pos(p?.anchorCableShackles), cableType: p?.anchorCableType === 'bronze' || p?.anchorCableType === 'steel' ? p.anchorCableType : undefined,
  };
  for (const c of ship.custom ?? []) {
    if (c.group !== 'particulars') continue;
    if (/height\s*of\s*eye|\bh\.?o\.?e\b/i.test(c.label) && out.heightOfEye === undefined) out.heightOfEye = asMetres(c.value, c.unit);
    if (/shackle|anchor cable|cable (length|available)/i.test(c.label) && out.cableShackles === undefined) out.cableShackles = firstNumber(c.value);
  }
  out.decelMetresPerKnot = decelPerKnot(ship.accelDecelData ?? []);
  const swings = [...(ship.compassSwing ?? [])].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  for (const s of swings) { const c = coefficients(readDeviations(s.fields)); if (c) { out.swing = c; break; } }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as ShipParams;
}
