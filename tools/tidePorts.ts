// Ports, the tides the user copies from the Indian Tide Tables, and secondary ports worked from a standard port by the
// book's time and height differences. The app carries no tidal figures of its own: only port names and rough positions
// (to pick the nearest port). Pure; `node tools/tidePorts.check.ts` checks it.
import type { Tide } from './tides.ts';

/** A port. Secondary ports name their standard port and give the book's differences (time in minutes, height in metres, signed). */
export interface Port {
  name: string;
  /** rough position in decimal degrees, only used to pick the nearest port */
  lat?: number; lon?: number;
  /** a secondary port: the standard port it is worked from */
  ref?: string;
  dtHw?: number; dtLw?: number; dhHw?: number; dhLw?: number;
}

/** One tide as copied from the tables: the clock time "HH:MM" in the table's zone, and the height in metres. */
export interface DayTide { time: string; h: number }

/** Principal and other ports of India, by name and approximate position. The user marks which are secondary and adds the differences. */
export const SEED_PORTS: Port[] = [
  { name: 'Kandla', lat: 23.03, lon: 70.22 }, { name: 'Mundra', lat: 22.74, lon: 69.72 }, { name: 'Okha', lat: 22.47, lon: 69.08 },
  { name: 'Porbandar', lat: 21.63, lon: 69.61 }, { name: 'Veraval', lat: 20.9, lon: 70.37 }, { name: 'Bhavnagar', lat: 21.77, lon: 72.15 },
  { name: 'Hazira', lat: 21.1, lon: 72.62 }, { name: 'Mumbai', lat: 18.92, lon: 72.84 }, { name: 'Jawaharlal Nehru Port', lat: 18.95, lon: 72.95 },
  { name: 'Ratnagiri', lat: 16.99, lon: 73.28 }, { name: 'Mormugao', lat: 15.41, lon: 73.8 }, { name: 'Karwar', lat: 14.81, lon: 74.12 },
  { name: 'New Mangalore', lat: 12.93, lon: 74.81 }, { name: 'Kochi', lat: 9.97, lon: 76.27 }, { name: 'Vizhinjam', lat: 8.38, lon: 77.0 },
  { name: 'Tuticorin', lat: 8.75, lon: 78.2 }, { name: 'Chennai', lat: 13.1, lon: 80.3 }, { name: 'Puducherry', lat: 11.93, lon: 79.83 },
  { name: 'Visakhapatnam', lat: 17.69, lon: 83.3 }, { name: 'Kakinada', lat: 16.95, lon: 82.28 }, { name: 'Paradip', lat: 20.27, lon: 86.69 },
  { name: 'Haldia', lat: 22.03, lon: 88.07 }, { name: 'Diamond Harbour', lat: 22.19, lon: 88.19 }, { name: 'Kolkata', lat: 22.54, lon: 88.31 },
  { name: 'Port Blair', lat: 11.68, lon: 92.74 }, { name: 'Kavaratti', lat: 10.57, lon: 72.64 },
];

/** Distance in nautical miles (great circle) between two positions. */
export function distanceNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180, dlat = r(b.lat - a.lat), dlon = r(b.lon - a.lon);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dlon / 2) ** 2;
  return (2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function nearestPort(at: { lat: number; lon: number }, ports: Port[]): { port: Port; nm: number } | null {
  let best: { port: Port; nm: number } | null = null;
  for (const p of ports) {
    if (p.lat === undefined || p.lon === undefined) continue;
    const nm = distanceNm(at, { lat: p.lat, lon: p.lon });
    if (!best || nm < best.nm) best = { port: p, nm };
  }
  return best;
}

export const clockHours = (s: string): number | null => {
  const m = /^(\d{1,2}):?(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h + mi / 60 + (m[3] ? +m[3] / 3600 : 0);
};

/** Sorted tides in hours from midnight of the middle day: the previous day sits at -24, the next at +24. Rows that cannot be read are skipped. */
export function timeline(days: { offset: number; tides: DayTide[] }[]): Tide[] {
  const out: Tide[] = [];
  for (const d of days) for (const t of d.tides) {
    const c = clockHours(t.time);
    if (c !== null && Number.isFinite(t.h)) out.push({ t: d.offset + c, h: t.h });
  }
  return out.sort((x, y) => x.t - y.t);
}

/** True for a high water: higher than the tide after it (or, for the last one, the tide before it). Needs two tides. */
export function highWaters(tides: Tide[]): boolean[] {
  return tides.map((x, i) => (i < tides.length - 1 ? x.h > tides[i + 1].h : tides.length > 1 ? x.h > tides[i - 1].h : false));
}

/** The secondary port's tides from the standard port's, by the book's differences. */
export function secondaryTides(std: Tide[], port: Port): Tide[] {
  const hw = highWaters(std);
  return std.map((x, i) => ({
    t: x.t + ((hw[i] ? port.dtHw : port.dtLw) ?? 0) / 60,
    h: x.h + ((hw[i] ? port.dhHw : port.dhLw) ?? 0),
  }));
}

/** The two tides either side of time `t` (hours), or null when it is before the first or after the last. */
export function around(tides: Tide[], t: number): [Tide, Tide] | null {
  for (let i = 0; i < tides.length - 1; i++) if (t >= tides[i].t && t <= tides[i + 1].t) return [tides[i], tides[i + 1]];
  return null;
}

/** The next high water and low water after time `t`, for the day's list. */
export function nextTides(tides: Tide[], t: number): { hw: Tide | null; lw: Tide | null } {
  const hw = highWaters(tides);
  return { hw: tides.find((x, i) => x.t > t && hw[i]) ?? null, lw: tides.find((x, i) => x.t > t && !hw[i] && tides.length > 1) ?? null };
}
