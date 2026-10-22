// Fuel planning from the ship's own fuel data: for each engine regime, a table of RPM, speed (knots) and fuel consumption (tonnes an hour).
// The data is typed in by the ship (see FuelDataEditor); nothing here is assumed. Pure; `node tools/fuel.check.ts`.

export interface FuelRow { rpm: string; speed: string; rate: string }       // typed text; speed in knots, rate in tonnes an hour
export interface FuelRegime { id: string; name: string; rows: FuelRow[] }
export interface FuelData { regimes: FuelRegime[]; /** total capacity, tonnes, optional */ capacity?: string; /** the price or density is not needed: rates are in tonnes */ note?: string }

export interface Point { rpm: string; speed: number; rate: number }
const num = (s: string | undefined): number | null => { if (s === undefined || s.trim() === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };

/** The rows of a regime that are complete (a speed and a rate), as numbers. A row needs no RPM to be used by speed. */
export const points = (r: FuelRegime): Point[] => r.rows.flatMap(row => { const speed = num(row.speed), rate = num(row.rate); return speed !== null && rate !== null && speed >= 0 && rate >= 0 ? [{ rpm: row.rpm.trim(), speed, rate }] : []; }).sort((a, b) => a.speed - b.speed);

/** The row for an RPM (text match, so '80' and '80.0' agree). */
export const byRpm = (r: FuelRegime, rpm: string): Point | null => {
  const want = num(rpm);
  return points(r).find(p => (want !== null && num(p.rpm) === want) || p.rpm === rpm.trim()) ?? null;
};

export interface AtSpeed { speed: number; rate: number; /** true when the speed is outside the tabulated range (not extrapolated: the nearest row is used) */ outside: boolean }
/** Fuel rate at a speed: between two rows by straight-line interpolation; outside the table the nearest row is used and flagged. */
export function bySpeed(r: FuelRegime, speed: number): AtSpeed | null {
  const p = points(r);
  if (!p.length) return null;
  if (speed <= p[0].speed) return { speed, rate: p[0].rate, outside: speed < p[0].speed };
  const last = p[p.length - 1];
  if (speed >= last.speed) return { speed, rate: last.rate, outside: speed > last.speed };
  const i = p.findIndex(x => x.speed >= speed);
  const a = p[i - 1], b = p[i], t = (speed - a.speed) / (b.speed - a.speed);
  return { speed, rate: a.rate + (b.rate - a.rate) * t, outside: false };
}

export interface Endurance { hours: number; distanceNm: number }
/** Forward: how far the fuel left will take her at this speed and consumption. */
export const endurance = (fuelTonnes: number, speed: number, rate: number): Endurance | null => (rate > 0 && speed >= 0 ? { hours: fuelTonnes / rate, distanceNm: (fuelTonnes / rate) * speed } : null);
export interface Passage { hours: number; fuelTonnes: number }
/** Reverse: the time and fuel for a distance at this speed and consumption. */
export const passage = (distanceNm: number, speed: number, rate: number): Passage | null => (speed > 0 ? { hours: distanceNm / speed, fuelTonnes: (distanceNm / speed) * rate } : null);
/** Fuel used per mile (tonnes) at a speed and rate: how economical it is. */
export const perMile = (speed: number, rate: number): number | null => (speed > 0 ? rate / speed : null);

export const hm = (hours: number): string => { const m = Math.round(hours * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

/** A blank template: three regimes to fill in, each with four empty rows. The names are only suggestions; rename or delete them. */
export const templateData = (): FuelData => ({
  regimes: ['Cruise', 'Boost', 'Combined'].map((name, i) => ({ id: `r${i + 1}`, name, rows: Array.from({ length: 4 }, () => ({ rpm: '', speed: '', rate: '' })) })),
  capacity: '',
});
