// Apparent places of the 57 navigational stars for any date and time: proper motion, precession, nutation and annual
// aberration (Meeus, Astronomical Algorithms ch. 21 and 23), giving SHA and declination as the Nautical Almanac
// tabulates them, to a few seconds of arc. Pure; `node tools/stars.check.ts` checks it against Meeus's worked example.
import { STAR_ROWS } from './starCatalog.ts';
import { deltaT, gast, meanObliquity, nutation, sunTrueLongitude } from './sunEphemeris.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (d: number) => ((d % 360) + 360) % 360;

export interface Star {
  /** number in the Nautical Almanac list, 1 to 57 */
  no: number;
  name: string;
  hip: number;
  /** ICRS position at epoch J1991.25, degrees */
  ra0: number; dec0: number;
  /** proper motion, milliarcseconds a year (pmRa already times cos Dec) */
  pmRa: number; pmDec: number;
  /** visual magnitude */
  v: number;
}

export const STARS: readonly Star[] = STAR_ROWS.map(([no, name, hip, ra0, dec0, pmRa, pmDec, v]) => ({ no, name, hip, ra0, dec0, pmRa, pmDec, v }));
export const starByName = (name: string): Star | undefined => STARS.find(s => s.name.toLowerCase() === name.trim().toLowerCase());

/**
 * Apparent right ascension and declination (degrees) of a star given at J2000.0, at `jde` (a Julian day in dynamical time).
 * `pmRaDeg` is the rate of right ascension itself (not multiplied by cos Dec), `pmDecDeg` the declination rate, degrees a year.
 */
export function apparentFromJ2000(ra2000: number, dec2000: number, pmRaDeg: number, pmDecDeg: number, jde: number): { ra: number; dec: number } {
  const T = (jde - 2451545) / 36525, years = T * 100;
  const a0 = rad(ra2000 + pmRaDeg * years), d0 = rad(dec2000 + pmDecDeg * years);

  // precession from J2000 to the date
  const zeta = rad((2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600);
  const z = rad((2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600);
  const theta = rad((2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600);
  const A = Math.cos(d0) * Math.sin(a0 + zeta);
  const B = Math.cos(theta) * Math.cos(d0) * Math.cos(a0 + zeta) - Math.sin(theta) * Math.sin(d0);
  const C = Math.sin(theta) * Math.cos(d0) * Math.cos(a0 + zeta) + Math.cos(theta) * Math.sin(d0);
  let a = Math.atan2(A, B) + z, d = Math.asin(C);

  // nutation and aberration (arcseconds)
  const eps = rad(meanObliquity(T));
  const { dpsi, deps } = nutation(T);
  const dA1 = (Math.cos(eps) + Math.sin(eps) * Math.sin(a) * Math.tan(d)) * dpsi - Math.cos(a) * Math.tan(d) * deps;
  const dD1 = Math.sin(eps) * Math.cos(a) * dpsi + Math.sin(a) * deps;
  const k = 20.49552, sun = rad(sunTrueLongitude(T));
  const dA2 = (-k * (Math.cos(a) * Math.cos(sun) * Math.cos(eps) + Math.sin(a) * Math.sin(sun))) / Math.cos(d);
  const dD2 = -k * (Math.cos(sun) * Math.cos(eps) * (Math.tan(eps) * Math.cos(d) - Math.sin(a) * Math.sin(d)) + Math.cos(a) * Math.sin(d) * Math.sin(sun));
  a += rad((dA1 + dA2) / 3600);
  d += rad((dD1 + dD2) / 3600);
  return { ra: mod360(deg(a)), dec: deg(d) };
}

export interface StarPlace {
  /** sidereal hour angle, degrees (360 - right ascension) */
  sha: number;
  dec: number;
  /** Greenwich hour angle of Aries, degrees */
  ariesGha: number;
  /** Greenwich hour angle of the star */
  gha: number;
}

/** The star at a UT Julian day. */
export function starAt(s: Star, jdUT: number): StarPlace {
  const jde = jdUT + deltaT(2000 + (jdUT - 2451545) / 365.25) / 86400;
  // positions are at J1991.25: bring them to J2000.0 by proper motion, then everything else follows from J2000
  const cosD = Math.cos(rad(s.dec0)), dtYears = 2000 - 1991.25;
  const ra2000 = s.ra0 + (s.pmRa / 3.6e6 / cosD) * dtYears, dec2000 = s.dec0 + (s.pmDec / 3.6e6) * dtYears;
  const { ra, dec } = apparentFromJ2000(ra2000, dec2000, s.pmRa / 3.6e6 / cosD, s.pmDec / 3.6e6, jde);
  const ariesGha = gast(jdUT);
  const sha = mod360(360 - ra);
  return { sha, dec, ariesGha, gha: mod360(ariesGha + sha) };
}
