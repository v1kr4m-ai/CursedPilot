// Four star fix (the rapid method): working out when to start the stopwatch and which stars to take, then reducing
// four star sights on the Sight Form and crossing the position lines carried to one time. Pure; checked by
// `node tools/fourStar.check.ts`.
import { gast, sunAt } from './sunEphemeris.ts';
import { STARS, starAt } from './stars.ts';
import type { Star } from './stars.ts';
import { meridianPassageJd, positionLine, reduce, rhumb, starTrueAltitude } from './sunSights.ts';
import type { Common, Pos } from './sunSights.ts';
import { distNm, sunSightForm } from './sightForm.ts';
import type { FormSet } from './sightForm.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const mod360 = (d: number) => ((d % 360) + 360) % 360;
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const ARIES_RATE = 15.041067;   // degrees of GHA Aries an hour

// ---- planning ----------------------------------------------------------------------------------------------------

/** Julian day (UT) at which the Sun's centre is 6 degrees below the horizon for an observer at `pos`, on the morning or evening around local noon `jdNoon`. */
export function civilTwilightJd(pos: Pos, jdNoon: number, morning: boolean): number | null {
  const mp = meridianPassageJd(pos.lon, jdNoon);
  const f = (jd: number) => reduce(sunAt(jd), pos).hc + 6;
  let lo = morning ? mp - 0.5 : mp, hi = morning ? mp : mp + 0.5;
  const flo = f(lo), fhi = f(hi);
  if (flo * fhi > 0) return null;                  // the Sun never gets that far down (or up) at this latitude and date
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if ((fm > 0) === (flo > 0)) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface Candidate { star: Star; hc: number; zn: number }

export interface StarPlan {
  twilightJd: number;
  /** when observations start: twilight less the interval */
  startJd: number;
  /** the whole number of degrees of LHA Aries the plan is built on, and the time it falls at */
  chosenLhaAries: number; t0Jd: number;
  /** when to start the stopwatch: two minutes before t0 */
  zeroJd: number;
  candidates: Candidate[];
  suggested: Candidate[];
}

/** Four stars with the bearings best spread round the horizon (no wide empty sector), altitudes of 30 to 70 degrees, and the brighter ones. */
export function suggestStars(c: Candidate[], want = 4): Candidate[] {
  const pick = (hcMin: number, hcMax: number, vMax: number) => c.filter(x => x.hc >= hcMin && x.hc <= hcMax && x.star.v <= vMax);
  let pool = pick(30, 70, 2.5);
  if (pool.length < want) pool = pick(20, 80, 3.0);
  if (pool.length <= want) return [...pool].sort((a, b) => a.zn - b.zn);
  pool = [...pool].sort((a, b) => a.star.v - b.star.v).slice(0, 18);
  let best: Candidate[] = [], bestScore = -Infinity;
  const n = pool.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c2 = b + 1; c2 < n; c2++) for (let d = c2 + 1; d < n; d++) {
    const set = [pool[a], pool[b], pool[c2], pool[d]];
    const az = set.map(x => x.zn).sort((p, q) => p - q);
    const gaps = az.map((x, i) => (i === 3 ? az[0] + 360 - x : az[i + 1] - x));
    const score = Math.min(...gaps) * 10 - Math.max(...gaps) * 5 - set.reduce((s, x) => s + x.star.v, 0);   // even spread first, then no big empty sector, then brightness
    if (score > bestScore) { bestScore = score; best = set; }
  }
  return best.sort((a, b) => a.zn - b.zn);
}

export function planFourStar(dr: Pos, jdNoon: number, kind: 'morning' | 'evening', intervalMin = 10): StarPlan | null {
  const twilightJd = civilTwilightJd(dr, jdNoon, kind === 'morning');
  if (twilightJd === null) return null;
  const startJd = twilightJd - intervalMin / 1440;
  const chosen = Math.round(mod360(gast(startJd) + dr.lon)) % 360;
  const target = mod360(chosen - dr.lon);
  let t0 = startJd;
  for (let i = 0; i < 8; i++) t0 += wrap180(target - gast(t0)) / ARIES_RATE / 24;
  const candidates: Candidate[] = [];
  for (const star of STARS) {
    const p = starAt(star, t0), r = reduce({ gha: p.gha, dec: p.dec }, dr);
    if (r.hc > 5) candidates.push({ star, hc: r.hc, zn: r.zn });
  }
  return { twilightJd, startJd, chosenLhaAries: chosen, t0Jd: t0, zeroJd: t0 - 2 / 1440, candidates, suggested: suggestStars(candidates) };
}

// ---- the fix -----------------------------------------------------------------------------------------------------

export interface StarSightIn { star: Star; jd: number; sextantDeg: number }

/** Best crossing of several position lines (each through a point, at right angles to an azimuth) by least squares. */
export function crossMany(lines: { point: Pos; zn: number }[]): { pos: Pos; residuals: number[] } | null {
  if (lines.length < 2) return null;
  let ref: Pos = { lat: lines.reduce((s, l) => s + l.point.lat, 0) / lines.length, lon: lines.reduce((s, l) => s + l.point.lon, 0) / lines.length };
  let pos = ref, residuals: number[] = [];
  for (let it = 0; it < 4; it++) {
    const k = 60 * Math.cos(rad(ref.lat));
    let a = 0, b = 0, d = 0, e = 0, f = 0;
    for (const l of lines) {
      const nx = Math.sin(rad(l.zn)), ny = Math.cos(rad(l.zn));
      const px = (l.point.lon - ref.lon) * k, py = (l.point.lat - ref.lat) * 60;
      const c = nx * px + ny * py;
      a += nx * nx; b += nx * ny; d += ny * ny; e += nx * c; f += ny * c;
    }
    const det = a * d - b * b;
    if (Math.abs(det) < 1e-6 * lines.length * lines.length) return null;
    const x = (e * d - b * f) / det, y = (a * f - b * e) / det;
    residuals = lines.map(l => {
      const nx = Math.sin(rad(l.zn)), ny = Math.cos(rad(l.zn));
      return nx * (x - (l.point.lon - ref.lon) * k) + ny * (y - (l.point.lat - ref.lat) * 60);
    });
    pos = { lat: ref.lat + y / 60, lon: ref.lon + x / k };
    ref = pos;
  }
  return { pos, residuals };
}

export interface FourStarResult {
  /** per star: the sight's reduction, and how far the fix lies from its line (nm, + towards the star) */
  lines: { star: Star; jd: number; dr: Pos; intercept: number; zn: number; ho: number; run: number; residual: number }[];
  fixJd: number;
  fix: Pos | null;
  /** the direct (DR) method for comparison */
  direct: Pos | null;
  maxResidual: number;
  warnings: string[];
}

export function fourStarFix(c: Common, refJd: number, sights: StarSightIn[], zone: number, header: { from: string; to: string }, fixAt: 'zero' | 'last' = 'zero'): { set: FormSet; result: FourStarResult } {
  const warnings: string[] = [];
  const fixJd = fixAt === 'zero' ? refJd : Math.max(refJd, ...sights.map(s => s.jd));
  const base = { header, course: c.course, speed: c.speed, cond: c.cond, zone };
  const prepared = sights.map((s, i) => {
    const dr = rhumb(c.dr, c.course, c.speed * (s.jd - refJd) * 24);
    const run = c.speed * (fixJd - s.jd) * 24;
    const out = sunSightForm({ ...base, dr, jd: s.jd, sextantDeg: s.sextantDeg, runNm: run, title: `Star ${i + 1} of ${sights.length}: ${s.star.name}`, star: s.star });
    const place = starAt(s.star, s.jd);
    const exact = positionLine(dr, starTrueAltitude(s.sextantDeg, c.cond).ho, reduce({ gha: place.gha, dec: place.dec }, dr));
    return { s, dr, run, out, exact };
  });

  const formLines = prepared.map(p => ({ point: rhumb(p.out.calc.line.point, c.course, p.run), zn: p.out.calc.zn }));
  const directLines = prepared.map(p => ({ point: rhumb(p.exact.point, c.course, p.run), zn: p.exact.zn }));
  const fx = crossMany(formLines), dx = crossMany(directLines);
  const residuals = fx?.residuals ?? prepared.map(() => 0);
  const maxResidual = Math.max(...residuals.map(Math.abs));

  // the position goes on the last form
  const last = prepared.length - 1;
  const forms = prepared.map((p, i) => (i === last && fx
    ? sunSightForm({ ...base, dr: p.dr, jd: p.s.jd, sextantDeg: p.s.sextantDeg, runNm: p.run, title: `Star ${i + 1} of ${sights.length}: ${p.s.star.name}`, star: p.s.star, observed: { pos: fx.pos, jd: fixJd } })
    : p.out).form);

  if (sights.length < 2) warnings.push('Take at least two stars; three or four give a check.');
  if (!fx && sights.length >= 2) warnings.push('The bearings are too alike for the lines to cross. Take stars well apart in bearing.');
  if (sights.length >= 3) {
    const az = prepared.map(p => p.out.calc.zn).sort((a, b) => a - b);
    const gap = Math.max(...az.map((x, i) => (i === az.length - 1 ? az[0] + 360 - x : az[i + 1] - x)));
    if (gap > 150) warnings.push(`The largest gap between the star bearings is ${gap.toFixed(0)}°. Stars spread round the horizon give a better fix.`);
  }
  if (fx && maxResidual > 2) warnings.push(`The lines miss the fix by up to ${maxResidual.toFixed(1)} nm. Check the stars were identified correctly and the times and altitudes.`);
  prepared.forEach((p, i) => {
    // the form's intercept is from the chosen position (up to 30' from the DR by construction), so judge the sight by its distance from the DR
    if (Math.abs(p.exact.intercept) > 30) warnings.push(`Star ${i + 1} (${p.s.star.name}): the intercept from the DR is ${Math.abs(p.exact.intercept).toFixed(0)} miles. Check the time, date and altitude.`);
    if (p.out.calc.ho < 10 || p.out.calc.ho > 80) warnings.push(`Star ${i + 1} (${p.s.star.name}): altitude ${p.out.calc.ho.toFixed(1)}° is outside the 10° to 80° where sights are reliable.`);
  });
  if (fx && dx && distNm(fx.pos, dx.pos) > 1) warnings.push(`The form method and the direct method differ by ${distNm(fx.pos, dx.pos).toFixed(1)} nm. Check the entries.`);

  return {
    result: {
      lines: prepared.map((p, i) => ({ star: p.s.star, jd: p.s.jd, dr: p.dr, intercept: p.out.calc.intercept, zn: p.out.calc.zn, ho: p.out.calc.ho, run: p.run, residual: residuals[i] })),
      fixJd, fix: fx?.pos ?? null, direct: dx?.pos ?? null, maxResidual, warnings,
    },
    set: {
      forms,
      plot: prepared.map((p, i) => ({ label: `${p.s.star.name} (transfer by the run)`, ap: p.out.calc.ap, zn: p.out.calc.zn, intercept: p.out.calc.intercept, point: p.out.calc.line.point, residual: residuals[i] })),
      fixForm: fx?.pos ?? null, fixDirect: dx?.pos ?? null, warnings,
    },
  };
}
