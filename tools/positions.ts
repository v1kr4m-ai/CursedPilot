// Positions on the Earth: distance and bearing between two latitudes and longitudes (great circle and rhumb line, that is Mercator sailing), a
// position from a start, course and distance, and a latitude or longitude written as decimal degrees, degrees and minutes, or degrees minutes seconds.
// The Earth is taken as a sphere with a nautical mile for each minute of arc (radius 10800 / pi nm), the usual basis of navigation sums, so a degree
// of latitude is exactly 60 nm. The difference from the spheroid is a few tenths of a percent at most: use the official tables for a fix that matters.
// Pure; `node tools/positions.ts` is checked by positions.check.ts.

export interface Pos { lat: number; lon: number }

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
/** Earth radius in nautical miles when 1 nm is 1' of arc. */
export const R_NM = 10800 / Math.PI;
export const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** A longitude brought into -180..180. */
export const normLon = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;

export interface GreatCircle { distance: number; initial: number; final: number }
/** Great-circle distance (nm) and the true course at the start and at the finish. Returns null for identical positions. */
export function greatCircle(a: Pos, b: Pos): GreatCircle | null {
  const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = R_NM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  if (distance < 1e-9) return null;
  const initial = norm360(deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))));
  const back = norm360(deg(Math.atan2(Math.sin(-dl) * Math.cos(p1), Math.cos(p2) * Math.sin(p1) - Math.sin(p2) * Math.cos(p1) * Math.cos(-dl))));
  return { distance, initial, final: norm360(back + 180) };
}

/** Isometric (Mercator) latitude difference, radians. */
const dPsi = (p1: number, p2: number) => Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));

export interface Rhumb { distance: number; course: number; /** minutes of arc: change of latitude (+N) and of longitude (+E, the short way round) */ dLat: number; dLong: number; /** departure, nm: the easting made good */ departure: number }
/** Rhumb-line (Mercator sailing) distance in nm and the constant true course. Null for identical positions or a pole. */
export function rhumb(a: Pos, b: Pos): Rhumb | null {
  if (Math.abs(a.lat) >= 90 || Math.abs(b.lat) >= 90) return null;
  const p1 = rad(a.lat), p2 = rad(b.lat), dp = p2 - p1, dl = rad(normLon(b.lon - a.lon));
  const ps = dPsi(p1, p2), q = Math.abs(ps) > 1e-12 ? dp / ps : Math.cos(p1);
  const distance = R_NM * Math.hypot(dp, q * dl);
  if (distance < 1e-9) return null;
  return { distance, course: norm360(deg(Math.atan2(dl, ps))), dLat: deg(dp) * 60, dLong: deg(dl) * 60, departure: R_NM * q * dl };
}

/** The position reached by steering a rhumb line (Mercator sailing) on `course` for `distance` nm. */
export function rhumbDestination(a: Pos, course: number, distance: number): Pos | null {
  if (Math.abs(a.lat) >= 90) return null;
  const p1 = rad(a.lat), t = rad(course), d = distance / R_NM;
  const p2 = p1 + d * Math.cos(t);
  if (Math.abs(p2) >= Math.PI / 2) return null;                          // would run over a pole
  const ps = dPsi(p1, p2), q = Math.abs(ps) > 1e-12 ? (p2 - p1) / ps : Math.cos(p1);
  return { lat: deg(p2), lon: normLon(a.lon + deg((d * Math.sin(t)) / q)) };
}

/** The position reached along a great circle that leaves on `course` for `distance` nm. */
export function greatCircleDestination(a: Pos, course: number, distance: number): Pos {
  const p1 = rad(a.lat), t = rad(course), d = distance / R_NM;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = rad(a.lon) + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: deg(p2), lon: normLon(deg(l2)) };
}

// ---- writing a latitude or longitude -----------------------------------------------------------------

const hemi = (v: number, kind: 'lat' | 'lon') => (kind === 'lat' ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E'));
const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** 51.475 -> "51.47500° N" (five decimals, about a metre). */
export function decimalDegrees(v: number, kind: 'lat' | 'lon'): string {
  return `${Math.abs(v).toFixed(5)}° ${hemi(v, kind)}`;
}
/** 51.475 -> "51° 28.500' N". */
export function degMinutes(v: number, kind: 'lat' | 'lon', places = 3): string {
  const a = Math.abs(v), unit = 10 ** places;
  let d = Math.floor(a), m = Math.round((a - d) * 60 * unit) / unit;
  if (m >= 60) { d += 1; m = 0; }
  return `${pad(d, kind === 'lat' ? 2 : 3)}° ${m.toFixed(places).padStart(places + 3, '0')}' ${hemi(v, kind)}`;
}
/** 51.475 -> `51° 28' 30.0" N`. */
export function degMinSec(v: number, kind: 'lat' | 'lon', places = 1): string {
  const a = Math.abs(v), unit = 10 ** places;
  let d = Math.floor(a), rest = (a - d) * 60, m = Math.floor(rest), s = Math.round((rest - m) * 60 * unit) / unit;
  if (s >= 60) { s = 0; m += 1; }
  if (m >= 60) { m = 0; d += 1; }
  return `${pad(d, kind === 'lat' ? 2 : 3)}° ${pad(m, 2)}' ${s.toFixed(places).padStart(places + 3, '0')}" ${hemi(v, kind)}`;
}

/** The distance, in the usual forms. */
export const hoursMinutes = (hours: number) => { const m = Math.round(hours * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${pad(m % 60, 2)} min` : `${m} min`; };
