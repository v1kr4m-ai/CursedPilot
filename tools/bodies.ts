// Apparent places of Venus, Mars, Jupiter, Saturn and the Moon for any date and time: GHA, declination, horizontal
// parallax, semi-diameter and magnitude, calculated on the device. Planets: truncated VSOP87B (about an arcsecond),
// corrected for light time, with precession, nutation and aberration as for the stars. Moon: Meeus ch. 47 (about 10").
// Both are well inside the 0.1' the Nautical Almanac is given to. Pure; `node tools/bodies.check.ts` checks them against
// the worked examples in Meeus.
import { MOON_B, MOON_LR } from './moonData.ts';
import { VSOP } from './planetData.ts';
import type { Vsop } from './planetData.ts';
import { apparentFromJ2000 } from './stars.ts';
import { deltaT, gast, meanObliquity, nutation } from './sunEphemeris.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (d: number) => ((d % 360) + 360) % 360;

export const PLANET_NAMES = ['Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export type PlanetName = (typeof PLANET_NAMES)[number];
export type BodyName = PlanetName | 'Moon';
export const BODY_NAMES: readonly BodyName[] = [...PLANET_NAMES, 'Moon'];
export const isBodyName = (s: string): s is BodyName => (BODY_NAMES as readonly string[]).includes(s);

export interface BodyPlace {
  /** Greenwich hour angle and declination, degrees */
  gha: number; dec: number;
  /** right ascension (apparent), degrees */
  ra: number;
  /** horizontal parallax, degrees */
  hp: number;
  /** semi-diameter, degrees (the Moon; planets are sighted at their centres) */
  sd: number;
  /** apparent magnitude */
  mag: number;
  /** distance from the Earth: AU for planets, km for the Moon */
  distance: number;
}

// ---- planets -------------------------------------------------------------------------------------------------------

function vsop(v: Vsop, tau: number): { l: number; b: number; r: number } {
  const sum = (series: number[][][]) => series.reduce((acc, terms, k) => acc + Math.pow(tau, k) * terms.reduce((s, [a, b, c]) => s + a * Math.cos(b + c * tau), 0), 0);
  return { l: sum(v.L), b: sum(v.B), r: sum(v.R) };
}

/** heliocentric rectangular ecliptic coordinates (J2000), AU, with the radius */
function helio(name: string, jde: number) {
  const { l, b, r } = vsop(VSOP[name], (jde - 2451545) / 365250);
  return { x: r * Math.cos(b) * Math.cos(l), y: r * Math.cos(b) * Math.sin(l), z: r * Math.sin(b), r };
}

const EPS_J2000 = rad(23.4392911);

/** Meeus ch. 41 magnitudes (the rings of Saturn are not allowed for) */
function planetMagnitude(name: PlanetName, r: number, delta: number, sunEarth: number): number {
  const i = deg(Math.acos((r * r + delta * delta - sunEarth * sunEarth) / (2 * r * delta)));
  const base = 5 * Math.log10(r * delta);
  switch (name) {
    case 'Venus': return -4.4 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
    case 'Mars': return -1.52 + base + 0.016 * i;
    case 'Jupiter': return -9.4 + base + 0.005 * i;
    default: return -8.88 + base + 0.044 * i;
  }
}

/** Apparent right ascension, declination (degrees), distance (AU) and magnitude of a planet at a dynamical Julian day. */
export function planetApparent(name: PlanetName, jde: number): { ra: number; dec: number; delta: number; mag: number } {
  const earth = helio('earth', jde);
  let tau = 0, x = 0, y = 0, z = 0, delta = 0, p = helio(name.toLowerCase(), jde);
  for (let k = 0; k < 4; k++) {
    p = helio(name.toLowerCase(), jde - tau);
    x = p.x - earth.x; y = p.y - earth.y; z = p.z - earth.z;
    delta = Math.hypot(x, y, z);
    tau = 0.0057755183 * delta;
  }
  const xe = x, ye = y * Math.cos(EPS_J2000) - z * Math.sin(EPS_J2000), ze = y * Math.sin(EPS_J2000) + z * Math.cos(EPS_J2000);
  const ra2000 = mod360(deg(Math.atan2(ye, xe))), dec2000 = deg(Math.asin(ze / delta));
  const { ra, dec } = apparentFromJ2000(ra2000, dec2000, 0, 0, jde);
  return { ra, dec, delta, mag: planetMagnitude(name, p.r, delta, earth.r) };
}

// ---- the Moon ------------------------------------------------------------------------------------------------------

const horner = (t: number, ...c: number[]) => c.reduceRight((acc, k) => acc * t + k, 0);

/** Geocentric longitude and latitude of the Moon (degrees, mean equinox of date, no nutation) and distance (km), Meeus ch. 47. */
export function moonGeometric(jde: number): { lon: number; lat: number; distance: number } {
  const T = (jde - 2451545) / 36525;
  const lp = rad(horner(T, 218.3164477, 481267.88123421, -0.0015786, 1 / 538841, -1 / 65194000));
  const d = rad(horner(T, 297.8501921, 445267.1114034, -0.0018819, 1 / 545868, -1 / 113065000));
  const m = rad(horner(T, 357.5291092, 35999.0502909, -0.0001536, 1 / 24490000));
  const mp = rad(horner(T, 134.9633964, 477198.8675055, 0.0087414, 1 / 69699, -1 / 14712000));
  const f = rad(horner(T, 93.272095, 483202.0175233, -0.0036539, -1 / 3526000, 1 / 863310000));
  const a1 = rad(119.75 + 131.849 * T), a2 = rad(53.09 + 479264.29 * T), a3 = rad(313.45 + 481266.484 * T);
  const e = horner(T, 1, -0.002516, -0.0000074), e2 = e * e;
  const w = (mm: number) => (mm === 0 ? 1 : Math.abs(mm) === 1 ? e : e2);

  let sl = 3958 * Math.sin(a1) + 1962 * Math.sin(lp - f) + 318 * Math.sin(a2), sr = 0;
  let sb = -2235 * Math.sin(lp) + 382 * Math.sin(a3) + 175 * Math.sin(a1 - f) + 175 * Math.sin(a1 + f) + 127 * Math.sin(lp - mp) - 115 * Math.sin(lp + mp);
  for (const [dd, mm, mmp, ff, cl, cr] of MOON_LR) {
    const arg = dd * d + mm * m + mmp * mp + ff * f;
    sl += cl * Math.sin(arg) * w(mm); sr += cr * Math.cos(arg) * w(mm);
  }
  for (const [dd, mm, mmp, ff, cb] of MOON_B) sb += cb * Math.sin(dd * d + mm * m + mmp * mp + ff * f) * w(mm);
  return { lon: mod360(deg(lp) + sl * 1e-6), lat: sb * 1e-6, distance: 385000.56 + sr * 1e-3 };
}

/** Apparent right ascension and declination (degrees), distance (km), horizontal parallax and semi-diameter (degrees) of the Moon at a dynamical Julian day. */
export function moonApparent(jde: number): { ra: number; dec: number; distance: number; hp: number; sd: number } {
  const g = moonGeometric(jde), T = (jde - 2451545) / 36525;
  const { dpsi, deps } = nutation(T);
  const lon = rad(g.lon + dpsi / 3600), lat = rad(g.lat), eps = rad(meanObliquity(T) + deps / 3600);
  const ra = mod360(deg(Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon))));
  const dec = deg(Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon)));
  const sinHp = 6378.14 / g.distance;
  return { ra, dec, distance: g.distance, hp: deg(Math.asin(sinHp)), sd: deg(Math.asin(0.2725076 * sinHp)) };
}

// ---- any of them at a UT Julian day ---------------------------------------------------------------------------------

export function bodyAt(name: BodyName, jdUT: number): BodyPlace {
  const jde = jdUT + deltaT(2000 + (jdUT - 2451545) / 365.25) / 86400;
  const aries = gast(jdUT);
  if (name === 'Moon') {
    const m = moonApparent(jde);
    return { gha: mod360(aries - m.ra), dec: m.dec, ra: m.ra, hp: m.hp, sd: m.sd, mag: -12, distance: m.distance };
  }
  const p = planetApparent(name, jde);
  return { gha: mod360(aries - p.ra), dec: p.dec, ra: p.ra, hp: (8.794 / 3600) / p.delta, sd: 0, mag: p.mag, distance: p.delta };
}
