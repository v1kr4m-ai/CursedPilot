// BATTENBERG (v1): one radar picture for every station-keeping problem. The problems share one set of figures (the Guide's course and speed,
// own course and speed, the stationing speed, own station and the next station) and each turns them into a Scene: the marks, tracks and
// lines to draw about the Guide, the run to play in time, and the answer as text. Positions are own ship relative to the Guide, in n miles,
// x east and y north. Pure; `node tools/board.check.ts`.

import { place, profile, slowing, solve } from './battenberg.ts';
import type { Vec } from './battenberg.ts';
import { approach, closeFaster, contactFromPlots, courseOf, passAt, stationInTime, vec } from './relvel.ts';
import type { Obs } from './relvel.ts';
import { roundTheClock } from './stationChanges.ts';
import type { Station } from './stationChanges.ts';
import { trueFromAhead } from './rasApproach.ts';
import type { Plan } from './rasApproach.ts';
import { radarPicture, solve as bowsSolve } from './stationTurn.ts';
import type { CalculationResult } from '../fishtail/types.ts';

export const YD_PER_NM = 2025.37;
const yd = (nm: number) => Math.round(nm * YD_PER_NM);
const b3 = (d: number) => `${String(Math.round(((d % 360) + 360) % 360) % 360).padStart(3, '0')}°`;
/** A length (n miles) written in the unit chosen for the answers. */
const L = (c: Common, nm: number) => (c.fmt ? c.fmt(nm) : `${yd(nm)} yd`);
const Ly = (c: Common, yards: number) => L(c, yards / YD_PER_NM);
const mmss = (h: number) => { const s = Math.round(h * 3600); return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`; };

/** The figures every problem shares. Bearings true; stations as own ship's true bearing from the Guide and distance in yards. */
export interface Common {
  guideCourse: number | null; guideSpeed: number | null;
  ownCourse: number | null; ownSpeed: number | null;
  stationingSpeed: number | null;
  nowBearing: number | null; nowYards: number | null;
  nextBearing: number | null; nextYards: number | null;
  /** how a length (given in n miles) is written in the answers; yards when not given */
  fmt?: (nm: number) => string;
}

export type MarkKind = 'own' | 'station' | 'slow' | 'wheel' | 'point';
export interface Scene {
  marks: { pos: Vec; kind: MarkKind; label: string }[];
  /** relative tracks (own ship about the Guide) and construction lines */
  tracks: { pts: Vec[]; kind: 'rel' | 'construction' }[];
  /** the run in time: own ship's place about the Guide `hours` in */
  play?: { totalHours: number; at: (hours: number) => Vec };
  rows: [string, string][];
  /** what is still needed, when the problem cannot be worked */
  need?: string[];
  warn?: string;
}

const needs = (pairs: [unknown, string][]) => pairs.filter(([v]) => v === null || v === undefined).map(([, n]) => n);
const nowOf = (c: Common) => place(c.nowBearing!, c.nowYards! / YD_PER_NM), nextOf = (c: Common) => place(c.nextBearing!, c.nextYards! / YD_PER_NM);

/** Taking or changing station (BR 45(6) 0423-0424): the course to steer at the stationing speed, and where to reduce. */
export function stationScene(c: Common, lossYdPerKnot: number | null): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.stationingSpeed, 'the stationing speed'], [c.nowBearing, 'own station'], [c.nowYards, 'own station distance'], [c.nextBearing, 'the next station'], [c.nextYards, 'the next station distance']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const prob = { guideCourse: c.guideCourse!, guideSpeed: c.guideSpeed!, stationingSpeed: c.stationingSpeed!, from: nowOf(c), to: nextOf(c) };
  const marks: Scene['marks'] = [{ pos: prob.from, kind: 'own', label: 'Now' }, { pos: prob.to, kind: 'station', label: 'Station' }];
  const [best, other] = solve(prob);
  if (!best) return { marks, tracks: [{ pts: [prob.from, prob.to], kind: 'construction' }], rows: [], warn: `That station cannot be reached at ${c.stationingSpeed} kn against a Guide at ${c.guideSpeed} kn: a higher stationing speed is needed.` };
  const slow = lossYdPerKnot !== null && lossYdPerKnot > 0 ? slowing(prob, best, lossYdPerKnot / YD_PER_NM) : null;
  const pr = profile(prob, best, slow);
  if (slow && !slow.immediately) marks.push({ pos: slow.at, kind: 'slow', label: 'Reduce' });
  const dist = Math.hypot(prob.to.x - prob.from.x, prob.to.y - prob.from.y);
  return {
    marks, tracks: [{ pts: [prob.from, prob.to], kind: 'rel' }],
    play: { totalHours: pr.totalHours, at: h => pr.at(h).pos },
    rows: [
      ['Course to steer', `${b3(best.course)} at ${c.stationingSpeed} kn`],
      ['Relative track', `${b3(best.relativeCourse)} at ${best.relativeSpeed.toFixed(1)} kn, ${L(c, dist)}`],
      ['On station in', mmss(pr.totalHours)],
      ...(slow ? [[slow.immediately ? 'Reduce speed' : 'Reduce when the Guide bears', slow.immediately ? 'at once' : `${b3(slow.guideBearsTrue)} at ${L(c, slow.distance)}`] as [string, string]] : []),
      ...(other ? [['The other course', `${b3(other.course)} (slower: ${mmss(other.hours)})`] as [string, string]] : []),
    ],
  };
}

/** Being on the next station in a set time: the course and speed. */
export function inTimeScene(c: Common, minutes: number | null): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.nowBearing, 'own station'], [c.nowYards, 'own station distance'], [c.nextBearing, 'the next station'], [c.nextYards, 'the next station distance'], [minutes, 'the time']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const from = nowOf(c), to = nextOf(c), h = minutes! / 60;
  const s = stationInTime(c.guideCourse!, c.guideSpeed!, from, to, h);
  const marks: Scene['marks'] = [{ pos: from, kind: 'own', label: 'Now' }, { pos: to, kind: 'station', label: 'Station' }];
  if (!s) return { marks, tracks: [], rows: [], warn: 'The time must be above zero.' };
  return {
    marks, tracks: [{ pts: [from, to], kind: 'rel' }],
    play: { totalHours: h, at: t => ({ x: from.x + ((to.x - from.x) * t) / h, y: from.y + ((to.y - from.y) * t) / h }) },
    rows: [['To be on station in ' + minutes + ' min', `steer ${b3(s.course)} at ${s.speed.toFixed(1)} kn`]],
  };
}

/** Own ship holding her course and speed: how close she comes to the Guide, and when (the relative velocity). */
export function cpaScene(c: Common): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.ownCourse, 'own course'], [c.ownSpeed, 'own speed'], [c.nowBearing, 'own station'], [c.nowYards, 'own station distance']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const from = nowOf(c), g = vec(c.guideCourse!, c.guideSpeed!), o = vec(c.ownCourse!, c.ownSpeed!), rel = { x: o.x - g.x, y: o.y - g.y };
  const marks: Scene['marks'] = [{ pos: from, kind: 'own', label: 'Now' }];
  const ap = approach(from, rel);
  if (!ap) return { marks, tracks: [], rows: [['Relative motion', 'none: you hold your bearing and distance']] };
  const span = Math.max(ap.cpaMinutes, 0) / 60 + 0.1, to = { x: from.x + rel.x * span, y: from.y + rel.y * span };
  if (ap.cpaMinutes > 0) marks.push({ pos: { x: from.x + (rel.x * ap.cpaMinutes) / 60, y: from.y + (rel.y * ap.cpaMinutes) / 60 }, kind: 'point', label: 'CPA' });
  return {
    marks, tracks: [{ pts: [from, to], kind: 'rel' }],
    play: { totalHours: span, at: t => ({ x: from.x + rel.x * t, y: from.y + rel.y * t }) },
    rows: [
      ['Relative track', `${b3(courseOf(rel))} at ${Math.hypot(rel.x, rel.y).toFixed(1)} kn`],
      ap.cpaMinutes > 0 ? ['Closest to the Guide', `${L(c, ap.cpa)} in ${ap.cpaMinutes.toFixed(1)} min, the Guide bearing ${b3(ap.cpaBearing + 180)}`] : ['Range', 'opening: you are past the closest point'],
    ],
  };
}

export interface BowsSettings { margin: number; marginSide: 'Port' | 'Starboard'; advance: number | null; transfer: number | null; speedLoss: number; decelPerKnot: number; turnSeconds: number | null; turn: 'Auto' | 'Port' | 'Starboard' }
/** Joining from ahead (BR 45(6) 0425): the wheel-over position, and the Guide's bearing and range then, on the approach course and speed. */
export function bowsScene(c: Common, b: BowsSettings): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.ownCourse, 'the approach course (own course)'], [c.stationingSpeed, 'the approach speed (stationing speed)'], [c.nextBearing, 'the station'], [c.nextYards, 'the station distance'], [b.advance, 'the advance'], [b.transfer, 'the transfer'], [b.turnSeconds, 'the turn time']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const input = { guideCourse: c.guideCourse!, guideSpeed: c.guideSpeed!, approachCourse: c.ownCourse!, approachSpeed: c.stationingSpeed!, stationBearing: c.nextBearing!, stationDistance: c.nextYards!,
    margin: b.margin, marginSide: b.marginSide, advance: b.advance!, transfer: b.transfer!, speedLoss: b.speedLoss, decelPerKnot: b.decelPerKnot, turnSeconds: b.turnSeconds!, turn: b.turn };
  const s = bowsSolve(input), r = radarPicture(input, s, 4);
  const nm = (p: { x: number; y: number }) => ({ x: p.x / YD_PER_NM, y: p.y / YD_PER_NM });
  const G = nm(s.points.G), start = nm({ x: -r.blips[0].x, y: -r.blips[0].y });   // own ship about the Guide is minus the Guide about own ship
  const lead = -r.blips[0].minutes / 60;
  const rel = { x: (G.x - start.x) / lead, y: (G.y - start.y) / lead };
  return {
    marks: [{ pos: G, kind: 'wheel', label: 'Wheel over' }, { pos: nm(s.points.B), kind: 'station', label: 'Station' }],
    tracks: [{ pts: [start, G], kind: 'rel' }, { pts: (['G', 'F', 'E', 'D', 'C', 'B'] as const).map(k => nm(s.points[k])), kind: 'construction' }],
    play: { totalHours: lead, at: t => ({ x: start.x + rel.x * t, y: start.y + rel.y * t }) },
    rows: [
      ['Wheel over when the Guide bears', `${s.relativeBearing >= 0 ? 'Green' : 'Red'} ${Math.round(Math.abs(s.relativeBearing))} (${b3(s.guideBearing)}T) at ${Ly(c, s.guideDistance)}`],
      ['Turn', `${Math.abs(Math.round(s.turnAngle))}° to ${s.turnAngle < 0 ? 'port' : 'starboard'}`],
      ['Lateral separation then', `${Ly(c, s.lateralSeparation)}`],
    ],
  };
}

/** A fishtail worked from the ship's turning table (fishtail/compute.ts), drawn about the Guide from own station. The fishtail is worked with
 *  the Guide's course up (000), so it is turned onto her true course here. */
export function fishtailScene(c: Common, f: CalculationResult | null, label: string): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.nowBearing, 'own station'], [c.nowYards, 'own station distance'], [f, 'turning data for the fishtail']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const from = nowOf(c), a = (c.guideCourse! * Math.PI) / 180, ydPerSec = (c.guideSpeed! * 2025) / 3600;
  // the fishtail frame: own ship from the origin, the Guide steaming up the y axis; relative to the Guide, turned to her course
  const rel = (x: number, y: number, sec: number) => { const ry = y - ydPerSec * sec; return { x: from.x + (x * Math.cos(a) + ry * Math.sin(a)) / YD_PER_NM, y: from.y + (-x * Math.sin(a) + ry * Math.cos(a)) / YD_PER_NM }; };
  const nodes: { t: number; p: Vec }[] = [{ t: 0, p: rel(0, 0, 0) }];
  let t = 0;
  for (let i = 0; i < f!.track_points.length - 1; i++) {
    const tp = f!.track_points[i + 1], adv = f!.corner_points[2 * i + 1], tr = f!.corner_points[2 * i + 2];
    if (!adv || !tr) continue;
    const tAdv = tp.time * (tp.advance + tp.transfer > 0 ? tp.advance / (tp.advance + tp.transfer) : 0.5);
    nodes.push({ t: t + tAdv, p: rel(adv.x, adv.y, t + tAdv) }, { t: t + tp.time, p: rel(tr.x, tr.y, t + tp.time) });
    t += tp.time;
  }
  const at = (h: number) => {
    const sec = h * 3600;
    for (let i = 1; i < nodes.length; i++) if (sec <= nodes[i].t) { const n0 = nodes[i - 1], n1 = nodes[i], r = n1.t > n0.t ? (sec - n0.t) / (n1.t - n0.t) : 1; return { x: n0.p.x + (n1.p.x - n0.p.x) * r, y: n0.p.y + (n1.p.y - n0.p.y) * r }; }
    return nodes[nodes.length - 1].p;
  };
  const end = nodes[nodes.length - 1].p;
  return {
    marks: [{ pos: from, kind: 'own', label: 'Start' }, { pos: end, kind: 'station', label: 'End' }],
    tracks: [{ pts: nodes.map(n => n.p), kind: 'rel' }],
    play: { totalHours: t / 3600, at },
    rows: [[label, `${Ly(c, f!.lateral_separation)} across, ${Ly(c, f!.drop_distance)} dropped`], ['Takes', mmss(t / 3600)], ['Ends', `${b3(Math.atan2(end.x, end.y) * 180 / Math.PI)} from the Guide at ${L(c, Math.hypot(end.x, end.y))}`]],
  };
}

// ---- relative velocity (the REL-VEL docket), with the Guide as the other ship ------------------------------------------------------------------
// relvel.ts works with the other ship relative to own ship; the board with own ship relative to the Guide, so positions are turned round.
const neg = (v: Vec): Vec => ({ x: -v.x, y: -v.y });

/** The Guide's course and speed from two or more plots of her (minutes, her true bearing from you, range in yards), and her closest approach. */
export function plotScene(c: Common, plots: { minutes: number; bearing: number; yards: number }[]): Scene {
  const need = needs([[c.ownCourse, 'own course'], [c.ownSpeed, 'own speed'], [plots.length >= 2 ? true : null, 'two or more plots of the Guide']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const obs: Obs[] = plots.map(p => ({ minutes: p.minutes, bearing: p.bearing, range: p.yards / YD_PER_NM }));
  const k = contactFromPlots(c.ownCourse!, c.ownSpeed!, obs);
  const marks: Scene['marks'] = obs.map(o => ({ pos: neg(place(o.bearing, o.range)), kind: 'point' as MarkKind, label: `${o.minutes}′` }));
  if (!k) return { marks, tracks: [], rows: [], warn: 'The plots need different times.' };
  const ap = approach(k.last, k.rel), span = Math.max(ap ? ap.cpaMinutes / 60 : 0, 0) + 0.1;
  const own0 = neg(k.last), relOwn = neg(k.rel);
  return {
    marks, tracks: [{ pts: [neg(place(obs[0].bearing, obs[0].range)), { x: own0.x + relOwn.x * span, y: own0.y + relOwn.y * span }], kind: 'rel' }],
    play: { totalHours: span, at: t => ({ x: own0.x + relOwn.x * t, y: own0.y + relOwn.y * t }) },
    rows: [
      ["The Guide's course and speed", `${b3(k.course)} at ${k.speed.toFixed(1)} kn`],
      ['Her relative track', `${b3(k.relCourse)} at ${k.relSpeed.toFixed(1)} kn`],
      ap && ap.cpaMinutes > 0 ? ['Closest', `${L(c, ap.cpa)} in ${ap.cpaMinutes.toFixed(1)} min after the last plot, bearing ${b3(ap.cpaBearing)}`] : ['Range', 'opening'],
    ],
  };
}

/** The course at the stationing speed to pass the Guide at a set distance: ahead of her and astern. */
export function passScene(c: Common, yards: number | null): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.stationingSpeed, 'the speed available (stationing speed)'], [c.nowBearing, 'own station'], [c.nowYards, 'own station distance'], [yards, 'the distance to pass']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const now = nowOf(c), opts = passAt(neg(now), c.guideCourse!, c.guideSpeed!, c.stationingSpeed!, yards! / YD_PER_NM);
  const marks: Scene['marks'] = [{ pos: now, kind: 'own', label: 'Now' }];
  if (!opts.length) return { marks, tracks: [], rows: [], warn: `She is already within ${Ly(c, yards!)}, or that distance cannot be kept at ${c.stationingSpeed} kn.` };
  const first = opts[0], relOwn = neg(first.rel), span = first.minutes / 60;
  return {
    marks: [...marks, { pos: { x: now.x + relOwn.x * span, y: now.y + relOwn.y * span }, kind: 'point', label: `Pass ${first.side}` }],
    tracks: [{ pts: [now, { x: now.x + relOwn.x * span * 1.3, y: now.y + relOwn.y * span * 1.3 }], kind: 'rel' }],
    play: { totalHours: span, at: t => ({ x: now.x + relOwn.x * t, y: now.y + relOwn.y * t }) },
    rows: opts.map(o => [`Pass ${o.side} of her`, `steer ${b3(o.course)}: closest in ${o.minutes.toFixed(1)} min`] as [string, string]),
  };
}

/** Own ship slower than the Guide: the course that brings her nearest. */
export function fasterScene(c: Common): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [c.guideSpeed, "the Guide's speed"], [c.stationingSpeed, 'the speed available (stationing speed)'], [c.nowBearing, 'own station'], [c.nowYards, 'own station distance']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const now = nowOf(c), r = closeFaster(neg(now), c.guideCourse!, c.guideSpeed!, c.stationingSpeed!);
  const marks: Scene['marks'] = [{ pos: now, kind: 'own', label: 'Now' }];
  if (!r) return { marks, tracks: [], rows: [], warn: 'She cannot be closed: the range only opens.' };
  const relOwn = neg(r.rel), span = r.minutes / 60, end = { x: now.x + relOwn.x * span, y: now.y + relOwn.y * span };
  return {
    marks: [...marks, { pos: end, kind: 'point', label: 'Nearest' }], tracks: [{ pts: [now, end], kind: 'rel' }],
    play: { totalHours: span, at: t => ({ x: now.x + relOwn.x * t, y: now.y + relOwn.y * t }) },
    rows: [['Steer', `${b3(r.course)} at ${c.stationingSpeed} kn`], ['Nearest', `${L(c, r.cpa)} in ${r.minutes.toFixed(1)} min, the Guide bearing ${b3(r.bearing)}`]],
  };
}

// ---- round the clock (BR 45(6) 0429): the book's advice, and the manoeuvre ---------------------------------------------------------------------
const ST_ANGLE: Record<Station, number> = { Ahead: 0, 'Bow (45)': 45, Abeam: 90, Quarter: 135, Astern: 180 };
/** The true bearing from the Guide of a standard station on her port or starboard side. */
export const stationTrue = (guideCourse: number, st: Station, side: 'Port' | 'Starboard') => (((guideCourse + (side === 'Port' ? -1 : 1) * ST_ANGLE[st]) % 360) + 360) % 360;
/** The book's advice for the change, with its manoeuvre: the fishtail from the turning table when it is one, the course to steer when it is at
 *  stationing speed, otherwise the two stations. */
export function rtcScene(c: Common, from: Station, to: Station, side: 'Port' | 'Starboard', sides: 'same' | 'opposite', yards: number, fishtail: CalculationResult | null): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"]]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const sol = roundTheClock(from, to, sides);
  const fromB = stationTrue(c.guideCourse!, from, side), toB = stationTrue(c.guideCourse!, to, from === 'Abeam' && to === 'Abeam' && sides === 'opposite' ? (side === 'Port' ? 'Starboard' : 'Port') : side);
  const cc: Common = { ...c, nowBearing: fromB, nowYards: yards, nextBearing: toB, nextYards: yards };
  if (!sol) return { marks: [{ pos: nowOf(cc), kind: 'own', label: from }, { pos: nextOf(cc), kind: 'station', label: to }], tracks: [], rows: [], warn: from === to && from !== 'Abeam' ? 'Those are the same station.' : 'Para 0429 gives no suggested solution for that change: use Station for the course to steer.' };
  const advice = sol.text.map((t, i) => [i === 0 ? `${sol.speed} (para ${sol.para})` : '', t] as [string, string]);
  const inner = sol.fishtail ? fishtailScene(cc, fishtail, `${sol.fishtail.kind === 'half' ? 'Half' : sol.fishtail.kind === 'full' ? 'Full' : 'Unbalanced'} fishtail`)
    : sol.speed === 'Stationing speed' ? stationScene(cc, null)
      : { marks: [{ pos: nowOf(cc), kind: 'own' as MarkKind, label: from }, { pos: nextOf(cc), kind: 'station' as MarkKind, label: to }], tracks: [{ pts: [nowOf(cc), nextOf(cc)], kind: 'construction' as const }], rows: [] };
  return { ...inner, rows: [...advice, ...inner.rows], warn: [sol.warning ? 'Serious risk of collision if altering toward the Guide from standard distance on the beam.' : '', inner.warn ?? ''].filter(Boolean).join(' ') || undefined };
}

// ---- RAS: the approach alongside, drawn about the Guide -----------------------------------------------------------------------------------------
export interface RasGeometry {
  /** own bridge is this far ahead of own matching mark (m), and the ships' centre lines this far apart (m) */
  bridgeAheadOfMarkM: number; lateralM: number;
  /** the Guide on own port side (own ship on her starboard side), or the reverse */
  guideTo: 'Port' | 'Starboard';
  standbyYd: number;
}
/** The approach drawn with the Guide's matching mark at the centre: own bridge from the stand-by station to where she starts slowing, then on to the final station. */
export function rasScene(c: Common, p: Plan | null, g: RasGeometry): Scene {
  const need = needs([[c.guideCourse, "the Guide's course"], [p && !p.missing.length ? p : null, p?.missing.length ? p.missing.join(', ') : 'the speeds and surge rate']]);
  if (need.length) return { marks: [], tracks: [], rows: [], need };
  const M = 1852, a = (c.guideCourse! * Math.PI) / 180, side = g.guideTo === 'Port' ? 1 : -1;
  const at = (alongM: number): Vec => { const x = side * g.lateralM, y = alongM; return { x: (x * Math.cos(a) + y * Math.sin(a)) / M, y: (-x * Math.sin(a) + y * Math.cos(a)) / M }; };
  const P = p!, fin = g.bridgeAheadOfMarkM, slow = fin - P.surgeM, stand = fin - g.standbyYd * 0.9144;
  const runH = P.atOnce ? 0 : P.runYd / (P.advantage * YD_PER_NM), slowH = (2 * P.surgeYd) / (P.advantage * YD_PER_NM);   // slowing evenly: half the advantage on average
  const start = P.atOnce ? stand : slow;
  return {
    marks: [{ pos: at(stand), kind: 'own', label: 'Stand-by' }, ...(P.atOnce ? [] : [{ pos: at(slow), kind: 'slow' as MarkKind, label: 'Slow' }]), { pos: at(fin), kind: 'station', label: 'Final' }],
    tracks: [{ pts: [at(stand), at(fin)], kind: 'rel' }],
    play: { totalHours: runH + slowH, at: t => {
      if (t < runH) return at(stand + P.advantage * YD_PER_NM * t * 0.9144);
      const tau = Math.min(t - runH, slowH), s = slowH > 0 ? (fin - start) * (2 * tau / slowH - (tau / slowH) ** 2) : fin - start;
      return at(start + s);
    } },
    rows: [
      ['Surge', `${Ly(c, P.surgeYd)} (${P.advantage.toFixed(1)} kn advantage)`],
      ['x, her stern to your stem', P.xM >= 0 ? `${P.xM.toFixed(1)} m clear` : `${(-P.xM).toFixed(1)} m overlap`],
      ['Slow when her stern bears', `${trueFromAhead(P.aheadDeg, c.guideCourse!, g.guideTo).toFixed(1).padStart(5, '0')}°T (${g.guideTo === 'Port' ? 'Red' : 'Green'} ${P.aheadDeg.toFixed(1)}° from right ahead)`],
      ...(P.radar ? [['From your radar, her stern', `${Ly(c, Math.abs(P.radar.rangeM) / 0.9144)} ${P.radar.rangeM >= 0 ? 'ahead' : 'abaft'}`] as [string, string]] : []),
      ['From the stand-by station', P.atOnce ? 'slow at once' : `run ${Ly(c, P.runYd)}, then slow`],
    ],
  };
}
