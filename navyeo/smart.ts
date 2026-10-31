// NavYeo's answer to one thing said or typed: the keyword rules first (instant, and they cover most requests); only when they do not understand, the small
// language model is asked to turn it into a request the rules do understand, or to give a short answer. The numbers are always worked out by the app's
// own calculators, never by the model. Pure apart from the `complete` function given; `node navyeo/llm.check.ts`.
import { interpretWithPending, normaliseSpoken, unitFollowUp } from './commands.ts';
import type { Context, Reply } from './commands.ts';
import { GRAMMAR, SAY_GRAMMAR, SYSTEM_PROMPT, isQuestion, parseModelReply, userPrompt } from './llmPrompt.ts';
import type { Meaning } from './meaning.ts';

/** Asks the model: (system, user, grammar) -> its raw line. */
export type Complete = (system: string, user: string, grammar: string) => Promise<string>;
export interface Smart {
  reply: Reply; pending: string | null; /** meaning: the sentence model matched it to a tool or an answer */ via: 'rules' | 'meaning' | 'model';
  /** the request the model made of what was said, shown beside the answer */ understoodAs?: string;
  /** the model was asked but its answer was not used: why (it failed, was too slow, or made up a number) */ modelNote?: string;
}

/** A reply that did not really answer: the request is still short of numbers, or a tool was only opened with nothing filled in. */
const half = (r: Reply): boolean => r.wait === true || (r.kind === 'open' && !r.form);
const lostReply = (r: Reply): boolean => r.kind === 'say' && r.unknown === true;

// Numbers a request may carry without their being said as digits: a point of the compass ("sets north east"), and "a mile", "an hour"
const POINTS: [RegExp, number[]][] = [[/\bnorth[- ]?east\b/, [45]], [/\bsouth[- ]?east\b/, [135]], [/\bsouth[- ]?west\b/, [225]], [/\bnorth[- ]?west\b/, [315]],
  [/\bnorth(?!\s*(?:east|west))\b|\bnortherly\b/, [0, 360]], [/\beast(?:erly)?\b/, [90]], [/\bsouth(?!\s*(?:east|west))\b|\bsoutherly\b/, [180]], [/\bwest(?:erly)?\b/, [270]]];
const numbersIn = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
/** The numbers in the model's request that were never given: the model must not invent or work out a figure. */
export function madeUpNumbers(request: string, heard: string, pending: string | null): number[] {
  const lower = `${heard} ${pending ?? ''}`.toLowerCase();
  const given = new Set([...numbersIn(lower), 1, ...POINTS.filter(([re]) => re.test(lower)).flatMap(([, v]) => v)]);
  return numbersIn(request).filter(n => !given.has(n));
}

export async function smartInterpret(text: string, pending: string | null, ctx: Context, complete?: Complete, onModel?: () => void, meaning?: Meaning): Promise<Smart> {
  const again = unitFollowUp(text, ctx.last ?? null);   // "in cables?": the last request, answered in that unit
  if (again && !pending) { const r = interpretWithPending(again, null, ctx); if (!lostReply(r.reply)) return { ...r, via: 'rules', understoodAs: again }; }
  const first = interpretWithPending(text, pending, ctx);
  const heard = normaliseSpoken(text);
  const question = isQuestion(heard);
  const lost = lostReply(first.reply);
  const stuck = pending !== null && first.reply.wait === true;                                  // a follow-up that still left the request incomplete
  const loose = half(first.reply) && heard.split(' ').length >= 6;                              // a spoken sentence the rules only half understood (a stray keyword, or missing numbers)
  const asks = question && first.reply.kind === 'open' && !first.reply.form;                    // "what is CPA": an explanation, not the tool
  if (!(lost || stuck || loose || asks) || (!complete && !meaning)) return { ...first, via: 'rules' };

  // by meaning (fast, and it cannot make anything up): a question gets the app's own explanation; loose words find the tool they ask for,
  // whose keyword is put in front of them so the rules still read the numbers
  if (meaning) {
    try {
      if (question && (lost || asks)) {
        const a = await meaning.answer(heard);
        if (a) return { reply: { kind: 'say', say: a.text }, pending: null, via: 'meaning' };
      }
      if (lost || loose) {                                                        // "are we on a collision course" is a question that asks for a tool
        const it = await meaning.intent(heard);
        if (it && !(first.reply.kind === 'open' && first.reply.tool === it.tool)) {
          const r = interpretWithPending(`${it.key} ${heard}`, pending, ctx);
          if (!lostReply(r.reply) && (lost || !half(r.reply))) return { ...r, via: 'meaning', understoodAs: it.tool };
        }
      }
    } catch { /* the sentence model is not available: carry on without it */ }
  }
  if (!complete) return { ...first, via: 'rules' };

  let raw: string;
  onModel?.();   // the model is about to be asked: the screen can say it is working
  try { raw = await complete(SYSTEM_PROMPT, userPrompt(heard, pending, ctx.shipName, ctx.last), question ? SAY_GRAMMAR : GRAMMAR); }
  catch (e) { return { ...first, via: 'rules', modelNote: String((e as Error)?.message ?? e) }; }
  const m = parseModelReply(raw);
  if (!m) return { ...first, via: 'rules', modelNote: 'The NavYeo model gave no usable answer.' };
  if (m.kind === 'say') {
    if (lost || question) return { reply: { kind: 'say', say: m.text }, pending: null, via: 'model' };
    return { ...first, via: 'rules' };                                                           // an incomplete request keeps asking for its numbers
  }

  const invented = madeUpNumbers(m.text, heard, pending);
  const second = invented.length ? null : interpretWithPending(m.text, null, ctx);   // the model's request goes through the same rules and calculators
  const worse = !second || lostReply(second.reply) || (!lost && half(second.reply));
  if (worse) {
    const modelNote = invented.length ? `The NavYeo model put in ${invented.join(', ')}, which you did not say, so its answer was not used.` : undefined;
    if (lost) return { reply: { kind: 'say', say: 'I could not turn that into a calculation. Say it with the numbers, for example "course to steer track 090 speed 12 set 045 drift 2".' }, pending, via: 'model', modelNote };
    return { ...first, via: 'rules', modelNote };            // the rules' own reply stands when the model did no better
  }
  return { ...second, via: 'model', understoodAs: m.text };
}
