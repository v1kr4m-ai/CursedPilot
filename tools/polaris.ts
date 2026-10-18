// Latitude from Polaris: Lat = True altitude - 1 degree + (a0 + a1 + a2), where the Nautical Almanac gives a0, a1 and a2
// from three small tables. Here the whole correction is worked from Polaris's own position for the date, so no table is
// needed, and it equals the almanac's a0 + a1 + a2 (the book splits it three ways in its own way, so only the sum is
// shown). Pure; `node tools/polaris.check.ts` checks it.
//   first-order term  = - p cos(LHA)           p being Polaris's polar distance (about 0.7 deg)
//   second-order term = 1/2 p^2 sin^2(LHA) tan(Lat)
// The latitude is solved exactly from the altitude formula, so the correction is exact, not the series.
import { POLARIS, starAt } from './stars.ts';
import { starTrueAltitude } from './sunSights.ts';
import type { Conditions } from './sunSights.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (d: number) => ((d % 360) + 360) % 360;

export interface PolarisInput {
  /** Julian day (UT) of the sight */
  jd: number;
  /** DR longitude, degrees, east positive (only the hour angle depends on it) */
  lon: number;
  sextantDeg: number;
  cond: Conditions;
}

export interface PolarisResult {
  /** GHA of Aries, and LHA of Aries and of Polaris, degrees */
  ariesGha: number; lhaAries: number; lhaPolaris: number;
  sha: number; dec: number;
  /** polar distance in degrees */
  p: number;
  apparent: number; ho: number; refraction: number;
  /** latitude, degrees, north positive */
  lat: number;
  /** a0 + a1 + a2 of the almanac, arcminutes: Lat = Ho - 60' + this */
  sumA: number;
  /** the two terms of the series, arcminutes, for showing how the correction arises (the exact figure is `sumA`) */
  first: number; second: number;
  warnings: string[];
}

export function polarisLatitude(i: PolarisInput): PolarisResult {
  const warnings: string[] = [];
  const pl = starAt(POLARIS, i.jd);
  const lha = mod360(pl.gha + i.lon);
  const alt = starTrueAltitude(i.sextantDeg, i.cond);
  const p = 90 - pl.dec;

  // exact: sin Ho = sin Lat sin Dec + cos Lat cos Dec cos LHA, solved for Lat
  const f = (lat: number) => deg(Math.asin(Math.sin(rad(lat)) * Math.sin(rad(pl.dec)) + Math.cos(rad(lat)) * Math.cos(rad(pl.dec)) * Math.cos(rad(lha)))) - alt.ho;
  let lo = alt.ho - 2, hi = alt.ho + 2;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
  const lat = (lo + hi) / 2;

  const sumA = (lat - (alt.ho - 1)) * 60;
  const first = -p * Math.cos(rad(lha)) * 60;
  const second = (0.5 * rad(p) ** 2 * Math.sin(rad(lha)) ** 2 * Math.tan(rad(lat)) * 180 / Math.PI) * 60;

  if (alt.ho < 5) warnings.push('Polaris is too low (under 5°) for a reliable latitude; the refraction is uncertain.');
  if (alt.ho > 80) warnings.push('Polaris is above 80°; the latitude from it is no better than the altitude, but check the entries.');
  if (alt.ho <= 0) warnings.push('Polaris is not above the horizon: it cannot be seen from the southern hemisphere.');
  return { ariesGha: pl.ariesGha, lhaAries: mod360(pl.ariesGha + i.lon), lhaPolaris: lha, sha: pl.sha, dec: pl.dec, p, apparent: alt.apparent, ho: alt.ho, refraction: alt.corr.refraction, lat, sumA, first, second, warnings };
}
