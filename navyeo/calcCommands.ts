// What NavYeo works out itself when a request gives the numbers: CPA, angle on the bow, time-speed-distance, course to steer, compass and gyro,
// regaining track, Corpen (from the ship's turning data), fuel, unit conversion and horizons. Each answer is the same sum the tool does (the pure
// functions in tools/), and the tool is opened with the numbers filled in so they can be checked or changed. When something is missing it asks for it,
// and the next short reply ("12 knots") is joined to the request (see interpretWithPending in commands.ts). No AI: keyword matching. Pure.
import { angleOnBow, compassToTrue, convertLength, convertUnit, courseToSteer, cpa, LENGTH_UNITS, navyLength, norm360, radarRange, solveRadian, solveTSD, targetCourseFromBowAngle, trueFromGyro, trueToCompass, UNIT_GROUPS, visibleRange } from '../tools/navMath.ts';
import type { LengthUnit } from '../tools/navMath.ts';
import { YD_PER_CABLE, abreastTurn, columnTurn, distanceToRegain, throwOffToRegain, yardsRun } from '../tools/manoeuvres.ts';
import { lookupTurn as shipTurn } from '../tools/turnLookup.ts';
import { bySpeed, endurance, hm, passage, points } from '../tools/fuel.ts';
import { decimalDegrees, degMinSec, degMinutes, greatCircle, greatCircleDestination, hoursMinutes, rhumb, rhumbDestination } from '../tools/positions.ts';
import type { Ship } from '../types.ts';
import { NUM, lengthAfter, num } from './parse.ts';

export interface CalcCtx { unit: LengthUnit; shipName?: string; turning?: Pick<Ship, 'turningDataSets'>; fuel?: Ship['fuelData'] }
export type CalcReply =
  | { kind: 'say'; say: string; wait?: boolean; next?: string }
  | { kind: 'open'; tool: string; say: string; form?: { id: string; values: Record<string, string> }; memory?: Record<string, unknown>; wait?: boolean; next?: string };

const b3 = (n: number) => String(Math.round(norm360(n)) % 360).padStart(3, '0');
const r1 = (n: number) => String(Math.round(n * 10) / 10);
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.round(m)} min`);
const ask = (say: string, next?: string): CalcReply => ({ kind: 'say', say, wait: true, ...(next ? { next } : {}) });
const open = (tool: string, id: string, values: Record<string, string>, say: string, memory?: Record<string, unknown>): CalcReply => ({ kind: 'open', tool, form: { id, values }, say, memory });

const OWN = '(?:own|my|our|ship\'?s?|ownship)', TGT = '(?:target|contact|his|her|their|other (?:ship|vessel))';
const val = (t: string, re: string) => num(t, re);
/** Distance with a unit word in nautical miles, from a few labels; `dflt` is the unit when none is written. */
const dist = (t: string, labels: string, dflt: LengthUnit): { nm: number; value: number; unit: LengthUnit } | null => {
  const d = lengthAfter(t, labels);
  if (!d) return null;
  const unit = d.unit ?? dflt;
  return { nm: convertLength(d.value, unit, 'nm'), value: d.value, unit };
};
const knots = (t: string, label?: string) => (label ? val(t, `${label}\\s*(?:speed)?\\s*(?:of|is|=)?\\s*${NUM}`) : null) ?? val(t, `${NUM}\\s*(?:kn|kts?|knots?)\\b`);
const signed = (t: string, label: string): number | null => {
  const m = new RegExp(`${label}\\s*(?:of|is|=|:)?\\s*${NUM}\\s*°?\\s*(east(?:erly)?|west(?:erly)?|e|w)?\\b`).exec(t);
  return m ? parseFloat(m[1]) * (m[2] && m[2][0] === 'w' ? -1 : 1) : null;
};

// ---- CPA / TCPA -----------------------------------------------------------------------------------------------------
function cpaAnswer(t: string): CalcReply | null {
  if (!/\b(?:cpa|tcpa|closest point(?: of approach)?|will (?:she|he|it|we) (?:pass|collide)|collision course|risk of collision)\b/.test(t)) return null;
  // spoken: "i am on 090 at 12", "he is on 270 doing 8"
  const ME = '(?:i am|i\'m|im|we are|we\'re|i\'m)\\s+(?:on|steering|heading|making good)', HIM = '(?:he|she|it|they|the (?:contact|target))\\s+(?:is|are|\'s)?\\s*(?:on|steering|heading)';
  const SPD = '\\s*(?:°|degrees?)?\\s*(?:at|doing|making|speed)\\s*(?:of)?\\s*';
  const spokenSpeed = (who: string) => { const m = new RegExp(`${who}\\s*${NUM}${SPD}${NUM}`).exec(t); return m ? parseFloat(m[2]) : null; };
  const oc = val(t, `${OWN}\\s+(?:course|heading|crs)\\s*(?:of|is|=)?\\s*${NUM}`) ?? val(t, `${ME}\\s*${NUM}`);
  const os = val(t, `${OWN}\\s+speed\\s*(?:of|is|=)?\\s*${NUM}`) ?? spokenSpeed(ME);
  const tc = val(t, `${TGT}\\s+(?:course|heading|crs)\\s*(?:of|is|=)?\\s*${NUM}`) ?? val(t, `(?:his|her|their)\\s+course\\s*${NUM}`) ?? val(t, `${HIM}\\s*${NUM}`);
  const ts = val(t, `${TGT}\\s+speed\\s*(?:of|is|=)?\\s*${NUM}`) ?? (() => { const m = new RegExp(`${TGT}\\s+(?:course|heading|crs)\\s*(?:of|is|=)?\\s*${NUM}[^0-9a-z]*(?:and\\s+)?(?:speed|at)\\s*(?:of|is|=)?\\s*${NUM}`).exec(t); return m ? parseFloat(m[2]) : null; })() ?? spokenSpeed(HIM);
  const brg = val(t, `(?:bearing|bears|brg|brng)\\s*(?:of|is|=)?\\s*${NUM}`);
  const r = dist(t, 'range|rng|distance|at a range of', 'nm') ?? dist(t, 'at', 'nm');
  const slots: [unknown, string, string, string][] = [[oc, 'own course', 'own course', 'your course'], [os, 'own speed', 'own speed', 'your speed'], [brg, 'bearing of the target', 'bearing', "the target's bearing"], [r, 'range', 'range', 'the range'], [tc, 'target course', 'target course', "the target's course"], [ts, 'target speed', 'target speed', "the target's speed"]];
  const gaps = slots.filter(([v]) => v === null), missing = gaps.map(([, name]) => name);
  const values: Record<string, string> = {};
  const put = (k: string, v: number | null | undefined) => { if (v !== null && v !== undefined) values[k] = String(v); };
  put('oc', oc); put('os', os); put('brg', brg); put('rng', r?.value); put('tc', tc); put('ts', ts);
  const memory = r ? { 'pref:cpa:range': r.unit } : undefined;
  // part of a request: the tool is opened with what was given, and the rest is asked for (the next reply is joined to this request)
  if (missing.length) return Object.keys(values).length ? { ...open('CPA / TCPA', 'cpa', values, `Opened CPA with ${Object.keys(values).length} value${Object.keys(values).length > 1 ? 's' : ''} filled in. I still need: ${missing.join(', ')}. What is ${gaps[0][3]}?`, memory), wait: true, next: gaps[0][2] } : null;
  const x = cpa({ ownCourse: oc!, ownSpeed: os!, bearing: brg!, range: r!.nm, targetCourse: tc!, targetSpeed: ts! });
  const side = x.status === 'closing' && x.cpa < 0.05 ? ' She is on a collision course: no change of bearing.' : x.status === 'closing' ? ` The target will be ${(() => { const d = ((x.bearingAtCpa - oc! + 540) % 360) - 180; return Math.abs(d) < 10 ? 'right ahead' : Math.abs(d) > 170 ? 'right astern' : d > 0 ? `on the starboard side (${b3(x.bearingAtCpa)}°)` : `on the port side (${b3(x.bearingAtCpa)}°)`; })()} at the closest point.` : '';
  const say = x.status === 'steady' ? `No relative motion: the range stays ${r2(r!.nm)} nm.`
    : x.status === 'opening' ? `The range is opening: the closest point has passed (CPA is now, ${r2(x.cpa)} nm). Relative speed ${r1(x.relativeSpeed)} kn on ${b3(x.relativeCourse!)}°.`
      : `CPA ${r2(x.cpa)} nm (${r1(x.cpa * 10)} cables) in ${mins(x.tcpaMinutes!)}; relative speed ${r1(x.relativeSpeed)} kn on ${b3(x.relativeCourse!)}°.${side}${x.cpa < 1 ? ' Inside 1 nm: this is a close-quarters situation, so take early, substantial action (Rules 8, 15 to 19).' : ''}`;
  return open('CPA / TCPA', 'cpa', values, say, memory);
}

// ---- Angle on the bow -----------------------------------------------------------------------------------------------
function atbAnswer(t: string): CalcReply | null {
  if (!/\b(?:atb|angle on the bow|bow angle)\b/.test(t)) return null;
  const brg = val(t, `(?:bearing|bears|brg)\\s*(?:of|is|=)?\\s*${NUM}`);
  const colour = new RegExp(`\\b(green|red|stbd|starboard|port)\\s*${NUM}`).exec(t);
  const tc = val(t, `(?:${TGT}\\s+)?(?:course|heading)\\s*(?:of|is|=)?\\s*${NUM}`);
  if (brg === null) return null;
  if (tc !== null) {
    const a = angleOnBow(brg, tc);
    const say = a.side === null ? `Angle on the bow ${a.angle === 0 ? '0° (we are right ahead of the target)' : '180° (we are right astern of it)'}.` : `Angle on the bow ${r1(a.angle)}° ${a.side === 'Port' ? 'red (port)' : 'green (starboard)'}: the target's head is ${r1(a.angle)}° to ${a.side === 'Port' ? 'port' : 'starboard'} of the line of sight from it to us.`;
    return open('Angle on the Bow (ATB)', 'atb', { brg: String(brg), course: String(tc) }, say, { 'atb:mode': 'angle' });
  }
  const labelled = val(t, `angle(?: on the bow)?\\s*(?:of|is|=)?\\s*${NUM}`);
  if (colour || labelled !== null) {
    const angle = colour ? parseFloat(colour[2]) : labelled!;
    const word = colour ? colour[1] : /\b(?:port|red)\b/.test(t) ? 'port' : 'starboard';
    const side = word === 'red' || word === 'port' ? 'Port' : 'Starboard';
    return open('Angle on the Bow (ATB)', 'atb', { brg: String(brg), angle: String(angle) }, `Target course ${b3(targetCourseFromBowAngle(brg, angle, side))}° (bearing ${b3(brg)}°, angle on the bow ${side === 'Port' ? 'red' : 'green'} ${angle}°).`, { 'atb:mode': 'course', 'atb:side': side });
  }
  return ask('For the angle on the bow I need the target\'s course ("course 270") or the angle ("green 30"), with the bearing.');
}

// ---- Time, speed, distance ------------------------------------------------------------------------------------------
function tsdAnswer(t: string): CalcReply | null {
  const hasDist = /\b(?:dist(?:ance)?|run|steam|how far|miles?|nm)\b/.test(t), hasSpeed = /\bspeed\b/.test(t) || /\d\s*(?:kn|kts|knots)\b/.test(t), hasTime = /\btime\b|how long|\d\s*(?:min|mins|minutes?|hours?|hrs?|h)\b/.test(t);
  if (!(/\btsd\b|time[ ,/-]*speed[ ,/-]*dist/.test(t) || [hasDist, hasSpeed, hasTime].filter(Boolean).length >= 2)) return null;
  if (/\b(?:cpa|atb|hsa|bearing|course|wheel|advance|transfer|reciprocal|fuel|tonnes?|corpen|regain|off track|throw|horizon|convert|set|drift|anchor|tide|shackles?)\b/.test(t)) return null;
  const d = (/\b(?:dist(?:ance)?|run|steam)\s*(?:of|is|=)?\s*-?\d/.test(t) ? dist(t, 'dist(?:ance)?|run|steam', 'nm') : null);
  const dd = d ?? (() => { const m = new RegExp(`${NUM}\\s*(nm|nautical miles?|miles?|cables?)\\b`).exec(t); return m ? { nm: convertLength(parseFloat(m[1]), /^cable/.test(m[2]) ? 'cables' : 'nm', 'nm'), value: parseFloat(m[1]), unit: (/^cable/.test(m[2]) ? 'cables' : 'nm') as LengthUnit } : null; })();
  const s = knots(t, 'speed');
  const tm = new RegExp(`${NUM}\\s*(min|mins|minutes?|hours?|hrs?|h)\\b`).exec(t);
  const minutes = tm ? (/^h/.test(tm[2]) ? parseFloat(tm[1]) * 60 : parseFloat(tm[1])) : null;
  const r = solveTSD({ distance: dd?.nm ?? null, speed: s, minutes });
  if (!r) return null;
  const values: Record<string, string> = {};
  if (dd) values.d = String(dd.value); if (s !== null) values.s = String(s); if (minutes !== null) values.t = String(minutes);
  const memory = dd ? { 'pref:tsd:unit': dd.unit } : undefined;
  const say = r.solved === 'minutes' ? `Time ${mins(r.minutes)} (${r2(r.distance)} nm at ${r1(r.speed)} kn).`
    : r.solved === 'distance' ? `Distance ${r2(r.distance)} nm (${r1(r.distance * 10)} cables) in ${mins(r.minutes)} at ${r1(r.speed)} kn.`
      : `Speed ${r1(r.speed)} kn (${r2(r.distance)} nm in ${mins(r.minutes)}).`;
  return open('Time / Speed / Distance', 'tsd', values, say, memory);
}

// ---- Course to steer ------------------------------------------------------------------------------------------------
function ctsAnswer(t: string): CalcReply | null {
  if (!/\b(?:course to steer|set and drift|cts|tidal triangle|make good|allow for (?:the )?(?:set|current|tide))\b/.test(t) && !(/\bset\b/.test(t) && /\bdrift\b/.test(t))) return null;
  const track = val(t, `(?:track|make good|ground track|course to make good)\\s*(?:of|is|=)?\\s*${NUM}`);
  const speed = knots(t, '(?:ship|ship\'s|my|own|through the water|speed)') ?? knots(t);
  const set = val(t, `set\\s*(?:of|is|=)?\\s*${NUM}`), drift = val(t, `drift\\s*(?:of|is|=)?\\s*${NUM}`);
  const gaps = ([[track, 'the track to make good', 'track'], [speed, 'your speed through the water', 'speed'], [set, 'the set', 'set'], [drift, 'the drift', 'drift']] as [number | null, string, string][]).filter(([v]) => v === null);
  const missing = gaps.map(([, name]) => name);
  if (missing.length) return ask(`For the course to steer I need ${missing.join(', ')}. What is ${missing[0]}? (Or all at once: "track 090 speed 12 set 045 drift 2".)`, gaps[0][2]);
  const x = courseToSteer(track!, speed!, set!, drift!);
  if ('error' in x) return { kind: 'say', say: x.error };
  const d = dist(t, 'for|dist(?:ance)?', 'nm');
  const run = d ? ` ${r2(d.nm)} nm takes ${mins((d.nm / x.sog) * 60)}.` : '';
  return open('Course to Steer', 'cts', { track: String(track), speed: String(speed), set: String(set), drift: String(drift), ...(d ? { dist: String(d.value) } : {}) },
    `Steer ${b3(x.cts)}° (allowance ${r1(Math.abs(x.allowance))}° ${x.allowance < 0 ? 'to port' : 'to starboard'} of the track ${b3(track!)}°); speed over the ground ${r1(x.sog)} kn.${run}`);
}

// ---- Compass, gyro --------------------------------------------------------------------------------------------------
function compassAnswer(t: string): CalcReply | null {
  const isGyro = /\bgyro\b/.test(t), isCompass = /\b(?:compass|magnetic|deviation|variation)\b/.test(t);
  if (!(isGyro || isCompass)) return null;
  if (isGyro && !isCompass) {
    const g = val(t, `gyro\\s*(?:course|heading|bearing)?\\s*(?:of|is|=)?\\s*${NUM}`), e = signed(t, '(?:gyro )?error');
    if (g === null) return null;
    if (e === null) return ask('What is the gyro error? For example "gyro 045 error 2 west".', 'error');
    return open('Bearings & Positions', 'gyro', { gyro: String(g), err: String(e) }, `True ${b3(trueFromGyro(g, e))}° (gyro ${b3(g)}°, error ${Math.abs(e)}° ${e < 0 ? 'W' : 'E'}).`, { 'bpu:tab': 'compass' });
  }
  const toCompass = /\b(?:true to compass|to compass|steer by compass|compass course for)\b/.test(t) || /\btrue\s*(?:course)?\s*\d/.test(t) && !/\bcompass\s*(?:course)?\s*\d/.test(t);
  const course = toCompass ? val(t, `(?:true|course)\\s*(?:course)?\\s*(?:of|is|=)?\\s*${NUM}`) : val(t, `compass\\s*(?:course|heading)?\\s*(?:of|is|=)?\\s*${NUM}`);
  const v = signed(t, 'var(?:iation)?'), dv = signed(t, 'dev(?:iation)?');
  if (course === null) return null;
  const missing = [v === null && 'variation', dv === null && 'deviation'].filter(Boolean);
  if (missing.length) return ask(`I need the ${missing.join(' and ')}, with E or W (easterly +, westerly -). What is the ${missing[0]}? For example "3 W".`, v === null ? 'var' : 'dev');
  const out = toCompass ? trueToCompass(course, dv!, v!) : compassToTrue(course, dv!, v!);
  return open('Bearings & Positions', 'compass', { course: String(course), var: String(v), dev: String(dv) },
    toCompass ? `Steer ${b3(out)}° by compass for a true course of ${b3(course)}° (variation ${Math.abs(v!)}° ${v! < 0 ? 'W' : 'E'}, deviation ${Math.abs(dv!)}° ${dv! < 0 ? 'W' : 'E'}).`
      : `True ${b3(out)}° from compass ${b3(course)}° (variation ${Math.abs(v!)}° ${v! < 0 ? 'W' : 'E'}, deviation ${Math.abs(dv!)}° ${dv! < 0 ? 'W' : 'E'}).`,
    { 'compass:dir': toCompass ? 'toCompass' : 'toTrue', 'bpu:tab': 'compass' });
}

// ---- Regain track ---------------------------------------------------------------------------------------------------
function regainAnswer(t: string): CalcReply | null {
  if (!/\b(?:regain(?:ing)? (?:the )?track|throw[- ]?off|off[- ]track|cross[- ]track)\b/.test(t)) return null;
  const off = dist(t, 'off[- ]track|cross[- ]track|xte|off', 'cables');
  const th = val(t, `(?:throw[- ]?off|alter(?:ation)?|angle)\\s*(?:of|is|=|by)?\\s*${NUM}`);
  const m = /(?:in|within)\s*(-?\d+(?:\.\d+)?)\s*(min|mins|minutes?|hours?|hrs?|h)\b/.exec(t);
  const minutes = m ? (/^h/.test(m[2]) ? parseFloat(m[1]) * 60 : parseFloat(m[1])) : null;
  const kn = knots(t, 'speed');
  if (!off) return ask('How far off track are you? For example "off track 2 cables, throw-off 10".');
  const offCables = convertLength(off.value, off.unit, 'cables');
  if (th !== null && th > 0) {
    const run = distanceToRegain(offCables, th);
    const time = kn !== null && kn > 0 ? ` At ${kn} kn that is ${mins((run * YD_PER_CABLE * 3600) / (kn * 2000) / 60)}.` : '';
    return open('Regain Track', 'regain', { off: String(offCables), th: String(th), ...(kn !== null ? { kn: String(kn) } : {}) }, `Alter ${th}° toward the track: you regain it after ${r1(run)} cables (${r2(run / 10)} nm).${time}`);
  }
  if (minutes !== null && kn !== null && kn > 0) {
    const runCables = yardsRun(kn, minutes * 60) / YD_PER_CABLE;
    const need = throwOffToRegain(offCables, runCables);
    return open('Regain Track', 'regain', { off: String(offCables), kn: String(kn), min: String(minutes) }, `To be back on track in ${mins(minutes)} at ${kn} kn (${r1(runCables)} cables run), throw off ${r1(need)}° toward the track.`);
  }
  return ask('Give a throw-off angle ("throw-off 10"), or the time you want ("regain in 20 minutes at 12 knots").');
}

// ---- Corpen ---------------------------------------------------------------------------------------------------------
function corpenAnswer(t: string, ctx: CalcCtx): CalcReply | null {
  if (!/\bcorpen\b|alter course in station|alter (?:course )?by corpen/.test(t) || /flying/.test(t)) return null;
  const abreast = /\babreast\b|\bcorpen ['’]?s\b|\babeam\b/.test(t);
  const speed = knots(t, 'speed');
  const d = dist(t, 'astern|abeam|distance|station|dist', 'cables');
  const angle = val(t, `${NUM}\\s*(?:°|deg(?:rees?)?)\\s*(?:turn|alteration)?`) ?? val(t, `(?:turn|alter(?:ation)?|angle)\\s*(?:of|by|is|=)?\\s*${NUM}`) ?? 90;
  const side: 'Port' | 'Starboard' = /\b(?:port|red)\b/.test(t) ? 'Port' : 'Starboard';
  const missing = [speed === null && 'your speed', !d && (abreast ? 'the distance abeam' : 'the distance astern')].filter(Boolean);
  if (missing.length) return ask(`For Corpen I need ${missing.join(' and ')}. For example "corpen ${abreast ? 'abreast 4 cables' : 'astern 5 cables'} speed 12 turn ${angle} to ${side.toLowerCase()}".`);
  const cables = convertLength(d!.value, d!.unit, 'cables');
  let adv = val(t, `advance\\s*(?:of|is|=)?\\s*${NUM}`), tr = val(t, `transfer\\s*(?:of|is|=)?\\s*${NUM}`), sec = val(t, `(?:time(?: to turn)?|turn time)\\s*(?:of|is|=)?\\s*${NUM}`);
  let from = 'the figures you gave';
  let loss: number | undefined;
  if ((adv === null || tr === null || sec === null) && ctx.turning) {
    const pick = shipTurn(ctx.turning, side, speed!, angle);
    if (pick) { adv ??= pick.advance; tr ??= pick.transfer; sec ??= pick.seconds; loss = pick.loss; from = `${ctx.shipName ?? 'the ship'}'s turning data (${pick.interpolatedSpeed ? `${pick.speedFrom} to ${pick.speedTo} kn` : `${pick.speed} kn`}, ${pick.wheel}° wheel${pick.outsideTurn ? ', the largest recorded turn' : ''})`; }
  }
  if (adv === null || tr === null || sec === null)
    return ask(`${ctx.shipName ?? 'The ship'} has no turning data for a ${angle}° turn to ${side.toLowerCase()} at ${speed} kn. Give the ship's advance, transfer and time to turn, for example "advance 450 transfer 250 time 70".`);
  const values: Record<string, string> = { kn: String(speed), dc: String(cables), an: String(angle), adv: r1(adv), tr: r1(tr), tt: String(Math.round(sec)) };
  const memory = { 'corpen:mode': abreast ? 'abreast' : 'column', 'corpen:side': side };
  const stop = (cables * YD_PER_CABLE / (speed! * 2000)) * 3600;
  if (abreast) {
    const lossYd = loss !== undefined ? yardsRun(loss / 2, sec) : 0;
    const x = abreastTurn({ knots: speed!, range: cables * YD_PER_CABLE, transfer: tr, turnSeconds: sec, lossYards: lossYd });
    if (!x) return { kind: 'say', say: 'The distance abeam must be more than zero.' };
    return open('Corpen', 'corpen', values, `Corpen 'S', ${cables} cables abeam at ${speed} kn, ${angle}° to ${side.toLowerCase()} (from ${from}): the Guide draws ahead ${Math.round(x.netAhead)} yd while you turn; alter when she bears ${r1(90 - x.radian)}° off your beam toward the bow (radian rule; exact ${r1(90 - x.exact)}°).${angle !== 90 ? ' The abreast rule is the school\'s 90° form: only an estimate for this angle.' : ''}`, memory);
  }
  const x = columnTurn({ knots: speed!, distance: cables * YD_PER_CABLE, advance: adv, transfer: tr, turnSeconds: sec, angle });
  if (!x) return { kind: 'say', say: 'That turn cannot be worked: the distance astern is too short for the turn figures.' };
  return open('Corpen', 'corpen', values, `Corpen, ${cables} cables astern at ${speed} kn, ${angle}° to ${side.toLowerCase()} (from ${from}): stopwatch ${Math.floor(stop / 60)} min ${String(Math.round(stop % 60)).padStart(2, '0')} s after the Guide's wheel-over; or alter when the Guide bears ${r1(x.bearing)}° off your bow on the ${side.toLowerCase()} side (${Math.abs(Math.round(x.early))} yd ${x.early >= 0 ? 'before' : 'after'} her wheel-over point). The Guide runs ${Math.round(x.guideRun)} yd meanwhile.`, memory);
}

// ---- Fuel -----------------------------------------------------------------------------------------------------------
function fuelAnswer(t: string, ctx: CalcCtx): CalcReply | null {
  if (!/\b(?:fuel|endurance|tonnes?|tons?)\b/.test(t) || /\b(?:corpen|anchor)\b/.test(t)) return null;
  const regimes = (ctx.fuel?.regimes ?? []).filter(r => points(r).length > 0);
  if (!regimes.length) return { kind: 'say', say: `${ctx.shipName ?? 'The ship'} has no fuel data yet. Add it under Calibration Data, Fuel Data.` };
  const speed = knots(t, 'speed');
  const fuel = val(t, `${NUM}\\s*(?:tonnes?|tons?|t)\\b`) ?? val(t, `fuel\\s*(?:of|is|=)?\\s*${NUM}`);
  const d = dist(t, 'for|distance|dist|passage|steam|run', 'nm') ?? (() => { const m = new RegExp(`${NUM}\\s*(nm|nautical miles?|miles?)\\b`).exec(t); return m ? { nm: parseFloat(m[1]), value: parseFloat(m[1]), unit: 'nm' as LengthUnit } : null; })();
  const named = regimes.find(r => r.name && new RegExp(`\\b${r.name.toLowerCase().replace(/[^a-z0-9 ]/g, '')}\\b`).test(t));
  const regime = named ?? regimes[0];
  if (speed === null) return ask(`At what speed? For example "fuel ${fuel ?? 100} tonnes at 14 knots" or "fuel for ${d?.value ?? 300} nm at 14 knots". (Regime: ${regime.name || 'first'}.)`);
  const at = bySpeed(regime, speed);
  if (!at) return { kind: 'say', say: 'No usable fuel rows for that regime.' };
  const note = `${ctx.shipName ?? 'The ship'}, ${regime.name || 'regime'}: ${r1(at.rate)} t/h at ${speed} kn${at.outside ? ' (outside the table: nearest row)' : ''}.`;
  if (fuel !== null && /\b(?:how far|endurance|range|last|on)\b|\btonnes?\b|\btons?\b/.test(t) && (d === null || /how far|endurance|last/.test(t))) {
    const e = endurance(fuel, speed, at.rate);
    return e ? open('Fuel Planning', 'fuel', { fuel: String(fuel), speed: String(speed) }, `${note} ${fuel} t lasts ${hm(e.hours)} and takes her ${r1(e.distanceNm)} nm.`, { 'fuel:mode': 'forward', 'fuel:by': 'speed', 'fuel:regime': regime.id }) : null;
  }
  if (d) {
    const p = passage(d.nm, speed, at.rate);
    return p ? open('Fuel Planning', 'fuel', { dist: String(d.nm), speed: String(speed) }, `${note} ${r1(d.nm)} nm takes ${hm(p.hours)} and ${r1(p.fuelTonnes)} t of fuel.`, { 'fuel:mode': 'reverse', 'fuel:by': 'speed', 'fuel:regime': regime.id }) : null;
  }
  return ask(`Give the fuel left ("fuel 100 tonnes") or the distance ("for 300 nm"). ${note}`);
}

// ---- Units and horizons ---------------------------------------------------------------------------------------------
const UNIT_NAMES: [RegExp, string][] = [
  [/^(?:nm|nautical miles?|miles?)$/, 'nautical mile'], [/^(?:cables?)$/, 'cable (0.1 nm)'], [/^(?:km|kilomet(?:re|er)s?)$/, 'kilometre'], [/^(?:m|metres?|meters?)$/, 'metre'],
  [/^(?:yards?|yds?)$/, 'yard'], [/^(?:ft|feet|foot)$/, 'foot'], [/^(?:fm|fathoms?)$/, 'fathom'], [/^(?:statute miles?)$/, 'statute mile'],
  [/^(?:kn|kts?|knots?)$/, 'knot'], [/^(?:m\/s|mps|metres? per second|meters? per second)$/, 'metre/second'], [/^(?:km\/h|kph|kmh|kilomet(?:re|er)s? per hour)$/, 'kilometre/hour'], [/^(?:mph|miles? per hour)$/, 'mile/hour'],
];
const unitOf = (w: string) => UNIT_NAMES.find(([re]) => re.test(w.trim()))?.[1];

function convertAnswer(t: string): CalcReply | null {
  const m = new RegExp(`(?:convert\\s*)?${NUM}\\s*([a-z/ ]+?)\\s+(?:to|in|into|as)\\s+([a-z/ ]+?)$`).exec(t);
  if (!m || !/\b(?:convert|in|into)\b|\bto\b/.test(t)) return null;
  const from = unitOf(m[2]), to = unitOf(m[3]);
  if (!from || !to) return null;
  const g = UNIT_GROUPS.find(x => from in x.units && to in x.units);
  if (!g) return { kind: 'say', say: `${m[2].trim()} and ${m[3].trim()} are not the same kind of unit.` };
  const v = parseFloat(m[1]), out = convertUnit(v, from, to, g);
  const plural = (u: string, n: number) => (n === 1 || u.includes('/') ? u : `${u}s`);
  return { kind: 'say', say: `${v} ${plural(from, v)} = ${Math.abs(out) >= 100 ? r1(out) : Math.round(out * 1000) / 1000} ${plural(to, out)}.` };
}

function horizonAnswer(t: string): CalcReply | null {
  if (!/\b(?:horizon|visible range|range of visibility|geographic(?:al)? range|radar range|how far can i see|dipping range)\b/.test(t)) return null;
  const eye = val(t, `(?:eye|height of eye|hoe|antenna|mast|my height)\\s*(?:height)?\\s*(?:of|is|=)?\\s*${NUM}`) ?? val(t, `height\\s*(?:of|is|=)?\\s*${NUM}`);
  const obj = val(t, `(?:object|target|light|lighthouse|ship)\\s*(?:height)?\\s*(?:of|is|=)?\\s*${NUM}`);
  if (eye === null) return ask('What is the height of eye (or antenna) in metres? For example "horizon eye 12 m target 30 m".');
  const radar = /radar/.test(t);
  if (obj !== null) return open('Distance Off & Horizon', 'horizon', { eye: String(eye), obj: String(obj) }, `${radar ? 'Radar' : 'Visual'} range between height ${eye} m and ${obj} m: ${r1(radar ? radarRange(eye, obj) : visibleRange(eye, obj))} nm (standard coefficients).`, { 'do:tab': 'horizon' });
  return open('Distance Off & Horizon', 'horizon', { eye: String(eye) }, `Horizon from ${eye} m: visual ${r1(visibleRange(eye, 0))} nm, radar ${r1(radarRange(eye, 0))} nm (standard coefficients).`, { 'do:tab': 'horizon' });
}

// ---- Radian rule: L = R x angle / 60, any one from the other two ---------------------------------------------------------
// "1 degree at 1 nm is?" gives 33 yards: L = (R x angle) / 60, with a mile of 2000 yards and a cable of 200 yards, as in the notes.
const LEN_TOKEN = new RegExp(`${NUM}\\s*(nautical miles?|nm|miles?|cables?|cbls?|metres?|meters?|yards?|yds?|km|kilomet(?:re|er)s?|feet|ft|fathoms?|m)\\b`, 'g');
const toUnit = (w: string): LengthUnit => /^(?:nautical|nm|mile)/.test(w) ? 'nm' : /^(?:cable|cbl)/.test(w) ? 'cables' : /^(?:metre|meter|m$)/.test(w) ? 'metres' : /^(?:yard|yd)/.test(w) ? 'yards' : /^(?:km|kilo)/.test(w) ? 'km' : /^(?:feet|ft)/.test(w) ? 'feet' : 'fathoms';
const dm = (a: number) => { let d = Math.floor(a), m = Math.round((a - d) * 600) / 10; if (m >= 60) { d += 1; m = 0; } return `${d}° ${m.toFixed(1)}′`; };
const RADIAN_STRONG = /\b(?:radian|rule of 60|1 in 60|one in sixty|subtend(?:s|ed|ing)?|angle subtended)\b/;
/** Words that show the numbers are for another tool, when a request does not name the radian rule. */
const NOT_RADIAN = /\b(?:turn|corpen|wheel|rudder|bearing|course|heading|cpa|tcpa|atb|alter|variation|deviation|true|compass|gyro|wind|anchor|tide|depth|height|eye|fuel|kn|kts|knots|speed|sextant|vsa|hsa|horizon|track|throw)\b/;

function radianAnswer(t: string, ctx: CalcCtx): CalcReply | null {
  const strong = RADIAN_STRONG.test(t);
  const degTok = /(\d+(?:\.\d+)?)\s*(?:°|º|deg(?:rees?)?)(?:\s*(\d+(?:\.\d+)?)\s*(?:'|′|min(?:ute)?s?))?/.exec(t);
  const minOnly = degTok ? null : /(\d+(?:\.\d+)?)\s*(?:'|′|minutes? of arc)/.exec(t);
  const angleTyped = degTok ? parseFloat(degTok[1]) + (degTok[2] ? parseFloat(degTok[2]) / 60 : 0) : minOnly ? parseFloat(minOnly[1]) / 60 : val(t, `angle\\s*(?:of|is|=)?\\s*${NUM}`);
  const loose = [...t.matchAll(LEN_TOKEN)].map(m => ({ value: parseFloat(m[1]), unit: toUnit(m[2]), at: m.index ?? 0 }));
  // without a word that names the rule, only an angle at a range ("1 degree at 1 nm") is taken as a radian rule question
  if (!strong && !(angleTyped !== null && loose.length >= 1 && /\b(?:at|range|away|off|from)\b/.test(t) && !NOT_RADIAN.test(t))) return null;
  const conv = navyLength;
  let L = lengthAfter(t, 'length across|length|lateral|separation|across|width|breadth|height|offset|\\bl'), R = lengthAfter(t, 'range|rng|\\br');
  const atAt = t.search(/\bat\b/);
  if (!L && !R) {
    if (loose.length === 2) {            // "100 yards at 2 nm": what comes before "at" is the length, what comes after is the range
      const [a, b] = atAt >= 0 && loose[0].at > atAt ? [loose[1], loose[0]] : [loose[0], loose[1]];
      L = { value: a.value, unit: a.unit }; R = { value: b.value, unit: b.unit };
    } else if (loose.length === 1) {     // one length with an angle: after "at" or "range" it is the range, otherwise it is the length across
      const one = loose[0], isRange = (atAt >= 0 && one.at > atAt) || !/\b(?:wide|across|lateral|apart|subtend|separation|spans?|width|long)\w*/.test(t);
      if (isRange) R = { value: one.value, unit: one.unit }; else L = { value: one.value, unit: one.unit };
    }
  }
  const angle = angleTyped;
  const given = [L, R, angle].filter(x => x !== null && x !== undefined).length;
  if (given === 0) return null;
  if (given === 1) return strong ? ask('The radian rule needs two of the three: the length across (L), the range (R) and the angle. For example "1 degree at 1 nm" or "length 100 m angle 1 degree".') : null;
  if (given === 3) return { kind: 'say', say: 'All three are given. Leave one out and I will work it out: "1 degree at 1 nm".' };
  const uL = L?.unit ?? R?.unit ?? ctx.unit, uR = R?.unit ?? L?.unit ?? ctx.unit;
  const Lm = L ? conv(L.value, uL, 'metres') : null, Rm = R ? conv(R.value, uR, 'metres') : null;
  const sol = solveRadian({ length: Lm, range: Rm, angle: angle ?? null });
  if (!sol) return { kind: 'say', say: 'That cannot be worked: the range and the angle must be more than zero.' };
  const basis = 'radian rule: L = R × angle / 60';
  const nice = (v: number) => (v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  // an answer for L is given in yards when the range is in miles or cables, in the range's own unit otherwise; an answer for R in miles and cables
  const lUnit: LengthUnit = L ? uL : (uR === 'nm' || uR === 'cables' ? 'yards' : uR === 'km' ? 'metres' : uR);
  const values: Record<string, string> = { ...(L ? { dist: String(L.value) } : {}), ...(R ? { range: String(R.value) } : {}), ...(angle !== null ? { ang: String(angle) } : {}) };
  const memory = { 'pref:radian:dist': lUnit, 'pref:radian:range': R ? uR : uR === 'yards' || uR === 'metres' ? 'nm' : uR };
  const angleText = `${r2(angle ?? 0).replace(/\.?0+$/, '')}°`;
  const say = sol.solved === 'angle' ? `Angle ${r2(sol.angle)}° (${dm(sol.angle)}): ${L!.value} ${LENGTH_UNITS[uL].short} across at a range of ${R!.value} ${LENGTH_UNITS[uR].short} (${basis}).`
    : sol.solved === 'length' ? `${angleText} at ${R!.value} ${LENGTH_UNITS[uR].short} is ${nice(conv(sol.length, 'metres', lUnit))} ${LENGTH_UNITS[lUnit].short} across${lUnit === 'yards' ? ` (${nice(conv(sol.length, 'metres', 'metres'))} m)` : ''} (${basis}).`
      : `${L!.value} ${LENGTH_UNITS[uL].short} across subtends ${angleText} at a range of ${nice(conv(sol.range, 'metres', 'nm'))} nm (${nice(conv(sol.range, 'metres', 'cables'))} cables) (${basis}).`;
  return open('Radian Rule', 'radian', values, say, memory);
}

// ---- Positions: latitude and longitude, distance and bearing between positions ------------------------------------------
interface Coord { value: number; kind: 'lat' | 'lon' }
const COORD = /(\d{1,3}(?:\.\d+)?)\s*[°º]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*['′]?\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*["″]?\s*)?([nsew])(?:orth|outh|ast|est)?\b(?!\s*(?:miles?|nautical))/g;   // "12 30 n" or, spoken, "12 30 north"
/** The positions typed in a request ("12 30.5 n", "072 45 e", "51.475 n"), in the order written; hemisphere letters are required. */
function coords(t: string): Coord[] {
  const out: Coord[] = [];
  for (const m of t.matchAll(COORD)) {
    const d = parseFloat(m[1]), mi = m[2] ? parseFloat(m[2]) : 0, s = m[3] ? parseFloat(m[3]) : 0, hem = m[4];
    const kind = hem === 'n' || hem === 's' ? 'lat' : 'lon';
    let v = d + mi / 60 + s / 3600;
    if (mi >= 60 || s >= 60 || v > (kind === 'lat' ? 90 : 180)) continue;
    if (hem === 's' || hem === 'w') v = -v;
    out.push({ value: v, kind });
  }
  return out;
}

function positionAnswer(t: string): CalcReply | null {
  const cs = coords(t);
  if (!cs.length) return null;
  const lats = cs.filter(c => c.kind === 'lat').map(c => c.value), lons = cs.filter(c => c.kind === 'lon').map(c => c.value);
  const speed = knots(t, 'speed');
  const crs = val(t, `(?:course|steering|steer|bearing)\\s*(?:of|is|=)?\\s*${NUM}`);
  const d = dist(t, 'distance|dist|steam|run|for', 'nm');
  const num5 = (v: number) => String(Math.round(v * 100000) / 100000);
  const nmText = (v: number) => `${v < 10 ? v.toFixed(2) : v.toFixed(1)} nm`;
  const time = (x: number) => (speed !== null && speed > 0 ? ` (${hoursMinutes(x / speed)} at ${speed} kn)` : '');
  if (lats.length >= 2 && lons.length >= 2) {
    const A = { lat: lats[0], lon: lons[0] }, B = { lat: lats[1], lon: lons[1] };
    const g = greatCircle(A, B), r = rhumb(A, B);
    const values = { alat: num5(A.lat), alon: num5(A.lon), blat: num5(B.lat), blon: num5(B.lon), ...(speed !== null ? { speed: String(speed) } : {}) };
    if (!g) return { kind: 'say', say: 'The two positions are the same.' };
    return open('Bearings & Positions', 'pos', values,
      `Great circle ${nmText(g.distance)}${time(g.distance)}, initial course ${b3(g.initial)}°, final ${b3(g.final)}°.${r ? ` Rhumb line (Mercator sailing) ${nmText(r.distance)}${time(r.distance)} on a constant course ${b3(r.course)}°.` : ''}`,
      { 'bpu:tab': 'dist', 'pos:mode': 'between' });
  }
  if (lats.length === 1 && lons.length === 1 && crs !== null && d) {
    const gc = /great circle/.test(t), A = { lat: lats[0], lon: lons[0] };
    const out = gc ? greatCircleDestination(A, crs, d.nm) : rhumbDestination(A, crs, d.nm);
    if (!out) return { kind: 'say', say: 'That track runs over a pole: shorten the distance or change the course.' };
    return open('Bearings & Positions', 'posfrom', { lat: num5(A.lat), lon: num5(A.lon), crs: String(crs), dist: String(d.nm), ...(speed !== null ? { speed: String(speed) } : {}) },
      `${gc ? 'Great circle' : 'Rhumb line'}, ${b3(crs)}° for ${nmText(d.nm)}${time(d.nm)}: ${degMinutes(out.lat, 'lat')}, ${degMinutes(out.lon, 'lon')} (${decimalDegrees(out.lat, 'lat')}, ${decimalDegrees(out.lon, 'lon')}).`,
      { 'bpu:tab': 'dist', 'pos:mode': 'from', 'pos:method': gc ? 'gc' : 'rhumb' });
  }
  if (lats.length <= 1 && lons.length <= 1 && /\b(?:convert|decimal|dms|lat|long|position|coordinates?|degrees?)\b/.test(t)) {
    const parts = [
      ...(lats.length ? [`Latitude ${degMinutes(lats[0], 'lat')} = ${decimalDegrees(lats[0], 'lat')} = ${degMinSec(lats[0], 'lat')}`] : []),
      ...(lons.length ? [`Longitude ${degMinutes(lons[0], 'lon')} = ${decimalDegrees(lons[0], 'lon')} = ${degMinSec(lons[0], 'lon')}`] : []),
    ];
    return open('Bearings & Positions', 'latlong', { ...(lats.length ? { lat: num5(lats[0]) } : {}), ...(lons.length ? { lon: num5(lons[0]) } : {}) }, `${parts.join('. ')}.`, { 'bpu:tab': 'latlong' });
  }
  return null;
}

/** Tries each calculation in turn; null when the request is none of them. */
export function calcCommand(t: string, ctx: CalcCtx): CalcReply | null {
  if (!/\d/.test(t)) return null;   // no numbers: the tool is simply opened
  return radianAnswer(t, ctx) ?? positionAnswer(t) ?? cpaAnswer(t) ?? atbAnswer(t) ?? corpenAnswer(t, ctx) ?? regainAnswer(t) ?? ctsAnswer(t) ?? compassAnswer(t) ?? fuelAnswer(t, ctx) ?? horizonAnswer(t) ?? convertAnswer(t) ?? tsdAnswer(t);
}

