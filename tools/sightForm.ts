// The Admiralty Sight Form (NP 98) filled in for Sun run Sun and Sun run Merpass, in the order of the form's 37
// lines, so it can be printed and checked against the Nautical Almanac and the Sight Reduction Tables (NP 401).
// Pure; `node tools/sightForm.check.ts` checks it.
//
// The numbers are worked out here, not looked up: the tabulated GHA and declination come from the Sun's
// calculated position at the whole hour, the increments and corrections follow the almanac's own rules, and the
// tabulated altitude, its differences and the azimuth are the values the Sight Reduction Tables would give for the
// chosen position, interpolated the way the form says. Expect agreement with the books to about 0.1 minute of arc.
// Every figure is kept to the tenth of a minute, as on the form, so the lines add up as they do on paper.
import { calendarOf, julianDay, sunAt } from './sunEphemeris.ts';
import type { Common, Conditions, Pos, SightInput, SrmResult, SrsResult } from './sunSights.ts';
import { crossLines, longitudeOnLine, positionLine, rhumb, srm, srs, trueAltitude, zoneToJd } from './sunSights.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** tenths of an arcminute in a degree */
const T = 600;
const FULL = 360 * T;

export interface FormRow {
  n: number;
  label: string;
  value: string;
  /** a second entry on the line: W/E, d, same/contrary and so on */
  value2?: string;
  /** a small remark under or beside the entry */
  note?: string;
}

export interface SightForm {
  title: string;
  header: { from: string; to: string; co: string; spd: string; he: string };
  rows: FormRow[];
  notes: string[];
}

// ---- text ----------------------------------------------------------------------------------------------------

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** 14130 (tenths of arcminutes) -> "23° 35.5'" ; sign shown for negatives */
export const dm10 = (v: number): string => {
  const a = Math.abs(v), d = Math.floor(a / T), m10 = a % T;
  return `${v < 0 ? '−' : ''}${d}° ${pad(Math.floor(m10 / 10))}.${m10 % 10}'`;
};
/** arcminutes in tenths with a sign: +15.3' / −6.1' */
const sgn10 = (v: number): string => `${v < 0 ? '−' : '+'}${(Math.abs(v) / 10).toFixed(1)}'`;
const hms = (h: number, m: number, s: number) => `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function zoneDescription(zoneHours: number): string {
  const d = -zoneHours, a = Math.abs(d), h = Math.floor(a + 1e-9), m = Math.round((a - h) * 60);
  return `${d < 0 ? '−' : '+'}${h}${m ? `:${pad(m)}` : ''}`;
}

/** zone date and time of a Julian day (UT) in the given zone, rounded to the second */
function zoneClock(jd: number, zone: number) {
  const [y, mo, d, f] = calendarOf(Math.round((jd + zone / 24) * 86400) / 86400 + 1e-9);
  const s = Math.floor(f * 86400);
  return { y, mo, d, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const clockText = (c: { h: number; m: number; s?: number }) => `${pad(c.h)}${pad(c.m)}`;

const latText = (lat: number) => `${dm10(Math.round(Math.abs(lat) * T))} ${lat < 0 ? 'S' : 'N'}`;
const lonText = (lon: number) => `${dm10(Math.round(Math.abs(lon) * T))} ${lon < 0 ? 'W' : 'E'}`;

// ---- spherical reduction (what the Sight Reduction Tables tabulate) ----------------------------------------------

/** Altitude (degrees) for latitude `phi` (0-90, the name taken as same), hour angle and declination (positive = same name). */
function altitude(phi: number, ha: number, decRel: number): number {
  const p = rad(phi), d = rad(decRel), h = rad(ha);
  return deg(Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h)));
}

// ---- one Sun sight ---------------------------------------------------------------------------------------------

export interface SunFormInput {
  header: { from: string; to: string };
  dr: Pos; course: number; speed: number; cond: Conditions;
  zone: number; jd: number; sextantDeg: number;
  /** distance run from this sight to the time of the intended observed position, nm; null for none */
  runNm: number | null;
  /** the observed position and its time, entered on the form once it is known */
  observed?: { pos: Pos; jd: number } | null;
  title: string;
}

export interface SunFormCalc {
  /** the chosen position the tables were entered with */
  ap: Pos;
  /** corrected tabulated altitude and true altitude, degrees, to 0.1' */
  hcCorr: number; ho: number;
  /** true bearing of the Sun from the chosen position */
  zn: number;
  /** intercept in arcminutes, positive towards the Sun */
  intercept: number;
  /** the Sun's GHA (degrees, to 0.1') and declination used */
  gha: number; dec: number;
  /** position line for plotting: a point on it and the azimuth it is at right angles to */
  line: { point: Pos; zn: number };
  /** Hc from the exact formula at the chosen position, for comparison with the tabulated way (degrees) */
  hcExact: number;
}

export function sunSightForm(i: SunFormInput): { form: SightForm; calc: SunFormCalc } {
  const gmt = (() => { const [y, mo, d, f] = calendarOf(Math.round(i.jd * 86400) / 86400 + 1e-9); const s = Math.floor(f * 86400); return { y, mo, d, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }; })();
  const zt = zoneClock(i.jd, i.zone);
  const jdHour = julianDay(gmt.y, gmt.mo, gmt.d, gmt.h, 0, 0);
  const sec = gmt.m * 60 + gmt.s;

  // 10-13: GHA
  const hourSun = sunAt(jdHour), nextSun = sunAt(jdHour + 1 / 24);
  const gTab10 = Math.round(hourSun.gha * T);
  const inc10 = Math.round(sec * 2.5);                        // 15 degrees an hour = 2.5 tenths of a minute per second
  const gha10 = mod(gTab10 + inc10, FULL);

  // 14-16: chosen longitude so the LHA is a whole number of degrees, nearest the DR
  const drLon10 = Math.round(i.dr.lon * T);
  const k = Math.round((gha10 + drLon10) / T);
  const lon10 = k * T - gha10;                                 // east positive
  const lha = mod(gha10 + lon10, FULL) / T;
  const tabHA = lha <= 180 ? lha : 360 - lha;

  // 17-20: declination
  const decTab10 = Math.round(hourSun.dec * T);
  let d10 = Math.round((nextSun.dec - hourSun.dec) * T);       // change over the hour, tenths of a minute
  const corr10 = Math.round((d10 * sec) / 3600);
  const dec10 = decTab10 + corr10;
  const chosenLat = Math.round(i.dr.lat) + 0;
  const latNorth = chosenLat === 0 ? i.dr.lat >= 0 : chosenLat > 0;
  const decNorth = dec10 >= 0;
  const same = latNorth === decNorth;
  const tabDec = Math.floor(Math.abs(dec10) / T), inc = (Math.abs(dec10) % T) / 10;   // inc in minutes

  // 21-25: tabulated altitude, its differences, corrected altitude
  const phi = Math.abs(chosenLat), s = same ? 1 : -1;
  const hc0 = altitude(phi, tabHA, s * tabDec), hc1 = altitude(phi, tabHA, s * (tabDec + 1)), hc2 = altitude(phi, tabHA, s * (tabDec + 2));
  const tabAlt10 = Math.round(hc0 * T);
  const dd10 = Math.round((hc1 - hc0) * T);                    // altitude change for one degree of declination, tenths of a minute
  const sign = dd10 < 0 ? -1 : 1;
  const tens10 = Math.floor(Math.abs(dd10) / 100) * 100;       // the tens of minutes of the difference (10', 20' ...), in tenths
  const first10 = sign * Math.round((tens10 * inc) / 60);
  const second10 = sign * Math.round(((Math.abs(dd10) - tens10) * inc) / 60);
  const x = inc / 60;
  const ds10 = Math.round(((x * (x - 1)) / 2) * ((hc2 - 2 * hc1 + hc0) * T));
  const sum10 = first10 + second10 + ds10;
  const corrTab10 = tabAlt10 + sum10;

  // azimuth from the chosen position (to a tenth of a degree)
  const apLat = chosenLat, apLon = lon10 / T;
  const ang = rad(lha), dr = rad(dec10 / T), la = rad(apLat);
  const hcA = Math.asin(Math.sin(la) * Math.sin(dr) + Math.cos(la) * Math.cos(dr) * Math.cos(ang));
  const zn = mod(Math.round(deg(Math.atan2(-Math.sin(ang) * Math.cos(dr), Math.sin(dr) * Math.cos(la) - Math.cos(dr) * Math.sin(la) * Math.cos(ang))) * 10) / 10, 360);
  const zAngle = apLat >= 0 ? (zn <= 180 ? zn : 360 - zn) : (zn <= 180 ? 180 - zn : zn - 180);

  // 26-31: altitude
  const sunNow = sunAt(i.jd);
  const alt = trueAltitude(i.sextantDeg, i.cond, sunNow);
  const sext10 = Math.round(i.sextantDeg * T);
  const ie10 = Math.round(alt.corr.ie * 10), dip10 = Math.round(alt.corr.dip * 10);
  const eff10 = ie10 + dip10;
  const app10 = sext10 + eff10;
  const apparentCorr10 = Math.round((alt.corr.refraction + alt.corr.parallax + alt.corr.semiDiameter) * 10);
  const true10 = app10 + apparentCorr10;

  // 32-34
  const intercept10 = true10 - corrTab10;
  const towards = intercept10 >= 0;

  const rows: FormRow[] = [
    { n: 1, label: 'D.R. Position', value: latText(i.dr.lat), value2: lonText(i.dr.lon) },
    { n: 2, label: 'Chosen Lat.', value: `${Math.abs(chosenLat)}° ${latNorth ? 'N' : 'S'}` },
    { n: 3, label: 'Body observed', value: `Sun ${i.cond.limb === 'LL' ? 'L.L.' : 'U.L.'}` },
    { n: 4, label: 'Date and Z.T.', value: `${pad(zt.d)} ${MONTHS[zt.mo - 1]} ${zt.y}`, value2: `${pad(zt.h)}h ${pad(zt.m)}m`, note: 'd  h  m' },
    { n: 5, label: 'Zone', value: zoneDescription(i.zone) },
    { n: 6, label: 'Greenwich Date', value: `${pad(gmt.d)} ${MONTHS[gmt.mo - 1]} ${gmt.y}`, value2: `${pad(gmt.h)}h ${pad(gmt.m)}m` },
    { n: 7, label: 'D.W.T.', value: '', note: 'read from the deck watch' },
    { n: 8, label: 'D.W.E.', value: 'nil', note: 'slow + / fast −' },
    { n: 9, label: 'G.M.T.', value: hms(gmt.h, gmt.m, gmt.s) },
    { n: 10, label: 'Tabulated G.H.A.', value: dm10(gTab10), note: `${pad(gmt.h)}h` },
    { n: 11, label: 'Increment', value: dm10(inc10), note: `${pad(gmt.m)}m ${pad(gmt.s)}s` },
    { n: 12, label: 'v corr. or S.H.A.', value: '—', note: 'none for the Sun' },
    { n: 13, label: 'G.H.A.', value: dm10(gha10) },
    { n: 14, label: 'Chosen Long.', value: dm10(Math.abs(lon10)), value2: lon10 >= 0 ? 'E (+)' : 'W (−)' },
    { n: 15, label: 'L.H.A.', value: `${lha}°` },
    { n: 16, label: 'Tab. H.A.', value: `${tabHA}°`, value2: lha > 180 ? 'E' : 'W', note: lha > 180 ? '360° − L.H.A.' : undefined },
    { n: 17, label: 'Tabulated Dec.', value: `${dm10(Math.abs(decTab10))} ${decTab10 >= 0 ? 'N' : 'S'}`, value2: `d ${d10 < 0 ? '−' : '+'}${(Math.abs(d10) / 10).toFixed(1)}'` },
    { n: 18, label: 'd corr.', value: sgn10(corr10), note: `${pad(gmt.m)}m ${pad(gmt.s)}s` },
    { n: 19, label: 'Dec.', value: `${dm10(Math.abs(dec10))} ${decNorth ? 'N' : 'S'}`, value2: same ? 'same' : 'contrary' },
    { n: 20, label: 'Tab. Dec.', value: `${tabDec}°`, value2: `${inc.toFixed(1)}'`, note: 'Dec. diff. / Dec. Inc.' },
    { n: 21, label: 'Tab. Alt.', value: dm10(tabAlt10), value2: `d ${dd10 < 0 ? '−' : '+'}${(Math.abs(dd10) / 10).toFixed(1)}'`, note: `Az. Z ${zAngle.toFixed(1)}°` },
    { n: 22, label: '1st Alt. diff. ±', value: sgn10(first10) },
    { n: 23, label: '2nd Alt. diff. ±', value: sgn10(second10) },
    { n: 24, label: 'Δd ± / D.S. diff. ±', value: sgn10(sum10), note: `D.S. ${sgn10(ds10)}` },
    { n: 25, label: 'Corr. Tab. Alt.', value: dm10(corrTab10) },
    { n: 26, label: 'Sextant Alt.', value: dm10(sext10) },
    { n: 27, label: 'I.E. / Dip (−)', value: sgn10(ie10), value2: sgn10(dip10) },
    { n: 28, label: 'I.E. − Dip', value: sgn10(eff10) },
    { n: 29, label: 'Apparent Alt.', value: dm10(app10) },
    { n: 30, label: 'Corrections to altitude', value: sgn10(apparentCorr10), note: 'refraction, parallax, semi-diameter' },
    { n: 31, label: 'True Alt.', value: dm10(true10) },
    { n: 32, label: 'Corr. Tab. Alt.', value: dm10(corrTab10) },
    { n: 33, label: 'Intercept', value: `${(Math.abs(intercept10) / 10).toFixed(1)}'`, value2: towards ? 'to' : 'from' },
    { n: 34, label: 'True Bearing', value: `${zn.toFixed(1)}° T` },
    { n: 35, label: 'Run', value: i.runNm === null ? '—' : `${i.runNm.toFixed(1)} nm`, note: i.runNm === null ? undefined : 'to the time of the observed position' },
    { n: 36, label: 'Obs. position', value: i.observed ? latText(i.observed.pos.lat) : '', value2: i.observed ? lonText(i.observed.pos.lon) : '' },
    { n: 37, label: 'Time', value: i.observed ? `${clockText(zoneClock(i.observed.jd, i.zone))} (${zoneDescription(i.zone)})` : '' },
  ];

  const form: SightForm = {
    title: i.title,
    header: { from: i.header.from, to: i.header.to, co: `${Math.round(i.course)}°`, spd: `${i.speed}`, he: `${i.cond.hoeM} m` },
    rows,
    notes: [
      'Worked out by Cursed Pilot, not looked up: tabulated GHA, declination, altitude and differences are calculated to the tenth of a minute, so they can differ from the Nautical Almanac and the Sight Reduction Tables by about 0.1′.',
      'D.W.T. is left for the watch reading; the zone time is taken as correct (D.W.E. nil).',
    ],
  };
  const line = positionLine({ lat: apLat, lon: apLon }, true10 / T, { gha: gha10 / T, dec: dec10 / T, lha, hc: corrTab10 / T, zn });
  return {
    form,
    calc: { ap: { lat: apLat, lon: apLon }, hcCorr: corrTab10 / T, ho: true10 / T, zn, intercept: intercept10 / 10, gha: gha10 / T, dec: dec10 / T, line: { point: line.point, zn }, hcExact: deg(hcA) },
  };
}

// ---- Sun run Sun -------------------------------------------------------------------------------------------------

export interface FormSet {
  forms: SightForm[];
  /** what to plot, and the position the form method gives */
  plot: { label: string; ap: Pos; zn: number; intercept: number; point: Pos }[];
  fixForm: Pos | null;
  /** the position from the direct (DR) method, for comparison */
  fixDirect: Pos | null;
  warnings: string[];
}

const distNm = (a: Pos, b: Pos) => Math.hypot((a.lat - b.lat) * 60, (a.lon - b.lon) * 60 * Math.cos(rad((a.lat + b.lat) / 2)));
export { distNm };

export function srsForms(c: Common, s1: SightInput, s2: SightInput, zone: number, header: { from: string; to: string }): { set: FormSet; result: SrsResult } {
  const result = srs(c, s1, s2);
  const base = { header, course: c.course, speed: c.speed, cond: c.cond, zone };
  const f1 = sunSightForm({ ...base, dr: c.dr, jd: s1.jd, sextantDeg: s1.sextantDeg, runNm: result.run, title: 'Sight 1 of 2 (Sun run Sun)' });
  const f2first = sunSightForm({ ...base, dr: result.dr2, jd: s2.jd, sextantDeg: s2.sextantDeg, runNm: null, title: 'Sight 2 of 2 (Sun run Sun)' });
  const l1t = { point: rhumb(f1.calc.line.point, c.course, result.run), zn: f1.calc.zn };
  const x = crossLines(l1t, f2first.calc.line);
  const fixForm = x?.pos ?? null;
  // enter the position on the second form
  const f2 = fixForm ? sunSightForm({ ...base, dr: result.dr2, jd: s2.jd, sextantDeg: s2.sextantDeg, runNm: null, title: 'Sight 2 of 2 (Sun run Sun)', observed: { pos: fixForm, jd: s2.jd } }) : f2first;
  const warnings = [...result.warnings];
  if (fixForm && result.fix && distNm(fixForm, result.fix) > 1) warnings.push(`The form method and the direct method differ by ${distNm(fixForm, result.fix).toFixed(1)} nm. Check the entries.`);
  return {
    result,
    set: {
      forms: [f1.form, f2.form],
      plot: [
        { label: 'Sight 1 (transfer by the run)', ap: f1.calc.ap, zn: f1.calc.zn, intercept: f1.calc.intercept, point: f1.calc.line.point },
        { label: 'Sight 2', ap: f2first.calc.ap, zn: f2first.calc.zn, intercept: f2first.calc.intercept, point: f2first.calc.line.point },
      ],
      fixForm, fixDirect: result.fix, warnings,
    },
  };
}

// ---- Sun run Merpass ---------------------------------------------------------------------------------------------

export function srmForms(c: Common, s1: SightInput, merSextantDeg: number, zone: number, header: { from: string; to: string }, observedMpJd?: number): { set: FormSet; result: SrmResult } {
  const result = srm(c, s1, merSextantDeg, observedMpJd);
  const base = { header, course: c.course, speed: c.speed, cond: c.cond, zone };
  const f1 = sunSightForm({ ...base, dr: c.dr, jd: s1.jd, sextantDeg: s1.sextantDeg, runNm: result.run, title: 'Sight 1 of 2 (Sun run Merpass)' });
  const tm = observedMpJd !== undefined && Number.isFinite(observedMpJd) ? observedMpJd : result.mpJd;

  // the meridian altitude form
  const gmt = (() => { const [y, mo, d, f] = calendarOf(Math.round(tm * 86400) / 86400 + 1e-9); const s = Math.floor(f * 86400); return { y, mo, d, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }; })();
  const zt = zoneClock(tm, zone);
  const jdHour = julianDay(gmt.y, gmt.mo, gmt.d, gmt.h, 0, 0), sec = gmt.m * 60 + gmt.s;
  const hourSun = sunAt(jdHour), nextSun = sunAt(jdHour + 1 / 24);
  const decTab10 = Math.round(hourSun.dec * T);
  const d10 = Math.round((nextSun.dec - hourSun.dec) * T);
  const corr10 = Math.round((d10 * sec) / 3600);
  const dec10 = decTab10 + corr10;
  const alt = trueAltitude(merSextantDeg, c.cond, sunAt(tm));
  const sext10 = Math.round(merSextantDeg * T);
  const ie10 = Math.round(alt.corr.ie * 10), dip10 = Math.round(alt.corr.dip * 10), eff10 = ie10 + dip10;
  const app10 = sext10 + eff10;
  const corrAlt10 = Math.round((alt.corr.refraction + alt.corr.parallax + alt.corr.semiDiameter) * 10);
  const true10 = app10 + corrAlt10;
  const zd10 = 90 * T - true10;
  const sunSouth = result.drMp.lat >= dec10 / T;
  const lat10 = sunSouth ? dec10 + zd10 : dec10 - zd10;
  const lat = lat10 / T;
  const line1 = { point: rhumb(f1.calc.line.point, c.course, result.run), zn: f1.calc.zn };
  const fixForm = longitudeOnLine(line1, lat);

  const dash = '—';
  const rows: FormRow[] = [
    { n: 1, label: 'D.R. Position', value: latText(result.drMp.lat), value2: lonText(result.drMp.lon), note: 'at meridian passage' },
    { n: 2, label: 'Chosen Lat.', value: dash, note: 'not needed' },
    { n: 3, label: 'Body observed', value: `Sun ${c.cond.limb === 'LL' ? 'L.L.' : 'U.L.'}`, note: 'meridian altitude' },
    { n: 4, label: 'Date and Z.T.', value: `${pad(zt.d)} ${MONTHS[zt.mo - 1]} ${zt.y}`, value2: `${pad(zt.h)}h ${pad(zt.m)}m`, note: 'd  h  m' },
    { n: 5, label: 'Zone', value: zoneDescription(zone) },
    { n: 6, label: 'Greenwich Date', value: `${pad(gmt.d)} ${MONTHS[gmt.mo - 1]} ${gmt.y}`, value2: `${pad(gmt.h)}h ${pad(gmt.m)}m` },
    { n: 7, label: 'D.W.T.', value: '', note: 'read from the deck watch' },
    { n: 8, label: 'D.W.E.', value: 'nil', note: 'slow + / fast −' },
    { n: 9, label: 'G.M.T.', value: hms(gmt.h, gmt.m, gmt.s) },
    ...[10, 11, 12, 13, 14, 15, 16].map(n => ({ n, label: ['Tabulated G.H.A.', 'Increment', 'v corr. or S.H.A.', 'G.H.A.', 'Chosen Long.', 'L.H.A.', 'Tab. H.A.'][n - 10], value: dash, note: n === 15 ? 'L.H.A. 0° on the meridian' : undefined })),
    { n: 17, label: 'Tabulated Dec.', value: `${dm10(Math.abs(decTab10))} ${decTab10 >= 0 ? 'N' : 'S'}`, value2: `d ${d10 < 0 ? '−' : '+'}${(Math.abs(d10) / 10).toFixed(1)}'` },
    { n: 18, label: 'd corr.', value: sgn10(corr10), note: `${pad(gmt.m)}m ${pad(gmt.s)}s` },
    { n: 19, label: 'Dec.', value: `${dm10(Math.abs(dec10))} ${dec10 >= 0 ? 'N' : 'S'}` },
    ...[20, 21, 22, 23, 24, 25].map(n => ({ n, label: ['Tab. Dec.', 'Tab. Alt.', '1st Alt. diff. ±', '2nd Alt. diff. ±', 'Δd ± / D.S. diff. ±', 'Corr. Tab. Alt.'][n - 20], value: dash })),
    { n: 26, label: 'Sextant Alt.', value: dm10(sext10), note: 'meridian altitude' },
    { n: 27, label: 'I.E. / Dip (−)', value: sgn10(ie10), value2: sgn10(dip10) },
    { n: 28, label: 'I.E. − Dip', value: sgn10(eff10) },
    { n: 29, label: 'Apparent Alt.', value: dm10(app10) },
    { n: 30, label: 'Corrections to altitude', value: sgn10(corrAlt10), note: 'refraction, parallax, semi-diameter' },
    { n: 31, label: 'True Alt.', value: dm10(true10) },
    { n: 32, label: 'Zenith distance', value: dm10(zd10), note: '90° − 31 (this line differs from the printed form)' },
    { n: 33, label: 'Declination', value: `${dm10(Math.abs(dec10))} ${dec10 >= 0 ? 'N' : 'S'}`, note: '19 (this line differs from the printed form)' },
    { n: 34, label: 'Latitude', value: `${dm10(Math.abs(lat10))} ${lat10 >= 0 ? 'N' : 'S'}`, note: `${sunSouth ? 'Dec. + Z.D., Sun bears south' : 'Dec. − Z.D., Sun bears north'} (this line differs from the printed form)` },
    { n: 35, label: 'Run', value: `${result.run.toFixed(1)} nm`, note: 'from the first sight to meridian passage' },
    { n: 36, label: 'Obs. position', value: latText(lat10 / T), value2: fixForm ? lonText(fixForm.lon) : '', note: 'latitude from the meridian altitude, longitude from the first sight carried forward' },
    { n: 37, label: 'Time', value: `${clockText(zt)} (${zoneDescription(zone)})`, note: 'meridian passage' },
  ];
  const f2: SightForm = {
    title: 'Meridian altitude (Sun run Merpass)',
    header: { from: header.from, to: header.to, co: `${Math.round(c.course)}°`, spd: `${c.speed}`, he: `${c.cond.hoeM} m` },
    rows,
    notes: [
      'Lines 10 to 16 and 20 to 25 are not needed for a meridian altitude. Lines 32 to 34 are used for the zenith distance and latitude.',
      'Worked out by Cursed Pilot, not looked up in the Nautical Almanac; it can differ from the book by about 0.1′. Take the highest altitude around the time shown.',
    ],
  };
  const warnings = [...result.warnings];
  if (fixForm && result.fix && distNm(fixForm, result.fix) > 1) warnings.push(`The form method and the direct method differ by ${distNm(fixForm, result.fix).toFixed(1)} nm. Check the entries.`);
  const f1WithRun = f1.form;
  return {
    result,
    set: {
      forms: [f1WithRun, f2],
      plot: [{ label: 'Sight 1 (transfer by the run)', ap: f1.calc.ap, zn: f1.calc.zn, intercept: f1.calc.intercept, point: f1.calc.line.point }],
      fixForm: fixForm, fixDirect: result.fix, warnings,
    },
  };
}

export { zoneToJd };
