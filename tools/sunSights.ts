// Sun run Sun (SRS) and Sun run Meridian passage (SRM): an observed position from two Sun sights, or from a Sun
// sight and the meridian altitude, with the run of the ship between them. Pure; `node tools/sunSights.check.ts` checks it.
// Each sight is reduced from the DR position (altitude intercept method), its position line is carried forward by
// the ship's course and distance run, and the two lines are crossed. Positions are signed degrees (N and E +).
import { julianDay, sunAt } from './sunEphemeris.ts';
import type { SunPosition } from './sunEphemeris.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (d: number) => ((d % 360) + 360) % 360;
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export interface Pos { lat: number; lon: number }

// ---- Mercator sailing -----------------------------------------------------------------------------------------

const E_SPHEROID = 0.082483399;   // the eccentricity the Sun Run workbook uses

/** Meridional parts, in minutes of arc, of a latitude in degrees. */
export function meridionalParts(lat: number): number {
  const p = rad(lat), e = E_SPHEROID;
  return (Math.log(Math.tan(Math.PI / 4 + p / 2)) - (e / 2) * Math.log((1 + e * Math.sin(p)) / (1 - e * Math.sin(p)))) * (180 * 60) / Math.PI;
}

/** Where a ship ends after steaming `distance` nm on true `course` from `from`, by Mercator sailing. */
export function rhumb(from: Pos, course: number, distance: number): Pos {
  const c = rad(course);
  const lat = from.lat + (distance * Math.cos(c)) / 60;
  const dmp = meridionalParts(lat) - meridionalParts(from.lat);
  // east-west legs: the Mercator formula divides by a vanishing latitude change, so use the parallel instead
  const dlon = Math.abs(dmp) < 1e-6 || Math.abs(Math.cos(c)) < 1e-9
    ? (distance * Math.sin(c)) / (60 * Math.cos(rad(from.lat)))
    : (dmp * Math.tan(c)) / 60;
  return { lat, lon: from.lon + dlon };
}

// ---- Sextant altitude to true altitude ---------------------------------------------------------------------------

export interface Conditions {
  /** height of eye, metres */
  hoeM: number;
  /** index error in arcminutes */
  ieMin: number;
  /** true when the index error is "off the arc" (reads minus: add it); false for "on the arc" (subtract it) */
  offArc: boolean;
  limb: 'LL' | 'UL';
  tempC: number;
  pressMb: number;
}

export interface AltitudeCorrections { ie: number; dip: number; refraction: number; parallax: number; semiDiameter: number; total: number }   // arcminutes

export function dipMinutes(hoeM: number): number { return -0.0293 * Math.sqrt(Math.max(0, hoeM)) * 60; }

/** Refraction in arcminutes (negative), standard conditions scaled for temperature and pressure; the formulas the workbook uses. */
export function refractionMinutes(apparentDeg: number, tempC: number, pressMb: number): number {
  const h = apparentDeg;
  const standard = h > 15
    ? (60 * 0.0162) / Math.tan(rad(h))
    : (60 * (0.5743 + 0.0705 * h + 0.00007 * h * h)) / (1 + 0.505 * h + 0.0845 * h * h);
  return -standard * ((0.28 * pressMb) / (tempC + 273));
}

/** True altitude (degrees) of the Sun's centre from a sextant reading of its limb. */
export function trueAltitude(sextantDeg: number, c: Conditions, sun: Pick<SunPosition, 'sd' | 'r'>): { apparent: number; ho: number; corr: AltitudeCorrections } {
  const ie = c.offArc ? c.ieMin : -c.ieMin;
  const dip = dipMinutes(c.hoeM);
  const apparent = sextantDeg + (ie + dip) / 60;
  const refraction = refractionMinutes(apparent, c.tempC, c.pressMb);
  const parallax = (8.794 / 60 / sun.r) * Math.cos(rad(apparent));            // 8.794" at one AU
  const semiDiameter = c.limb === 'LL' ? sun.sd : -sun.sd;
  const total = ie + dip + refraction + parallax + semiDiameter;
  return { apparent, ho: sextantDeg + total / 60, corr: { ie, dip, refraction, parallax, semiDiameter, total } };
}

// ---- Reduction ---------------------------------------------------------------------------------------------------

export interface Reduction { gha: number; dec: number; lha: number; hc: number; zn: number }

/** Calculated altitude and azimuth of the Sun for an observer at `at`. */
export function reduce(sun: SunPosition, at: Pos): Reduction {
  const lha = mod360(sun.gha + at.lon);
  const lat = rad(at.lat), dec = rad(sun.dec), l = rad(lha);
  const hc = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(l));
  const zn = mod360(deg(Math.atan2(-Math.sin(l) * Math.cos(dec), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(l))));
  return { gha: sun.gha, dec: sun.dec, lha, hc: deg(hc), zn };
}

export interface Line {
  /** the intercept in nautical miles, + towards the Sun */
  intercept: number;
  /** a point on the position line: the DR moved along the azimuth by the intercept */
  point: Pos;
  zn: number;
}

export function positionLine(dr: Pos, ho: number, r: Reduction): Line {
  const intercept = (ho - r.hc) * 60;
  return { intercept, point: rhumb(dr, intercept >= 0 ? r.zn : r.zn + 180, Math.abs(intercept)), zn: r.zn };
}

/** Crossing of two position lines, each through a point and perpendicular to its azimuth. Null when they are nearly parallel. */
export function crossLines(a: { point: Pos; zn: number }, b: { point: Pos; zn: number }): { pos: Pos; angle: number } | null {
  const angle = Math.abs(wrap180(a.zn - b.zn));
  const sep = Math.min(angle, 180 - angle);
  if (sep < 1) return null;
  let ref = { lat: (a.point.lat + b.point.lat) / 2, lon: (a.point.lon + b.point.lon) / 2 };
  let pos = ref;
  for (let i = 0; i < 3; i++) {
    const k = 60 * Math.cos(rad(ref.lat));
    const xy = (p: Pos) => ({ x: (p.lon - ref.lon) * k, y: (p.lat - ref.lat) * 60 });
    const pa = xy(a.point), pb = xy(b.point);
    const na = { x: Math.sin(rad(a.zn)), y: Math.cos(rad(a.zn)) }, nb = { x: Math.sin(rad(b.zn)), y: Math.cos(rad(b.zn)) };
    const ca = na.x * pa.x + na.y * pa.y, cb = nb.x * pb.x + nb.y * pb.y;
    const det = na.x * nb.y - na.y * nb.x;
    const x = (ca * nb.y - na.y * cb) / det, y = (na.x * cb - ca * nb.x) / det;
    pos = { lat: ref.lat + y / 60, lon: ref.lon + x / k };
    ref = pos;
  }
  return { pos, angle: sep };
}

// ---- Time ------------------------------------------------------------------------------------------------------

/** Julian day (UT) of a zone date and time. `zoneHours` is the zone's offset from UT, east positive (India +5.5). */
export function zoneToJd(year: number, month: number, day: number, hours: number, minutes: number, seconds: number, zoneHours: number): number {
  return julianDay(year, month, day, hours, minutes, seconds) - zoneHours / 24;
}

// ---- The two methods -----------------------------------------------------------------------------------------

export interface SightInput { jd: number; sextantDeg: number }

export interface Common {
  /** DR position at the time of the first sight */
  dr: Pos;
  course: number;
  speed: number;
  cond: Conditions;
}

export interface SightResult {
  jd: number; sun: SunPosition; apparent: number; ho: number; corr: AltitudeCorrections; red: Reduction; line: Line;
}

function sight(s: SightInput, at: Pos, cond: Conditions): SightResult {
  const sun = sunAt(s.jd);
  const alt = trueAltitude(s.sextantDeg, cond, sun);
  const red = reduce(sun, at);
  return { jd: s.jd, sun, apparent: alt.apparent, ho: alt.ho, corr: alt.corr, red, line: positionLine(at, alt.ho, red) };
}

export interface SrsResult {
  first: SightResult; second: SightResult;
  runHours: number; run: number; dr2: Pos;
  /** the first position line carried forward by the run */
  transferred: { point: Pos; zn: number };
  /** observed position at the time of the second sight */
  fix: Pos | null;
  /** angle between the two azimuths (0-90) */
  cut: number;
  warnings: string[];
}

export function srs(c: Common, s1: SightInput, s2: SightInput): SrsResult {
  const warnings: string[] = [];
  const runHours = (s2.jd - s1.jd) * 24;
  if (!(runHours > 0)) warnings.push('The second sight must be later than the first.');
  const run = c.speed * Math.max(0, runHours);
  const dr2 = rhumb(c.dr, c.course, run);
  const first = sight(s1, c.dr, c.cond), second = sight(s2, dr2, c.cond);
  const transferred = { point: rhumb(first.line.point, c.course, run), zn: first.line.zn };
  const x = crossLines(transferred, second.line);
  const cut = Math.min(Math.abs(wrap180(first.red.zn - second.red.zn)), 180 - Math.abs(wrap180(first.red.zn - second.red.zn)));
  if (!x) warnings.push('The two bearings are almost the same, so the lines do not cross. Take the sights further apart in time.');
  else if (cut < 30) warnings.push(`The lines cross at only ${cut.toFixed(0)}°, so the fix is weak. 30° or more is better.`);
  for (const [n, s] of [['first', first], ['second', second]] as const) {
    if (Math.abs(s.line.intercept) > 30) warnings.push(`The ${n} intercept is ${Math.abs(s.line.intercept).toFixed(0)} miles. Check the time, date, altitude and DR.`);
    if (s.ho < 10 || s.ho > 80) warnings.push(`The ${n} altitude is ${s.ho.toFixed(1)}°. Sights below 10° or above 80° are unreliable.`);
  }
  return { first, second, runHours, run, dr2, transferred, fix: x?.pos ?? null, cut, warnings };
}

// ---- Meridian passage ----------------------------------------------------------------------------------------

/** Julian day (UT) at which the Sun is on the meridian of a ship that has longitude `lon` then. Starts from `jdNear`. */
export function meridianPassageJd(lon: number, jdNear: number): number {
  let jd = jdNear;
  for (let i = 0; i < 6; i++) jd -= wrap180(sunAt(jd).gha + lon) / 15 / 24;
  return jd;
}

export interface SrmResult {
  first: SightResult;
  /** meridian passage as worked out for the ship's moving DR, and the time used */
  mpJd: number; usedObservedTime: boolean;
  runHours: number; run: number; drMp: Pos;
  merSun: SunPosition; merApparent: number; merHo: number; merCorr: AltitudeCorrections;
  /** latitude from the meridian altitude */
  lat: number;
  transferred: { point: Pos; zn: number };
  /** observed position at meridian passage */
  fix: Pos | null;
  warnings: string[];
}

export function srm(c: Common, s1: SightInput, merSextantDeg: number, observedMpJd?: number): SrmResult {
  const warnings: string[] = [];
  // The ship moves, so the longitude at meridian passage depends on when it happens: iterate on the DR.
  let mp = meridianPassageJd(c.dr.lon, s1.jd + 0.25);
  for (let i = 0; i < 8; i++) {
    const at = rhumb(c.dr, c.course, c.speed * Math.max(0, (mp - s1.jd) * 24));
    mp = meridianPassageJd(at.lon, mp);
  }
  const usedObserved = observedMpJd !== undefined && Number.isFinite(observedMpJd);
  const tm = usedObserved ? observedMpJd! : mp;
  const runHours = (tm - s1.jd) * 24;
  if (!(runHours > 0)) warnings.push('Meridian passage must be later than the first sight.');
  const run = c.speed * Math.max(0, runHours);
  const drMp = rhumb(c.dr, c.course, run);

  const first = sight(s1, c.dr, c.cond);
  const merSun = sunAt(tm);
  const alt = trueAltitude(merSextantDeg, c.cond, merSun);
  const zd = 90 - alt.ho;
  const lat = drMp.lat >= merSun.dec ? merSun.dec + zd : merSun.dec - zd;
  const transferred = { point: rhumb(first.line.point, c.course, run), zn: first.line.zn };

  // The transferred position line meets the parallel of the observed latitude: x = x0 - (y - y0) / tan(Zn).
  let fix: Pos | null = null;
  const sinZn = Math.sin(rad(transferred.zn));
  if (Math.abs(sinZn) < 0.17) warnings.push('The first sight was nearly due north or south, so its position line gives no longitude. Take it earlier, with the Sun well off the meridian.');
  else {
    const p0 = transferred.point, k = 60 * Math.cos(rad((p0.lat + lat) / 2));
    const dy = (lat - p0.lat) * 60;
    fix = { lat, lon: p0.lon + (-dy * Math.cos(rad(transferred.zn)) / sinZn) / k };
  }
  if (Math.abs(first.line.intercept) > 30) warnings.push(`The first intercept is ${Math.abs(first.line.intercept).toFixed(0)} miles. Check the time, date, altitude and DR.`);
  if (Math.abs(lat - drMp.lat) > 1) warnings.push(`The latitude from the meridian altitude is ${Math.abs(lat - drMp.lat).toFixed(1)}° from the DR. Check the altitude and the date.`);
  return { first, mpJd: mp, usedObservedTime: usedObserved, runHours, run, drMp, merSun, merApparent: alt.apparent, merHo: alt.ho, merCorr: alt.corr, lat, transferred, fix, warnings };
}

// ---- Typed values -------------------------------------------------------------------------------------------------

/** "09:15", "9 15 30", "091530", "9.25" is not accepted (ambiguous). Returns seconds into the day, or null. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  let h: number, m: number, s = 0;
  const compact = /^(\d{2})(\d{2})(\d{2})?$/.exec(t);
  if (compact) { h = +compact[1]; m = +compact[2]; s = compact[3] ? +compact[3] : 0; }
  else {
    const p = /^(\d{1,2})[:\s.hH]+(\d{1,2})(?:[:\s.mM]+(\d{1,2}(?:\.\d+)?))?\s*[sS]?$/.exec(t);
    if (!p) return null;
    h = +p[1]; m = +p[2]; s = p[3] ? +p[3] : 0;
  }
  return h > 23 || m > 59 || s >= 60 ? null : h * 3600 + m * 60 + s;
}

/** "2018-09-10" (what a date field gives). Returns [year, month, day] or null. */
export function parseIsoDate(text: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return mo >= 1 && mo <= 12 && d >= 1 && d <= dim ? [y, mo, d] : null;
}

/** Zone as hours from UT, east +: "5.5", "+5:30", "-3". Returns hours or null. */
export function parseZone(text: string): number | null {
  const m = /^\s*([+-]?)\s*(\d{1,2})(?:[:.](\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  const frac = m[3] === undefined ? 0 : text.includes(':') ? +m[3] / 60 : +`0.${m[3]}`;
  const v = +m[2] + frac;
  return v > 14 ? null : m[1] === '-' ? -v : v;
}
