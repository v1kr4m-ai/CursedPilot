// What NavYeo does with a typed request: open a tool (filled in where the numbers were given) or answer from the
// ship's own turning data. Plain keyword matching, no AI, and it says so when it does not understand. Pure;
// `node navyeo/commands.check.ts` checks it.
import { convertLength, formatLength, norm360, wheelOverDistance } from '../tools/navMath.ts';
import type { LengthUnit } from '../tools/navMath.ts';

export interface TurnRow { turn: number; advance: number; transfer: number; time: number }   // yards, yards, seconds
export interface TurnTable { speed: number; wheel: number; side: 'Port' | 'Starboard'; rows: TurnRow[] }
export interface Context { shipName?: string; tables: TurnTable[]; unit: LengthUnit }

export type Reply =
  | { kind: 'say'; say: string }
  /** open `tool`; `form` values are put in that tool's number fields, `memory` entries are stored as they are */
  | { kind: 'open'; tool: string; say: string; form?: { id: string; values: Record<string, string> }; memory?: Record<string, unknown> };

export const EXAMPLES = [
  'cpa own course 090 own speed 12 bearing 045 range 6 nm target course 270 speed 8',
  'atb bearing 045 green 30',
  'distance 12 nm speed 15',
  'reciprocal of 075',
  'tactical diameter at 15 kn 20 wheel',
  'advance at 12 kn 15 wheel 90 turn',
  'wheel over for 60 degrees at 15 kn 20 wheel',
  'man overboard, williamson, hsa, compass, units ...',
];

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const UNIT_WORDS: [RegExp, LengthUnit][] = [
  [/^(?:cables?|cbl?s?)\b/, 'cables'], [/^(?:nm|nautical miles?|miles?)\b/, 'nm'], [/^(?:metres?|meters?|m)\b/, 'metres'],
  [/^(?:yards?|yds?|yd)\b/, 'yards'], [/^(?:km|kilomet(?:re|er)s?)\b/, 'km'], [/^(?:feet|foot|ft)\b/, 'feet'], [/^(?:fathoms?|fm)\b/, 'fathoms'],
];

const num = (t: string, re: string): number | null => {
  const m = new RegExp(re).exec(t);
  return m ? parseFloat(m[1]) : null;
};

/** A number with an optional length unit after it: "6 nm", "12", "3 cables". */
function lengthAfter(t: string, words: string): { value: number; unit: LengthUnit | null } | null {
  const m = new RegExp(`(?:${words})\\s*(?:of|is|=|:)?\\s*${NUM}\\s*([a-z]*)`).exec(t);
  if (!m) return null;
  const unit = UNIT_WORDS.find(([re]) => re.test(m[2]))?.[1] ?? null;
  return { value: parseFloat(m[1]), unit };
}

const bearing3 = (n: number) => String(Math.round(norm360(n))).padStart(3, '0');
const show = (yd: number, unit: LengthUnit) => formatLength(convertLength(yd, 'yards', unit), unit);

/** Turn-table value for a heading change, by straight lines between rows; null outside what is recorded. */
export function lookupTurn(rows: TurnRow[], turn: number): TurnRow | null {
  const r = [...rows].sort((a, b) => a.turn - b.turn);
  if (!r.length || turn < r[0].turn || turn > r[r.length - 1].turn) return null;
  for (let i = 0; i < r.length; i++) {
    if (r[i].turn === turn) return r[i];
    if (i + 1 < r.length && turn > r[i].turn && turn < r[i + 1].turn) {
      const f = (turn - r[i].turn) / (r[i + 1].turn - r[i].turn), a = r[i], b = r[i + 1];
      return { turn, advance: a.advance + f * (b.advance - a.advance), transfer: a.transfer + f * (b.transfer - a.transfer), time: a.time + f * (b.time - a.time) };
    }
  }
  return null;
}

const mmss = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;

function turningAnswer(t: string, ctx: Context): Reply | null {
  const wantsDiameter = /tactical diameter/.test(t), wantsOver = /wheel[- ]?over/.test(t);
  const wantsAdv = /\badvance\b/.test(t), wantsTr = /\btransfer\b/.test(t), wantsTime = /time (?:to|for|of)\b.*\bturn\b/.test(t);
  if (!(wantsDiameter || wantsOver || wantsAdv || wantsTr || wantsTime)) return null;
  if (!wantsDiameter && !/\d/.test(t)) return null;   // a bare "wheel over" just opens the tool
  if (!ctx.tables.length) return { kind: 'say', say: `I need turning data to answer that${ctx.shipName ? ` for ${ctx.shipName}` : ''}. Select a ship, then add or import it under Calibration Data, Turning Trials.` };

  const speed = num(t, `${NUM}\\s*(?:kn|kts?|knots?)\\b`);
  const wheel = num(t, `${NUM}\\s*(?:°|deg(?:rees?)?)?\\s*(?:of )?(?:wheel|rudder)`) ?? num(t, `(?:wheel|rudder)\\s*(?:of|is|=)?\\s*${NUM}`);
  const turn = wantsDiameter ? 180 : (num(t, `${NUM}\\s*(?:°|deg(?:rees?)?)?\\s*(?:turn|alteration|alter)`) ?? num(t, `(?:turn|alteration)\\s*(?:of|by)?\\s*${NUM}`) ?? num(t, `for\\s*${NUM}\\s*(?:°|deg)`) ?? num(t, `${NUM}\\s*(?:°|degrees?)\\b(?!\\s*(?:wheel|rudder))`));
  const side: TurnTable['side'] | null = /\b(?:starboard|stbd|green)\b/.test(t) ? 'Starboard' : /\b(?:port|red)\b/.test(t) ? 'Port' : null;

  const speeds = [...new Set(ctx.tables.map(x => x.speed))].sort((a, b) => a - b);
  const sp = speed ?? (speeds.length === 1 ? speeds[0] : null);
  if (sp === null) return { kind: 'say', say: `At what speed? Recorded: ${speeds.join(', ')} kn. Try "${wantsOver ? 'wheel over for 60 degrees' : 'advance at 90 turn'} at ${speeds[0]} kn".` };
  const atSpeed = ctx.tables.filter(x => x.speed === sp);
  if (!atSpeed.length) return { kind: 'say', say: `No turning data at ${sp} kn. Recorded: ${speeds.join(', ')} kn.` };
  const wheels = [...new Set(atSpeed.map(x => x.wheel))].sort((a, b) => a - b);
  const wh = wheel ?? (wheels.length === 1 ? wheels[0] : null);
  if (wh === null) return { kind: 'say', say: `Which wheel angle at ${sp} kn? Recorded: ${wheels.join(', ')}°. Add e.g. "${wheels[0]} wheel".` };
  const cands = atSpeed.filter(x => x.wheel === wh);
  if (!cands.length) return { kind: 'say', say: `No turning data at ${sp} kn with ${wh}° wheel. Recorded wheel angles at that speed: ${wheels.join(', ')}°.` };
  const table = cands.find(x => x.side === (side ?? 'Starboard')) ?? (side ? null : cands[0]);
  if (!table) return { kind: 'say', say: `No ${side?.toLowerCase()} turning data at ${sp} kn, ${wh}° wheel.` };

  const head = `${ctx.shipName ? `${ctx.shipName}, ` : ''}${sp} kn, ${wh}° wheel, ${table.side.toLowerCase()}`;
  if (turn === null) return { kind: 'say', say: `How big a turn? For example "${wantsOver ? 'wheel over for 60 degrees' : 'advance for a 90 turn'}"${wantsDiameter ? '' : ', or ask for the tactical diameter'}.` };
  const row = lookupTurn(table.rows, turn);
  if (!row) {
    const turns = table.rows.map(r => r.turn);
    return { kind: 'say', say: `${turn}° is outside what is recorded for ${head} (${Math.min(...turns)}° to ${Math.max(...turns)}°).` };
  }
  if (wantsDiameter) return { kind: 'say', say: `Tactical diameter (transfer at 180°), ${head}: ${show(row.transfer, ctx.unit)}. Advance at 180°: ${show(row.advance, ctx.unit)}.` };
  if (wantsOver) {
    const d = wheelOverDistance(row.advance, row.transfer, turn);
    return d === null ? { kind: 'say', say: 'Wheel-over distance works for turns between 1° and 179°.' }
      : { kind: 'say', say: `Wheel over ${show(d, ctx.unit)} before the turning point for a ${turn}° alteration (${head}). Advance ${show(row.advance, ctx.unit)}, transfer ${show(row.transfer, ctx.unit)}. An approximation: confirm against your standing orders.` };
  }
  const parts = [wantsAdv && `advance ${show(row.advance, ctx.unit)}`, wantsTr && `transfer ${show(row.transfer, ctx.unit)}`, wantsTime && `time ${mmss(row.time)}`].filter(Boolean);
  return { kind: 'say', say: `At ${turn}° of turn, ${head}: ${parts.join(', ')}.` };
}

function cpaCommand(t: string): Reply | null {
  if (!/\b(?:cpa|tcpa|closest point)\b/.test(t)) return null;
  const values: Record<string, string> = {};
  let rest = t;
  const take = (key: string, re: string) => { const m = new RegExp(re).exec(rest); if (m) { values[key] = String(parseFloat(m[1])); rest = rest.replace(m[0], ' '); } };
  take('oc', `own\\s+course\\s*${NUM}`); take('os', `own\\s+speed\\s*${NUM}`);
  const range = lengthAfter(rest, 'range|rng');
  if (range) { values.rng = String(range.value); rest = rest.replace(/(?:range|rng)\s*(?:of|is|=|:)?\s*-?\d+(?:\.\d+)?\s*[a-z]*/, ' '); }
  take('brg', `(?:bearing|brg)\\s*${NUM}`);
  take('tc', `(?:target\\s+|contact\\s+)?course\\s*${NUM}`); take('ts', `(?:target\\s+|contact\\s+)?speed\\s*${NUM}`);
  const memory = range?.unit ? { 'pref:cpa:unit': range.unit } : undefined;
  const n = Object.keys(values).length;
  const miss = ['oc', 'os', 'brg', 'rng', 'tc', 'ts'].filter(k => !(k in values));
  return { kind: 'open', tool: 'CPA / TCPA', form: n ? { id: 'cpa', values } : undefined, memory, say: n ? (miss.length ? `Opened CPA with ${n} value${n > 1 ? 's' : ''} filled in. Check them and add the rest.` : 'Opened CPA with all values filled in. Check the units.') : 'Opened CPA.' };
}

function atbCommand(t: string): Reply | null {
  if (!/\b(?:atb|angle on the bow|bow angle)\b/.test(t)) return null;
  const values: Record<string, string> = {}, memory: Record<string, unknown> = {};
  const b = num(t, `(?:bearing|brg)\\s*${NUM}`); if (b !== null) values.brg = String(b);
  const colour = new RegExp(`\\b(green|red|stbd|starboard|port)\\s*${NUM}`).exec(t) ?? null;
  let angle = num(t, `angle(?: on the bow)?\\s*(?:of|is|=)?\\s*${NUM}`);
  let side: 'Port' | 'Starboard' | null = /\b(?:starboard|stbd|green)\b/.test(t) ? 'Starboard' : /\b(?:port|red)\b/.test(t) ? 'Port' : null;
  if (colour) { angle = parseFloat(colour[2]); side = colour[1] === 'red' || colour[1] === 'port' ? 'Port' : 'Starboard'; }
  const c = num(t, `(?:target\\s+)?course\\s*${NUM}`);
  if (angle !== null) { values.angle = String(angle); memory['atb:mode'] = 'course'; if (side) memory['atb:side'] = side; }
  else if (c !== null) { values.course = String(c); memory['atb:mode'] = 'angle'; }
  const n = Object.keys(values).length;
  return { kind: 'open', tool: 'Angle on the Bow (ATB)', form: n ? { id: 'atb', values } : undefined, memory: Object.keys(memory).length ? memory : undefined, say: n ? 'Opened ATB with your values filled in.' : 'Opened ATB.' };
}

function tsdCommand(t: string): Reply | null {
  const hasDist = /\bdist(?:ance)?\b/.test(t), hasSpeed = /\bspeed\b/.test(t) || /\d\s*(?:kn|kts|knots)\b/.test(t), hasTime = /\btime\b|\d\s*(?:min|mins|minutes|hours?|hrs?|h)\b/.test(t);
  if (!(/\btsd\b|time[ ,/-]*speed[ ,/-]*dist/.test(t) || [hasDist, hasSpeed, hasTime].filter(Boolean).length >= 2)) return null;
  if (/\b(?:cpa|atb|hsa|bearing|course|wheel|advance|transfer|reciprocal)\b/.test(t)) return null;
  const values: Record<string, string> = {};
  const d = lengthAfter(t, 'dist(?:ance)?'); if (d) values.d = String(d.value);
  const s = num(t, `(?:speed\\s*(?:of|is|=)?\\s*${NUM})`) ?? num(t, `${NUM}\\s*(?:kn|kts|knots)\\b`); if (s !== null) values.s = String(s);
  const m = new RegExp(`${NUM}\\s*(min|mins|minutes|hours?|hrs?|h)\\b`).exec(t);
  if (m) values.t = String(/^h/.test(m[2]) ? parseFloat(m[1]) * 60 : parseFloat(m[1]));
  const n = Object.keys(values).length;
  return { kind: 'open', tool: 'Time / Speed / Distance', form: n ? { id: 'tsd', values } : undefined, memory: d?.unit ? { 'pref:tsd:unit': d.unit } : undefined, say: n === 3 ? 'All three are filled in; clear one to solve for it.' : n ? 'Opened Time / Speed / Distance. Fill in the third value to solve.' : 'Opened Time / Speed / Distance.' };
}

const OPEN_ONLY: [RegExp, string][] = [
  [/\b(?:man overboard|mob|williamson|scharnow)\b/, 'Man Overboard Turn'],
  [/\b(?:hsa|horizontal sextant)\b/, 'Horizontal Sextant Angle (HSA)'],
  [/\b(?:wheel[- ]?over)\b/, 'Wheel-over Point'],
  [/\b(?:course to steer|set and drift|cts)\b/, 'Course to Steer'],
  [/\b(?:horizon|distance off|vertical sextant|vsa)\b/, 'Distance Off & Horizon'],
  [/\b(?:compass|gyro|deviation|variation)\b/, 'Compass Conversion'],
  [/\b(?:radian)\b/, 'Radian Rule'],
  [/\b(?:convert|units?)\b/, 'Unit Converter'],
  [/\b(?:bearings?|relative)\b/, 'Bearing Calculator'],
  [/\b(?:cpa|tcpa)\b/, 'CPA / TCPA'],
  [/\b(?:atb|angle on the bow)\b/, 'Angle on the Bow (ATB)'],
  [/\b(?:tsd|time speed distance)\b/, 'Time / Speed / Distance'],
];

const DIGIT_WORDS: Record<string, string> = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', niner: '9' };

/** What a speech recogniser may hand back: "zero four five" becomes "045" and "12 point 5" "12.5". Typed text passes through. */
export function normaliseSpoken(text: string): string {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let joining = false;   // the last token is a number still being spelt out
  for (let i = 0; i < words.length; i++) {
    const w = words[i], next = words[i + 1] ?? '';
    const digit = DIGIT_WORDS[w] ?? (joining && /^\d$/.test(w) ? w : undefined);
    if (w === 'point' && /^\d+$/.test(out[out.length - 1] ?? '') && (next in DIGIT_WORDS || /^\d+$/.test(next))) { out[out.length - 1] += '.'; joining = true; continue; }
    if (digit !== undefined) {
      if (joining) out[out.length - 1] += digit; else out.push(digit);
      joining = true;
      continue;
    }
    out.push(w); joining = false;
  }
  return out.join(' ');
}

export function interpret(text: string, ctx: Context): Reply {
  const t = normaliseSpoken(text).replace(/\s+/g, ' ').replace(/[,;]/g, ' ').trim();
  if (!t) return { kind: 'say', say: 'Type a request, such as "' + EXAMPLES[0] + '".' };

  const rec = /reciprocal(?: of)?\s*(?:course |bearing )?(\d+(?:\.\d+)?)/.exec(t);
  if (rec) return { kind: 'say', say: `Reciprocal of ${bearing3(parseFloat(rec[1]))} is ${bearing3(parseFloat(rec[1]) + 180)}.` };

  const reply = turningAnswer(t, ctx) ?? cpaCommand(t) ?? atbCommand(t) ?? tsdCommand(t);
  if (reply) return reply;

  const hit = OPEN_ONLY.find(([re]) => re.test(t));
  if (hit) return { kind: 'open', tool: hit[1], say: `Opened ${hit[1]}.` };

  return { kind: 'say', say: `I did not understand that. I match keywords, I am not an AI. Try: ${EXAMPLES.slice(0, 5).map(e => `"${e}"`).join('; ')}; or name a tool.` };
}

