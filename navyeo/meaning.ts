// NavYeo by meaning rather than by keyword: a small sentence model (embedder.ts) turns what was said into a vector, and it is compared with
// (1) ways of asking for each tool, so "will that ship hit us" finds CPA although no keyword was said, and (2) the app's own definitions and tool
// explanations, so a question is answered with the app's own words, never made up. Pure apart from the `embed` function given; `node navyeo/meaning.check.ts`.
import { GLOSSARY } from './llmPrompt.ts';
import { TOOL_INFO } from '../tools/toolInfo.ts';

/** Sentences to unit-length vectors (cosine = dot product). */
export type Embed = (texts: string[]) => Promise<number[][]>;

/** A tool, the words the keyword rules know it by (put in front of what was said, so the rules still read the numbers), and ways of asking for it. */
export const INTENTS: { tool: string; key: string; asks: string[] }[] = [
  { tool: 'CPA / TCPA', key: 'cpa', asks: ['will that ship hit us', 'are we going to collide with the contact', 'how close will the other ship pass', 'when will the contact be nearest to us', 'is there a risk of collision with the vessel', 'how near does she come and when'] },
  { tool: 'Angle on the Bow (ATB)', key: 'atb', asks: ['which way is the contact pointing relative to us', 'how much of her side can we see', 'is the target showing us her port or starboard side', 'work out her heading from the bearing and how she looks'] },
  { tool: 'Course to Steer', key: 'course to steer', asks: ['what heading do I steer to allow for the current', 'the tide is pushing me off my track what do I steer', 'correct my course for the stream', 'how do I counter the current to stay on track'] },
  { tool: 'Radian Rule', key: 'radian rule', asks: ['how wide does an object look at this range', 'what angle does a ship of this length make at a distance', 'how far is it if it subtends this many degrees', 'length across from angle and range'] },
  { tool: 'Time / Speed / Distance', key: 'time speed distance', asks: ['how long will the passage take', 'when will we get there at this speed', 'how far will we go in this time', 'what speed do I need to arrive on time'] },
  { tool: 'Fuel Planning', key: 'fuel', asks: ['how much oil will the passage burn', 'how many days can we stay out', 'will we have enough diesel to get there', 'what is our range on the oil remaining'] },
  { tool: 'Corpen', key: 'corpen', asks: ['the formation is turning together when do I put the wheel over', 'when should I alter so we all turn at the same time in column', 'the guide signalled an alteration to all ships'] },
  { tool: 'Regain Track', key: 'regain track', asks: ['I have drifted off my track how do I get back', 'how do I get back onto the planned line', 'I am to the left of the track and want to be back on it', 'how much do I alter to come back to my track'] },
  { tool: 'Wheel-over Point', key: 'wheel over', asks: ['when do I start the turn for the next leg', 'how early must I put the rudder on before the alteration point', 'where do I begin turning onto the new course'] },
  { tool: 'Distance Off & Horizon', key: 'horizon', asks: ['how far can I see from the bridge', 'at what range will the light come into view', 'how far off is the lighthouse by its height', 'when will the land rise above the horizon'] },
  { tool: 'Anchor', key: 'anchor', asks: ['how much chain do I let out', 'how many shackles in this depth of water', 'how big a circle will we swing through at the berth', 'is it safe to drop the hook here'] },
  { tool: 'Tides', key: 'tides', asks: ['how deep will it be at this time', 'what is the height of water this afternoon', 'is the water rising or falling', 'when will there be enough water to cross the bar'] },
  { tool: 'Man Overboard Turn', key: 'man overboard', asks: ['someone fell into the sea', 'a person has gone over the side', 'how do I turn back to pick up a sailor in the water', 'return to the casualty in the water'] },
  { tool: 'Bearing Calculator', key: 'bearing calculator', asks: ['what will the bearing and range be as the object moves along its track', 'table of bearings and ranges every mile along the line', 'how will the bearing change as she runs along her course'] },
  { tool: 'Battenberg & Stationing', key: 'battenberg', asks: ['what course and speed to take up my new position in the formation', 'how do I get to my ordered position on the guide', 'move to a new place in the screen'] },
  { tool: 'Flying Corpen', key: 'flying corpen', asks: ['what course for the helicopter to land on', 'the aircraft needs the wind on the bow at this strength', 'course and speed for flying operations'] },
  { tool: 'Relative Motion', key: 'relative motion', asks: ['what is the contact doing from my radar plot', 'work out the other ship course from two plots', 'how do I pass ahead of her at a set distance'] },
];

export interface Meaning {
  /** the tool the words most likely ask for, with its keyword; null when nothing is close enough */
  intent(text: string): Promise<{ tool: string; key: string; score: number } | null>;
  /** the app's own text that best answers a question; null when nothing is close enough */
  answer(text: string): Promise<{ text: string; score: number } | null>;
}

/** The app's own short answers: the definitions, and the first sentence or two of each tool's explanation. */
export function passages(): string[] {
  const twoSentences = (s: string) => (s.match(/[^.!?]+[.!?]+/g) ?? [s]).slice(0, 2).join('').trim();
  return [...GLOSSARY.map(([, d]) => d), ...Object.entries(TOOL_INFO).map(([name, i]) => `${name}: ${twoSentences(i.concept)}`)];
}

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** `intentMin` and `answerMin` are the least likeness that counts (for MiniLM, 0.45 and 0.4). The phrases are embedded once, on first use. */
export function createMeaning(embed: Embed, { intentMin = 0.45, answerMin = 0.4 } = {}): Meaning {
  let ready: Promise<{ asks: { i: number; v: number[] }[]; texts: string[]; pv: number[][] }> | null = null;
  const prepare = () => ready ??= (async () => {
    const flat = INTENTS.flatMap((it, i) => it.asks.map(a => ({ i, a })));
    const texts = passages();
    const [av, pv] = await Promise.all([embed(flat.map(f => f.a)), embed(texts)]);
    return { asks: flat.map((f, k) => ({ i: f.i, v: av[k] })), texts, pv };
  })().catch(e => { ready = null; throw e; });
  return {
    async intent(text) {
      const [{ asks }, [q]] = await Promise.all([prepare(), embed([text])]);
      let best = { i: -1, score: -1 };
      for (const a of asks) { const s = dot(q, a.v); if (s > best.score) best = { i: a.i, score: s }; }
      return best.i >= 0 && best.score >= intentMin ? { tool: INTENTS[best.i].tool, key: INTENTS[best.i].key, score: best.score } : null;
    },
    async answer(text) {
      const [{ texts, pv }, [q]] = await Promise.all([prepare(), embed([text])]);
      let best = { k: -1, score: -1 };
      pv.forEach((v, k) => { const s = dot(q, v); if (s > best.score) best = { k, score: s }; });
      return best.k >= 0 && best.score >= answerMin ? { text: texts[best.k], score: best.score } : null;
    },
  };
}
