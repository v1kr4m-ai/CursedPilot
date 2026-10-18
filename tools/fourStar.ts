// Four star fix (the rapid method): working out when to start the stopwatch and which stars to take, then reducing
// four star sights on the Sight Form and crossing the position lines carried to one time. Pure; checked by
// `node tools/fourStar.check.ts`.
import { gast, sunAt } from './sunEphemeris.ts';
import { ALL_TARGETS, targetName, targetPlace, targetTrueAltitude } from './targets.ts';
import type { Target } from './targets.ts';
import { meridianPassageJd, positionLine, reduce, rhumb } from './sunSights.ts';
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

/** something that could be shot: its altitude and bearing at the planned time, and its brightness */
export interface Candidate { target: Target; hc: number; zn: number; mag: number }

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

/** Four with the bearings best spread round the horizon (no wide empty sector), altitudes of 30 to 70 degrees, and the brighter ones. Stars and planets; the Moon is left for you to choose. */
export function suggestStars(all: Candidate[], want = 4): Candidate[] {
  const c = all.filter(x => !(x.target.kind === 'body' && x.target.name === 'Moon'));
  const pick = (hcMin: number, hcMax: number, vMax: number) => c.filter(x => x.hc >= hcMin && x.hc <= hcMax && x.mag <= vMax);
  let pool = pick(30, 70, 2.5);
  if (pool.length < want) pool = pick(20, 80, 3.0);
  if (pool.length <= want) return [...pool].sort((a, b) => a.zn - b.zn);
  pool = [...pool].sort((a, b) => a.mag - b.mag).slice(0, 18);
  let best: Candidate[] = [], bestScore = -Infinity;
  const n = pool.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c2 = b + 1; c2 < n; c2++) for (let d = c2 + 1; d < n; d++) {
    const set = [pool[a], pool[b], pool[c2], pool[d]];
    const az = set.map(x => x.zn).sort((p, q) => p - q);
    const gaps = az.map((x, i) => (i === 3 ? az[0] + 360 - x : az[i + 1] - x));
    const score = Math.min(...gaps) * 10 - Math.max(...gaps) * 5 - set.reduce((s, x) => s + x.mag, 0);   // even spread first, then no big empty sector, then brightness
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
  for (const target of ALL_TARGETS) {
    const p = targetPlace(target, t0), r = reduce({ gha: p.gha, dec: p.dec }, dr);
    if (r.hc > 5) candidates.push({ target, hc: r.hc, zn: r.zn, mag: p.mag });
  }
  return { twilightJd, startJd, chosenLhaAries: chosen, t0Jd: t0, zeroJd: t0 - 2 / 1440, candidates, suggested: suggestStars(candidates) };
}

// ---- the fix -----------------------------------------------------------------------------------------------------

/** a sight of a star, planet or the Moon: what, when (UT) and the sextant altitude */
export interface TargetSight { target: Target; jd: number; sextantDeg: number }
export type StarSightIn = TargetSight;

/** the arguments the Sight Form wants for a target */
const formTarget = (t: Target) => (t.kind === 'star' ? { star: t.star } : { bodyName: t.name });

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
  lines: { target: Target; name: string; jd: number; dr: Pos; intercept: number; zn: number; ho: number; run: number; residual: number }[];
  fixJd: number;
  fix: Pos | null;
  /** the direct (DR) method for comparison */
  direct: Pos | null;
  maxResidual: number;
  warnings: string[];
}

export function fourStarFix(c: Common, refJd: number, sights: StarSightIn[], zone: number, header: { from: string; to: string; dweSec?: number }, fixAt: 'zero' | 'last' = 'zero'): { set: FormSet; result: FourStarResult } {
  const warnings: string[] = [];
  const fixJd = fixAt === 'zero' ? refJd : Math.max(refJd, ...sights.map(s => s.jd));
  const base = { header, course: c.course, speed: c.speed, cond: c.cond, zone };
  const prepared = sights.map((s, i) => {
    const dr = rhumb(c.dr, c.course, c.speed * (s.jd - refJd) * 24);
    const run = c.speed * (fixJd - s.jd) * 24;
    const out = sunSightForm({ ...base, dr, jd: s.jd, sextantDeg: s.sextantDeg, runNm: run, title: `Sight ${i + 1} of ${sights.length}: ${targetName(s.target)}`, ...formTarget(s.target) });
    const place = targetPlace(s.target, s.jd);
    const exact = positionLine(dr, targetTrueAltitude(s.target, s.sextantDeg, c.cond, s.jd).ho, reduce({ gha: place.gha, dec: place.dec }, dr));
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
    ? sunSightForm({ ...base, dr: p.dr, jd: p.s.jd, sextantDeg: p.s.sextantDeg, runNm: p.run, title: `Sight ${i + 1} of ${sights.length}: ${targetName(p.s.target)}`, ...formTarget(p.s.target), observed: { pos: fx.pos, jd: fixJd } })
    : p.out).form);

  if (sights.length < 2) warnings.push('Take at least two bodies; three or four give a check.');
  if (!fx && sights.length >= 2) warnings.push('The bearings are too alike for the lines to cross. Take bodies well apart in bearing.');
  if (sights.length >= 3) {
    const az = prepared.map(p => p.out.calc.zn).sort((a, b) => a - b);
    const gap = Math.max(...az.map((x, i) => (i === az.length - 1 ? az[0] + 360 - x : az[i + 1] - x)));
    if (gap > 150) warnings.push(`The largest gap between the bearings is ${gap.toFixed(0)}°. Bodies spread round the horizon give a better fix.`);
  }
  if (fx && maxResidual > 2) warnings.push(`The lines miss the fix by up to ${maxResidual.toFixed(1)} nm. Check the bodies were identified correctly and the times and altitudes.`);
  prepared.forEach((p, i) => {
    // the form's intercept is from the chosen position (up to 30' from the DR by construction), so judge the sight by its distance from the DR
    if (Math.abs(p.exact.intercept) > 30) warnings.push(`Sight ${i + 1} (${targetName(p.s.target)}): the intercept from the DR is ${Math.abs(p.exact.intercept).toFixed(0)} miles. Check the time, date and altitude.`);
    if (p.out.calc.ho < 10 || p.out.calc.ho > 80) warnings.push(`Sight ${i + 1} (${targetName(p.s.target)}): altitude ${p.out.calc.ho.toFixed(1)}° is outside the 10° to 80° where sights are reliable.`);
  });
  if (fx && dx && distNm(fx.pos, dx.pos) > 1) warnings.push(`The form method and the direct method differ by ${distNm(fx.pos, dx.pos).toFixed(1)} nm. Check the entries.`);

  return {
    result: {
      lines: prepared.map((p, i) => ({ target: p.s.target, name: targetName(p.s.target), jd: p.s.jd, dr: p.dr, intercept: p.out.calc.intercept, zn: p.out.calc.zn, ho: p.out.calc.ho, run: p.run, residual: residuals[i] })),
      fixJd, fix: fx?.pos ?? null, direct: dx?.pos ?? null, maxResidual, warnings,
    },
    set: {
      forms,
      plot: prepared.map((p, i) => ({ label: `${targetName(p.s.target)} (transfer by the run)`, ap: p.out.calc.ap, zn: p.out.calc.zn, intercept: p.out.calc.intercept, point: p.out.calc.line.point, residual: residuals[i] })),
      fixForm: fx?.pos ?? null, fixDirect: dx?.pos ?? null, warnings,
    },
  };
}

// ---- the rapid method: one chosen position for every star ------------------------------------------------------------

export interface RapidLine {
  target: Target; name: string; jd: number;
  /** tabulated altitude and bearing of the star at the chosen position at t0 */
  tabHc: number; zn: number;
  /** true altitude as observed, the correction for the time from t0 (arcminutes, + adds) and the altitude at t0 */
  ho: number; rotation: number; hoT0: number;
  /** seconds from t0 (negative before it) */
  dtSec: number;
  /** intercept in arcminutes, + towards the star */
  intercept: number;
  run: number;
  residual: number;
}

export interface RapidResult {
  /** the one chosen position: whole-degree latitude, longitude giving the whole LHA Aries at t0 */
  ap: Pos; chosenLhaAries: number; t0Jd: number; fixJd: number;
  lines: RapidLine[];
  fix: Pos | null;
  maxResidual: number;
  warnings: string[];
}

/**
 * The rapid method: all stars are reduced at the one time t0 (LHA Aries a whole number of degrees) from one chosen
 * position, each observed altitude being corrected for the time it was taken before or after t0. Lines are plotted
 * from the common chosen position and carried to the time of the fix by the course and speed.
 */
export function rapidFix(c: Common, t0Jd: number, sights: StarSightIn[], fixJd: number): RapidResult {
  const warnings: string[] = [];
  const lat = Math.round(c.dr.lat);
  const lhaExact = mod360(gast(t0Jd) + c.dr.lon);
  const chosenLha = Math.round(lhaExact) % 360;
  const ap: Pos = { lat, lon: wrap180(chosenLha - gast(t0Jd)) };
  const lines = sights.map(s => {
    const p = targetPlace(s.target, t0Jd), r = reduce({ gha: p.gha, dec: p.dec }, ap);
    const ho = targetTrueAltitude(s.target, s.sextantDeg, c.cond, s.jd).ho;
    const dtSec = (s.jd - t0Jd) * 86400;
    // how much lower or higher the body was at t0 than when it was sighted, from the chosen position: a body in the east is rising, so after t0 it was higher than at t0
    const pi = targetPlace(s.target, s.jd);
    const rotation = (r.hc - reduce({ gha: pi.gha, dec: pi.dec }, ap).hc) * 60;
    const hoT0 = ho + rotation / 60;
    const intercept = (hoT0 - r.hc) * 60;
    return { target: s.target, name: targetName(s.target), jd: s.jd, tabHc: r.hc, zn: r.zn, ho, rotation, hoT0, dtSec, intercept, run: c.speed * (fixJd - s.jd) * 24, residual: 0 };
  });
  const lineSet = lines.map(l => ({ point: rhumb(rhumb(ap, l.intercept >= 0 ? l.zn : l.zn + 180, Math.abs(l.intercept)), c.course, l.run), zn: l.zn }));
  const x = crossMany(lineSet);
  const res = x?.residuals ?? lines.map(() => 0);
  lines.forEach((l, i) => { l.residual = res[i]; });
  const maxResidual = Math.max(0, ...res.map(Math.abs));
  if (sights.length < 2) warnings.push('Take at least two bodies; three or four give a check.');
  if (!x && sights.length >= 2) warnings.push('The bearings are too alike for the lines to cross. Take bodies well apart in bearing.');
  if (x && maxResidual > 2) warnings.push(`The lines miss the fix by up to ${maxResidual.toFixed(1)} nm. Check the bodies were identified correctly and the times and altitudes.`);
  lines.forEach((l, i) => { if (Math.abs(l.dtSec) > 300) warnings.push(`Sight ${i + 1} (${l.name}) was taken ${Math.round(Math.abs(l.dtSec) / 60)} minutes from t0; the rapid method suits sights within about 4 minutes.`); });
  return { ap, chosenLhaAries: chosenLha, t0Jd, fixJd, lines, fix: x?.pos ?? null, maxResidual, warnings };
}
