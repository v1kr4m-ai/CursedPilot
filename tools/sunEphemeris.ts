// The Sun's Greenwich hour angle, declination, semi-diameter and distance for any date and time, worked out on the
// device (no almanac needed). Low-accuracy solar coordinates of Meeus, Astronomical Algorithms ch. 25, with the full
// IAU 1980 nutation for the sidereal time: good to about 0.01 degree (under one minute of arc), plenty for
// sextant work, but it is not the Nautical Almanac. Pure; `node tools/sunEphemeris.check.ts` checks it against
// the worked examples in Meeus.
import { NUTATION_TERMS } from './nutation.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (d: number) => ((d % 360) + 360) % 360;

/** Julian day of a UT calendar date and time (Gregorian calendar). */
export function julianDay(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): number {
  let y = year, m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
  const d = day + (hours + minutes / 60 + seconds / 3600) / 24;
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/** Inverse of julianDay, for showing times: [year, month, day, fractionOfDay]. */
export function calendarOf(jd: number): [number, number, number, number] {
  const z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
  const a = z < 2299161 ? z : z + 1 + Math.floor((z - 1867216.25) / 36524.25) - Math.floor(Math.floor((z - 1867216.25) / 36524.25) / 4);
  const b = a + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e), month = e < 14 ? e - 1 : e - 13, year = month > 2 ? c - 4716 : c - 4715;
  return [year, month, day, f];
}

/** TD - UT in seconds, polynomial of Espenak and Meeus for 2000-2050 (about 69 s now); a rough guide outside that. */
export function deltaT(year: number): number {
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

/** Nutation in longitude and obliquity (arcseconds) at T Julian centuries from J2000 (dynamical time). */
export function nutation(T: number): { dpsi: number; deps: number } {
  const D = 297.85036 + 445267.11148 * T - 0.0019142 * T * T + (T * T * T) / 189474;
  const M = 357.52772 + 35999.05034 * T - 0.0001603 * T * T - (T * T * T) / 300000;
  const Mp = 134.96298 + 477198.867398 * T + 0.0086972 * T * T + (T * T * T) / 56250;
  const F = 93.27191 + 483202.017538 * T - 0.0036825 * T * T + (T * T * T) / 327270;
  const O = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  let dpsi = 0, deps = 0;
  for (const [d, m, mp, f, o, a, b, c, e] of NUTATION_TERMS) {
    const arg = rad(d * D + m * M + mp * Mp + f * F + o * O);
    dpsi += (a + b * T) * Math.sin(arg);
    deps += (c + e * T) * Math.cos(arg);
  }
  return { dpsi: dpsi / 10000, deps: deps / 10000 };
}

/** Mean obliquity of the ecliptic, degrees. */
export const meanObliquity = (T: number): number =>
  23 + 26 / 60 + 21.448 / 3600 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;

/** Greenwich mean sidereal time in degrees at a UT Julian day. */
export function gmst(jdUT: number): number {
  const T = (jdUT - 2451545) / 36525;
  return mod360(280.46061837 + 360.98564736629 * (jdUT - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

export interface SunPosition {
  /** Greenwich hour angle, degrees west of Greenwich, 0-360 */
  gha: number;
  /** declination, degrees, + north */
  dec: number;
  /** right ascension (apparent), degrees */
  ra: number;
  /** semi-diameter, arcminutes */
  sd: number;
  /** distance from the Earth, astronomical units */
  r: number;
}

/** The Sun at a UT Julian day. `dt` is TD - UT in seconds (default: from the date). */
export function sunAt(jdUT: number, dt?: number): SunPosition {
  const [year] = calendarOf(jdUT);
  const jde = jdUT + (dt ?? deltaT(year)) / 86400;
  const T = (jde - 2451545) / 36525;

  const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(rad(M)) + (0.019993 - 0.000101 * T) * Math.sin(rad(2 * M)) + 0.000289 * Math.sin(rad(3 * M));
  const trueLon = L0 + C, v = M + C;
  const r = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(rad(v)));
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(rad(omega));          // apparent: aberration and nutation
  const eps = meanObliquity(T) + 0.00256 * Math.cos(rad(omega));

  const ra = mod360(deg(Math.atan2(Math.cos(rad(eps)) * Math.sin(rad(lambda)), Math.cos(rad(lambda)))));
  const dec = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));

  const { dpsi, deps } = nutation(T);
  const epsTrue = meanObliquity(T) + deps / 3600;
  const gast = mod360(gmst(jdUT) + (dpsi * Math.cos(rad(epsTrue))) / 3600);   // equation of the equinoxes

  return { gha: mod360(gast - ra), dec, ra, sd: 15.9938 / r, r };
}
