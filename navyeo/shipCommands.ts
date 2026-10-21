// Typed requests for the newer tools: Anchor, Flying Corpen, Battenberg, Tides (the height at a time) and VSA. Each reads the
// numbers it is given, falls back on the selected ship's own figures, works the answer, says it, and opens the tool with
// the numbers filled in. Pure; `node navyeo/shipCommands.check.ts` checks it.
import { convertLength, formatLength, norm360 } from '../tools/navMath.ts';
import type { LengthUnit } from '../tools/navMath.ts';
import { cableRequired, circles } from '../tools/anchor.ts';
import type { CableType } from '../tools/anchor.ts';
import { apparentWind, flyingCourses } from '../tools/flyingCorpen.ts';
import { place, profile, slowing, solve, stationBearing } from '../tools/battenberg.ts';
import { heightAt, rateAt } from '../tools/tides.ts';
import type { Method } from '../tools/tides.ts';
import { distanceByHeight } from '../tools/rangeFormulas.ts';
import type { ShipParams } from '../tools/shipParams.ts';
import { NUM, UNIT_WORDS, clockHours, num, offBow } from './parse.ts';

export interface OpenReply { kind: 'open'; tool: string; say: string; form?: { id: string; values: Record<string, string> }; memory?: Record<string, unknown> }
export interface ShipCtx { unit: LengthUnit; ship?: ShipParams; shipName?: string }

const r1 = (n: number) => String(Math.round(n * 10) / 10);
const b3 = (n: number) => String(Math.round(norm360(n))).padStart(3, '0');
const m = (metres: number, unit: LengthUnit) => formatLength(convertLength(metres, 'metres', unit), unit);
const nm = (miles: number, unit: LengthUnit) => formatLength(convertLength(miles, 'nm', unit), unit);
const rel = (a: number) => (Math.abs(a) < 0.5 ? 'right ahead' : Math.abs(Math.abs(a) - 180) < 0.5 ? 'right astern' : `${a > 0 ? 'Green' : 'Red'} ${Math.round(Math.abs(a))}`);
const hms = (hours: number) => { const s = Math.round(hours * 3600); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`; };
const clockText = (h: number) => { const t = Math.round(h * 60) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`; };
const strip = (t: string, re: RegExp) => t.replace(re, ' ');

// ---- Anchor -----------------------------------------------------------------------------------------------------------

export function anchorCommand(t: string, ctx: ShipCtx): OpenReply | null {
  if (!/\b(?:anchor(?:ing|age)?|shackles?|swinging (?:circle|radius)|cable to veer|msr)\b/.test(t)) return null;
  const sp = ctx.ship ?? {};
  const dm = new RegExp(`(?:depth|water|in)\\s*(?:of|is|=)?\\s*${NUM}\\s*(metres?|meters?|m|fathoms?|fm|feet|ft)?\\b`).exec(t) ?? new RegExp(`${NUM}\\s*(metres?|meters?|m|fathoms?|fm|feet|ft)\\b`).exec(t);
  let depth: number | null = null, depthUnit: 'metres' | 'fathoms' = 'metres';
  if (dm) {
    depth = parseFloat(dm[1]);
    const u = dm[2] ?? '';
    if (/^(?:fathoms?|fm)$/.test(u)) depthUnit = 'fathoms'; else if (/^(?:feet|ft)$/.test(u)) depth = depth * 0.3048;
  }
  const tide = num(t, `tide\\s*(?:of)?\\s*${NUM}`) ?? 0;
  const type: CableType = /\bbronze\b/.test(t) ? 'bronze' : /\bsteel\b/.test(t) ? 'steel' : sp.cableType ?? 'steel';
  const length = num(t, `(?:length|loa)\\s*(?:of|is|=)?\\s*${NUM}`) ?? sp.length ?? null;
  const stem = num(t, `stem(?:\\s+to\\s+standard)?\\s*${NUM}`) ?? sp.stemToStandard ?? null;
  const avail = num(t, `${NUM}\\s*shackles?\\s*(?:available|usable|max)`) ?? num(t, `shackles?\\s*(?:available|usable)\\s*${NUM}`) ?? sp.cableShackles ?? null;
  const veeredSaid = num(t, `${NUM}\\s*shackles?\\s*veered`) ?? num(t, `veered\\s*${NUM}`);

  const need = depth !== null && depth > 0 ? cableRequired(depth + (depthUnit === 'fathoms' ? tide / 1.8288 : tide), depthUnit, type) : null;
  const values: Record<string, string> = {};
  if (depth !== null) values.depth = String(depthUnit === 'fathoms' ? depth : r1(depth));
  if (tide) values.tide = String(tide);
  if (length !== null && num(t, `(?:length|loa)\\s*(?:of|is|=)?\\s*${NUM}`) !== null) values.len = String(length);
  if (stem !== null && num(t, `stem(?:\\s+to\\s+standard)?\\s*${NUM}`) !== null) values.stem = String(stem);
  if (veeredSaid !== null) values.veered = String(veeredSaid);
  if (avail !== null && /shackles?\s*(?:available|usable|max)|(?:available|usable)\s*\d/.test(t)) values.usable = String(avail);
  const memory = { 'pref:anchor:depth': depthUnit, 'pref:anchor:unit': 'metres', 'anchor:type': type };

  const lines: string[] = [];
  if (need !== null) lines.push(`Cable to veer for ${r1(depth!)} ${depthUnit === 'fathoms' ? 'fm' : 'm'}${tide ? ` and a ${tide} tide` : ''} (${type === 'bronze' ? 'aluminium bronze' : 'forged steel'}): ${need.toFixed(1)} shackles, say ${Math.ceil(need)}.`);
  if (length !== null && length > 0) {
    const veered = veeredSaid ?? (need !== null ? Math.ceil(need) : null);
    if (veered !== null) {
      const c = circles({ shipLength: length, stemToStandard: stem ?? 0, veeredShackles: veered, maxUsableShackles: avail ?? veered, safetyMargin: 185.2 });
      lines.push(`With ${veered} shackles veered and ${r1(avail ?? veered)} available, length ${r1(length)} m${ctx.ship?.length === length && ctx.shipName ? ` (${ctx.shipName})` : ''}: safety circle ${m(c.safety, ctx.unit)}, bridge circle ${m(c.bridge, ctx.unit)}, stern circle ${m(c.stern, ctx.unit)}, reduced MSR ${m(c.reducedMsr, ctx.unit)}.`);
    }
  }
  const say = lines.length ? `${lines.join(' ')} Opened Anchor with the numbers in.` : 'Opened Anchor. Give a depth, such as "anchor depth 30 m tide 2", for the cable to veer, and a ship length for the circles.';
  return { kind: 'open', tool: 'Anchor', form: Object.keys(values).length ? { id: 'anchor', values } : undefined, memory, say };
}

// ---- Flying Corpen ----------------------------------------------------------------------------------------------------

export function flyingCommand(t: string, ctx: ShipCtx): OpenReply | null {
  if (!/\b(?:flying corpen|corpen|flying course|wind over (?:the )?deck|wod|helicopter|flying stations?)\b/.test(t)) return null;
  const wod = num(t, `(?:wod|wind over (?:the )?deck)\\s*(?:of|is|=|needs?|required)?\\s*${NUM}`);
  const rest = strip(t, new RegExp(`(?:wod|wind over (?:the )?deck)\\s*(?:of|is|=|needs?|required)?\\s*${NUM}`));
  const tw = new RegExp(`(?:true\\s+)?wind\\s*(?:from)?\\s*${NUM}\\s*(?:°|deg(?:rees?)?)?\\s*(?:at|/|,|speed)?\\s*${NUM}`).exec(rest);
  const from = tw ? parseFloat(tw[1]) : null, speed = tw ? parseFloat(tw[2]) : null;
  const angle = offBow(rest) ?? 0;
  const crs = num(rest, `(?:ship'?s?\\s+|own\\s+)?course\\s*${NUM}`), spd = num(rest, `(?:ship'?s?\\s+|own\\s+)?speed\\s*${NUM}`);
  const values: Record<string, string> = {};
  if (from !== null && speed !== null) { values.wf = String(from); values.ws = String(speed); }
  if (wod !== null) values.wod = String(wod);
  if (offBow(rest) !== null) values.wang = String(Math.abs(angle));
  if (crs !== null) values.crs = String(crs);
  if (spd !== null) values.spd = String(spd);
  const memory = { 'fly:src': 'true', 'fly:wside': angle < 0 ? 'Port' : 'Starboard' };
  let say = 'Opened Flying Corpen. Give the true wind and the wind over deck, such as "flying corpen wind 090 15 wod 25 ahead".';
  if (from !== null && speed !== null && wod !== null && wod > 0) {
    const sols = flyingCourses({ from, speed }, wod, angle);
    if (!sols.length) say = `The true wind (${r1(speed)} kn) is too light to bring ${wod} kn over the deck from ${rel(angle)}. Opened Flying Corpen.`;
    else {
      const best = sols[0];
      const check = best.course !== null ? apparentWind(best.course, best.speed, { from, speed }) : null;
      const alt = sols[1] && sols[1].course !== null ? ` Other: ${b3(sols[1].course)}° at ${r1(sols[1].speed)} kn.` : '';
      say = best.course === null ? `No wind: any course, at ${r1(best.speed)} kn, gives ${wod} kn over the deck. Opened Flying Corpen.`
        : `Flying course ${b3(best.course)}° at ${r1(best.speed)} kn: ${check ? r1(check.speed) : wod} kn over the deck from ${rel(check ? check.rel : angle)} in a ${r1(speed)} kn true wind from ${b3(from)}°.${alt} Opened Flying Corpen.`;
      if (best.course !== null && crs !== null) { const d = ((best.course - crs + 540) % 360) - 180; say += ` Alter ${d >= 0 ? 'starboard' : 'port'} ${Math.round(Math.abs(d))}° from ${b3(crs)}°.`; }
    }
  } else if (from !== null || wod !== null) {
    say = `Opened Flying Corpen with ${Object.keys(values).length} value${Object.keys(values).length > 1 ? 's' : ''}. ${from === null ? 'Add the true wind, "wind 090 15".' : 'Add the wind over deck, "wod 25".'}`;
  }
  return { kind: 'open', tool: 'Flying Corpen', form: Object.keys(values).length ? { id: 'fly', values } : undefined, memory, say };
}

// ---- Battenberg -------------------------------------------------------------------------------------------------------

/** "red 90 4 nm", "ahead 1 nm", "green 30 800 yd": an angle off the Guide's bow and a distance. */
function station(chunk: string, fallback: LengthUnit): { side: 'Port' | 'Starboard'; angle: number; nm: number; text: string; unit: LengthUnit } | null {
  const a = offBow(chunk);
  if (a === null) return null;
  const c = strip(chunk, new RegExp(`\\b(?:green|stbd|starboard|red|port)\\s*${NUM}`)).replace(/\b(?:right |dead )?(?:ahead|astern)\b/, ' ');
  const d = new RegExp(`${NUM}\\s*([a-z]*)`).exec(c);
  if (!d) return null;
  const unit = UNIT_WORDS.find(([re]) => re.test(d[2]))?.[1] ?? fallback;
  return { side: a < 0 ? 'Port' : 'Starboard', angle: Math.abs(a), nm: convertLength(parseFloat(d[1]), unit, 'nm'), text: d[1], unit };
}

export function battCommand(t: string, ctx: ShipCtx): OpenReply | null {
  if (!/\b(?:batten(?:berg|burg)|(?:take|taking|change|changing|keeping) station|stationing|station[- ]?keeping|course to station)\b/.test(t)) return null;
  const gc = num(t, `guide(?:'s)?\\s*course\\s*${NUM}`);
  const gsm = new RegExp(`guide(?:'s)?\\s*(?:course\\s*${NUM}\\s*)?(?:and\\s*)?(?:at\\s*)?speed\\s*${NUM}`).exec(t), gs = gsm ? parseFloat(gsm[2]) : null;   // "guide speed 10" or "guide course 030 speed 10"
  const ss = num(t, `(?:own|stationing|my)\\s*speed\\s*${NUM}`) ?? num(t, `${NUM}\\s*(?:kn|kts|knots)\\s*(?:stationing|own)`);
  const split = /\bfrom\b(.*?)\bto\b(.*)$/.exec(t) ?? /\b(?:now|from)\b(.*?)\bstation\b(.*)$/.exec(t);
  const a = split ? station(split[1], ctx.unit) : null, b = split ? station(split[2], ctx.unit) : null;
  const values: Record<string, string> = {}, memory: Record<string, unknown> = { 'pref:batt:unit': ctx.unit };
  if (gc !== null) values.gc = String(gc);
  if (gs !== null) values.gs = String(gs);
  if (ss !== null) values.ss = String(ss);
  if (a) { values.a1 = String(a.angle); values.d1 = a.text; memory['batt:side1'] = a.side; }
  if (b) { values.a2 = String(b.angle); values.d2 = b.text; memory['batt:side2'] = b.side; }
  let say = 'Opened Battenberg. Try "battenberg guide course 030 speed 10 own speed 20 from red 90 4 nm to ahead 1 nm".';
  if (gc !== null && gs !== null && ss !== null && a && b) {
    const prob = { guideCourse: gc, guideSpeed: gs, stationingSpeed: ss, from: place(stationBearing(gc, (a.side === 'Port' ? -1 : 1) * a.angle), a.nm), to: place(stationBearing(gc, (b.side === 'Port' ? -1 : 1) * b.angle), b.nm) };
    const sols = solve(prob);
    if (!sols.length) say = `A stationing speed of ${r1(ss)} kn cannot make that track good against a Guide at ${r1(gs)} kn. Opened Battenberg.`;
    else {
      const s = sols[0], loss = ctx.ship?.decelMetresPerKnot !== undefined ? ctx.ship.decelMetresPerKnot / 1852 : null;
      const slow = loss !== null ? slowing(prob, s, loss) : null, pr = profile(prob, s, slow);
      say = `Steer ${b3(s.course)}° at ${r1(ss)} kn: relative track ${b3(s.relativeCourse)}° at ${r1(s.relativeSpeed)} kn, on station in ${hms(pr.totalHours)}.`;
      if (slow) say += slow.immediately ? ' Reduce speed at once.' : ` Reduce to the Guide's speed when she bears ${b3(slow.guideBearsTrue)}° at ${nm(slow.distance, ctx.unit)}.`;
      if (sols[1]) say += ` The other course that works is ${b3(sols[1].course)}°.`;
      say += ' It does not allow for the turn. Opened Battenberg.';
    }
  } else if (Object.keys(values).length) say = `Opened Battenberg with ${Object.keys(values).length} value${Object.keys(values).length > 1 ? 's' : ''}. ${split ? 'Check the stations.' : 'Add the stations: "from red 90 4 nm to ahead 1 nm".'}`;
  return { kind: 'open', tool: 'Battenberg', form: Object.keys(values).length ? { id: 'batt', values } : undefined, memory, say };
}

// ---- Tides: the height at a time between a high and a low water -------------------------------------------------------------

export function tideCommand(t: string): OpenReply | null {
  if (!/\b(?:tides?|high water|low water|hw|lw)\b/.test(t)) return null;
  const tide = (words: string) => { const x = new RegExp(`(?:${words})\\D{0,12}?(\\d{1,2}[:.]?\\d{2})\\D{0,12}?${NUM}`).exec(t); return x ? { time: clockHours(x[1]), h: parseFloat(x[2]), whole: x[0] } : null; };
  const hw = tide('hw|high water'), lw = tide('lw|low water');
  if (!hw || !lw || hw.time === null || lw.time === null) return { kind: 'open', tool: 'Tides', say: 'Opened Tides. Try "tide hw 0600 4.8 lw 1220 0.6 at 0910" for the height at a time, or enter the tides there.' };
  const rest = strip(strip(t, new RegExp(hw.whole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), new RegExp(lw.whole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const q = /(?:\bat\b|\bheight at\b|\bfor\b)\s*(\d{1,2}[:.]?\d{2})\b/.exec(rest);
  const tw = q ? clockHours(q[1]) : null;
  const firstLow = lw.time < hw.time;
  const a = firstLow ? { t: lw.time, h: lw.h } : { t: hw.time, h: hw.h };
  const bT = firstLow ? hw.time : lw.time;
  const b = { t: bT < a.t ? bT + 24 : bT, h: firstLow ? hw.h : lw.h };
  const method: Method = /\bcosine\b|\bharmonic\b/.test(t) ? 'cosine' : 'twelfths';
  const values: Record<string, string> = { t1: clockText(a.t), h1: String(a.h), t2: clockText(b.t % 24), h2: String(b.h) };
  const memory = { 'tide:mode': 'manual', 'tide:first': firstLow ? 'low' : 'high', 'tide:method': method };
  if (tw === null) return { kind: 'open', tool: 'Tides', form: { id: 'tide', values }, memory, say: `Opened Tides with the ${firstLow ? 'low' : 'high'} water at ${clockText(a.t).slice(0, 5)} and the ${firstLow ? 'high' : 'low'} water at ${clockText(b.t % 24).slice(0, 5)}. Add "at 0910" for the height at a time.` };
  values.tw = clockText(tw);
  let when = tw; if (when < a.t) when += 24;
  if (when > b.t) return { kind: 'open', tool: 'Tides', form: { id: 'tide', values }, memory, say: `${clockText(tw).slice(0, 5)} is outside the two tides you gave (${clockText(a.t).slice(0, 5)} to ${clockText(b.t % 24).slice(0, 5)}). Opened Tides.` };
  const h = heightAt(a, b, when, method), rate = rateAt(a, b, when, method);
  return { kind: 'open', tool: 'Tides', form: { id: 'tide', values }, memory, say: `Height of tide at ${clockText(tw).slice(0, 5)}: ${h.toFixed(2)} m, ${b.h > a.h ? 'flooding' : 'ebbing'} at ${Math.abs(rate).toFixed(2)} m/h (${method === 'twelfths' ? 'rule of twelfths' : 'half-cosine'}). Opened Tides.` };
}

// ---- Rules and buoyage: open the reference at the right place -------------------------------------------------------------

const TOPICS: [RegExp, 'buoyage' | 'lights' | 'sound' | 'rules', string][] = [
  [/\b(north|east|south|west) cardinal\b/, 'buoyage', '$1 cardinal'], [/\bisolated danger\b/, 'buoyage', 'isolated danger'], [/\bsafe water\b/, 'buoyage', 'safe water'],
  [/\bspecial mark\b/, 'buoyage', 'special mark'], [/\bwreck\b/, 'buoyage', 'wreck'], [/\bport[- ]hand\b/, 'buoyage', 'port-hand'], [/\bstarboard[- ]hand\b/, 'buoyage', 'starboard-hand'],
  [/\b(trawling|fishing|towing|sailing|pilot|anchor(?:ed)?|aground|not under command|nuc|constrained|restricted)\b.*\blights?\b|\blights?\b.*\b(trawling|fishing|towing|sailing|pilot|anchor(?:ed)?|aground|not under command|nuc|constrained|restricted)\b/, 'lights', '$1'],
  [/\b(?:fog|sound|whistle|horn)\b.*\b(?:signals?|blasts?)\b|\b(?:signals?|blasts?)\b/, 'sound', ''],
  [/\b(overtaking|crossing|head[- ]on|give[- ]way|stand[- ]on)\b/, 'rules', '$1'],
];

export function referenceCommand(t: string): OpenReply | null {
  if (!/\b(?:buoy(?:age|s)?|cardinal|lateral|colregs?|rules? of the road|day shapes?|sound signals?|fog signals?|steering rules?|isolated danger|safe water|(?:trawling|fishing|towing|sailing|pilot|anchor(?:ed)?|aground) lights?|lights? for)\b/.test(t)) return null;
  let tab: string = /\b(?:lights?|shapes?)\b/.test(t) ? 'lights' : /\b(?:sound|fog|blasts?|whistle|horn)\b/.test(t) ? 'sound' : /\b(?:rules?|colregs?|overtaking|crossing|head[- ]on|give[- ]way|stand[- ]on)\b/.test(t) ? 'rules' : 'buoyage', q = '';
  for (const [re, tb, query] of TOPICS) {
    const m = re.exec(t);
    if (m) { tab = tb; q = query.replace('$1', m[1] ?? m[2] ?? ''); break; }
  }
  const names: Record<string, string> = { buoyage: 'Buoyage', lights: 'Lights', sound: 'Sound', rules: 'Rules' };
  return { kind: 'open', tool: 'Rules & Buoyage', memory: { 'ref:tab': tab, 'ref:q': q.trim() }, say: `Opened Rules & Buoyage on the ${names[tab]} tab${q.trim() ? `, searching "${q.trim()}"` : ''}.` };
}

// ---- VSA --------------------------------------------------------------------------------------------------------------------

export function vsaCommand(t: string, ctx: ShipCtx): OpenReply | null {
  if (!/\b(?:vsa|vertical sextant)\b/.test(t)) return null;
  const h = new RegExp(`(?:height|elevation)\\s*(?:of|is|=)?\\s*${NUM}\\s*(m|metres?|meters?|ft|feet)?`).exec(t);
  const hM = h ? parseFloat(h[1]) * (/^(?:ft|feet)$/.test(h[2] ?? '') ? 0.3048 : 1) : null;
  const ang = new RegExp(`angle\\s*(?:of|is|=)?\\s*${NUM}(?:\\s+${NUM})?`).exec(t);
  const deg = ang ? parseFloat(ang[1]) + (ang[2] !== undefined ? parseFloat(ang[2]) / 60 : 0) : null;
  const ie = num(t, `(?:ie|index error)\\s*${NUM}`) ?? 0;
  const values: Record<string, string> = {};
  if (hM !== null) values.elev = String(Math.round(hM * 100) / 100);
  if (ang) values.angle = ang[2] !== undefined ? `${ang[1]} ${ang[2]}` : ang[1];
  if (ie) values.ie = String(ie);
  const memory = { 'vsa:method': 'height', 'pref:vsa:height': 'metres', 'pref:vsa:dist': ctx.unit };
  let say = 'Opened VSA. Try "vsa height 40 m angle 0 46.2 ie 1.2".';
  if (hM !== null && hM > 0 && deg !== null) {
    const d = distanceByHeight(hM, deg + ie / 60);
    say = Number.isFinite(d) ? `Distance off ${nm(d, ctx.unit)} (${(d * 1852).toFixed(0)} m): height ${r1(hM)} m at ${(deg + ie / 60).toFixed(3)}°. No tide correction. Opened VSA.` : say;
  }
  return { kind: 'open', tool: 'Distance Off & Horizon', form: Object.keys(values).length ? { id: 'vsa2', values } : undefined, memory, say };
}
