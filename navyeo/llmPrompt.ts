// What NavYeo asks the small on-phone language model (Qwen2.5 0.5B Instruct), and how it reads the answer. The model never does a sum: it only turns what was
// said into one request in the style the keyword rules already understand (commands.ts), which the app's own calculators then work out, or, for a plain
// question, gives a one or two sentence answer from the app's own explanations. Its output is held to one of two shapes by a grammar. Pure; `node navyeo/llm.check.ts`.
import { normaliseSpoken } from './commands.ts';
import { TOOL_INFO } from '../tools/toolInfo.ts';

/** A question is only ever answered, so for one the model is held to SAY. */
export const SAY_GRAMMAR = ['root ::= "SAY: " ans', 'ans ::= [^\\n]{2,300}'].join('\n');

/** The answer must be `CMD: <request>` or `SAY: <short answer>` on one line. */
export const GRAMMAR = [
  'root ::= "CMD: " req | "SAY: " ans',
  'req ::= [a-zA-Z0-9 .,°\'"+/-]{3,200}',
  'ans ::= [^\\n]{2,300}',
].join('\n');

/** Spoken-style requests and the request each should become: the model learns the shape from these. */
const SHOTS: [string, string, string?][] = [
  ['what is the angle of one degree at a mile', 'CMD: 1 degree at 1 nm'],
  ['i am making good zero nine zero at twelve knots and the current sets north east at two knots what do i steer', 'CMD: course to steer track 090 speed 12 set 045 drift 2'],
  ['how far can i go on eighty tonnes of fuel at fourteen knots', 'CMD: how far on 80 tonnes at 14 knots'],
  ['what is my closest point of approach the contact bears three one five at eight miles steering one eight zero at ten knots and i am on zero four zero at fifteen', 'CMD: cpa own course 040 own speed 15 bearing 315 range 8 nm target course 180 speed 10'],
  ['what is the distance between ten fifteen north sixty eight twenty east and eleven forty north seventy ten east', 'CMD: distance and bearing from 10 15 n 068 20 e to 11 40 n 070 10 e'],
  ['how long to steam fifty miles at fifteen knots', 'CMD: distance 50 nm speed 15'],
  ['how wide does a hundred yard ship look at one mile', 'CMD: what angle does 100 yards subtend at 1 nm'],
  ['change five nautical miles into metres', 'CMD: convert 5 nm to metres'],
  ['distance and bearing from twelve thirty north seventy two forty five east to fifteen ten north seventy three fifty east', 'CMD: distance and bearing from 12 30 n 072 45 e to 15 10 n 073 50 e'],
  ['the contact bears zero four five and is steering two seven zero what is the angle on the bow', 'CMD: atb bearing 045 target course 270'],
  ['i am two cables off track and want to be back on track in twenty minutes at twelve knots', 'CMD: off track 2 cables regain in 20 minutes at 12 knots'],
  ['what is the radian rule', 'SAY: The radian rule is L = R × angle / 60: the length across, the range and the angle in degrees. Give me any two and I will work out the third.'],
  ['give me that in cables', 'CMD: 1 degree at 1 nm in cables', 'Previous request: 1 degree at 1 nm'],
  ['hello', 'SAY: Hello. Ask me for a bearing, CPA, course to steer, radian rule, fuel, distance between positions or a conversion.'],
];

/** The instructions that open every request: short, since the phone reads them before its first answer (it then keeps them in memory). The
 *  examples carry the request formats; the keyword rules and the matching by meaning have already tried, so only loose wording comes here. */
export const SYSTEM_PROMPT = [
  'You are NavYeo, a warship navigator\'s assistant. Reply with one line.',
  'A calculation: CMD: one request shaped like the examples, using only the user\'s numbers, bearings in three digits.',
  'Anything else: SAY: one or two sentences, from the reference when one is given.',
  '',
  ...SHOTS.flatMap(([said, reply, before]) => [...(before ? [before] : []), `User: ${normaliseSpoken(said)}`, `Reply: ${reply}`]),
].join('\n');

/** For a model trained on NavYeo's own examples (its GGUF name contains "navyeo"): it knows the request formats, so the examples are left out
 *  and the phone reads a few words instead of several hundred before each first answer. */
export const SHORT_SYSTEM_PROMPT = 'You are NavYeo, a warship navigator\'s assistant. Reply with one line: CMD: <request> or SAY: <answer>.';

const QUESTION = /^(?:what|why|which|who|explain|tell me|define|describe|is|are|does|do)\b|^how (?:does|do|is|are)\b|\bwhat is\b|\bwhat does\b|\bmeans?\b|\bformula\b/i;
/** A question or a request to explain: it gets an answer, not a calculation. ("How far ..." and "how many ..." are calculations and are not questions.) */
export const isQuestion = (text: string): boolean => {
  const t = text.trim();
  if (!QUESTION.test(t)) return false;
  // "what is my closest point of approach, he bears 045 at 6 miles ...": with two or more numbers given it is a calculation asked in the form of a question
  const numbers = (t.match(/\d+(?:\.\d+)?/g) ?? []).length;
  return numbers < 2 || /^(?:explain|define|describe|tell me)\b/i.test(t);
};

/** The app's own short definitions: a question about one of these is answered from them (the seed of what a NavYeo model of its own will learn). */
export const GLOSSARY: [RegExp, string][] = [
  [/\bcables?\b/, 'A cable is one tenth of a nautical mile: 185.2 metres, taken as 200 yards in the school\'s sums.'],
  [/\bnautical miles?\b|\bnm\b/, 'A nautical mile is 1852 metres, one minute of latitude. A knot is one nautical mile an hour.'],
  [/\bknots?\b/, 'A knot is one nautical mile an hour, about 0.514 metres a second.'],
  [/\bfathoms?\b/, 'A fathom is 6 feet, 1.83 metres.'],
  [/\bvariation\b|\btrue north\b|\bmagnetic north\b|\bmagnetic\b/, 'True north is toward the geographic pole; magnetic north is where a compass needle points before the ship\'s own error. The angle between them at a place is the variation, positive when easterly.'],
  [/\bdeviation\b/, 'Deviation is the error of the ship\'s compass caused by her own magnetism; it changes with her head. Easterly is positive.'],
  [/\bcpa\b|\btcpa\b|closest point/, 'CPA is the closest point of approach: the least distance a contact will pass if both ships hold course and speed. TCPA is the time until then.'],
  [/\bangle on the bow\b|\batb\b|\baspect\b/, 'The angle on the bow is the angle between a ship\'s head and the line of sight from her to you, measured to port or starboard.'],
  [/\bradian rule\b|\b1 in 60\b|\brule of 60\b/,'The radian rule is L = (R × angle) / 60: the length across, the range and the angle in degrees. Any two give the third. One degree at one mile is about 33 yards.'],
  [/\bcorpen\b/, 'Corpen is a signal to alter course together: every ship turns the same number of degrees. A ship in station astern turns early by the radian rule.'],
  [/\bbattenberg\b/, 'A Battenberg diagram gives the course and speed to take up station on a Guide, from the relative motion.'],
  [/\bset and drift\b|\bdrift\b|\bset\b/, 'Set is the direction a current flows toward and drift is its speed in knots. The course to steer allows for them to make good the track.'],
  [/\bthrow[- ]?off\b/, 'A throw-off is a deliberate alteration toward the track to regain it: the distance to run is the distance off track times 60 over the angle.'],
  [/\brhumb\b|\bgreat circle\b|\bmercator\b/, 'A rhumb line keeps one constant course. A great circle is the shortest way between two positions, but its course changes along it.'],
  [/\bwheel[- ]?over\b|\badvance\b|\btransfer\b|\btactical diameter\b/, 'Advance is the distance gained along the old course in a turn, transfer the distance gained at right angles, and tactical diameter the transfer at 180 degrees. The wheel goes over before the new course point by about advance minus transfer over tan of the turn.'],
  [/\breciprocal\b/, 'The reciprocal of a bearing is the opposite direction: add or subtract 180 degrees.'],
  [/\bras\b|\breplenishment\b/, 'RAS is replenishment at sea: coming alongside a supply ship at a set distance and speed to pass fuel or stores.'],
  [/\bguide\b/, 'The Guide is the ship that the others take station on.'],
  [/\brelative bearing\b/, 'A relative bearing is measured clockwise from the ship\'s own head; add the true head to make a true bearing.'],
];

/** A piece of the app's own explanation for a question about a tool or a rule, so a small model answers from it rather than from memory. */
export function reference(question: string): string {
  if (!QUESTION.test(question.trim())) return '';
  const lower = question.toLowerCase();
  const defs = GLOSSARY.filter(([re]) => re.test(lower)).slice(0, 2).map(([, d]) => d);
  if (defs.length) return defs.join(' ');
  const words = question.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  let best: { name: string; score: number } | null = null;
  for (const [name, info] of Object.entries(TOOL_INFO)) {
    const hay = `${name} ${info.concept}`.toLowerCase();
    const score = words.reduce((n, w) => n + (name.toLowerCase().includes(w) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { name, score };
  }
  if (!best || best.score < 2) return '';
  const info = TOOL_INFO[best.name];
  return `${info.concept} ${info.formulas.slice(0, 3).join('; ')}`.slice(0, 700);
}
const STOP = new Set(['the', 'what', 'how', 'does', 'and', 'for', 'with', 'tell', 'about', 'explain', 'work', 'works', 'rule', 'mean', 'means', 'please', 'you', 'can', 'are', 'this', 'that', 'use', 'used']);

/** The user's message for the model: what was said, the request still waiting for numbers, and a reference for questions. */
export function userPrompt(said: string, pending?: string | null, ship?: string, last?: string): string {
  const ref = reference(said);
  return [
    ship ? `Ship: ${ship}` : '',
    pending ? `An earlier request still needs details: ${pending}` : last ? `Previous request: ${last}` : '',
    ref ? `Reference: ${ref}` : '',
    `User: ${said}`,
    'Reply:',
  ].filter(Boolean).join('\n');
}

export type ModelReply = { kind: 'cmd' | 'say'; text: string };
/** The model's line as a request or an answer; null when it is neither (the grammar should prevent that). */
export function parseModelReply(raw: string): ModelReply | null {
  const m = /^\s*(CMD|SAY):\s*(.+?)\s*$/s.exec(raw.trim().split('\n')[0] ?? '');
  if (!m) return null;
  const text = m[2].trim();
  if (!text) return null;
  return { kind: m[1] === 'CMD' ? 'cmd' : 'say', text };
}
