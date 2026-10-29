// Run: node navyeo/meaning.check.ts
// The real sentence model runs in the app (embedder.ts); here a stand-in that compares words checks the matching and how NavYeo uses it.
import assert from 'node:assert/strict';
import { INTENTS, createMeaning, passages } from './meaning.ts';
import type { Embed } from './meaning.ts';
import { interpret } from './commands.ts';
import type { Context } from './commands.ts';
import { smartInterpret } from './smart.ts';

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'of', 'do', 'i', 'we', 'us', 'my', 'it', 'at', 'in', 'on', 'what', 'how', 'will', 'that', 'this', 'and', 'with', 'be', 'she', 'her', 'for']);
const words = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.replace(/(?:ing|ed|es|s)$/, ''));
const bag: Embed = async texts => texts.map(t => {
  const v = new Array(512).fill(0);
  for (const w of words(t)) { let h = 0; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) % 512; v[h] += 1; }
  const n = Math.hypot(...v) || 1;
  return v.map(x => x / n);
});
const ctx: Context = { tables: [], unit: 'nm' };

// every tool's keyword is one the rules know, so the numbers said with it are still read
for (const it of INTENTS) {
  const r = interpret(it.key, ctx);
  assert.ok(r.kind === 'open' && r.tool === it.tool || r.kind === 'say' && !r.unknown, `${it.key}: ${JSON.stringify(r).slice(0, 120)}`);
}
assert.ok(passages().some(p => p.startsWith('A cable is one tenth')) && passages().some(p => p.startsWith('CPA / TCPA:')));

const m = createMeaning(bag, { intentMin: 0.4, answerMin: 0.35 });
assert.equal((await m.intent('will the ship hit us'))?.tool, 'CPA / TCPA');
assert.equal((await m.intent('someone has fallen over the side'))?.tool, 'Man Overboard Turn');
assert.equal(await m.intent('banana'), null);
assert.match((await m.answer('what is a fathom'))?.text ?? '', /6 feet/);

// in NavYeo: loose words with no keyword find the tool, and the rules read the numbers
{
  const r = await smartInterpret('will that ship hit us, she bears 045 at 6 miles', null, ctx, undefined, undefined, m);
  assert.equal(r.via, 'meaning'); assert.equal(r.understoodAs, 'CPA / TCPA'); assert.equal(r.reply.kind, 'open');
  assert.match(r.reply.say, /What is your course\?/);
  // a question gets the app's own words
  const q = await smartInterpret('what is a fathom', null, ctx, undefined, undefined, m);
  assert.equal(q.via, 'meaning'); assert.match(q.reply.say, /6 feet, 1\.83 metres/);
  // the rules still come first: a request they understand never goes by meaning
  const k = await smartInterpret('cpa own course 090 own speed 12 bearing 045 range 6 nm target course 270 speed 8', null, ctx, undefined, undefined, m);
  assert.equal(k.via, 'rules');
  // a sentence model that fails is passed over
  const broken = createMeaning(async () => { throw new Error('no model'); });
  const b = await smartInterpret('will that ship hit us', null, ctx, undefined, undefined, broken);
  assert.equal(b.via, 'rules');
  // nothing close enough: the rules' own "did not understand" (and the model, when there is one, is still asked)
  let asked = 0;
  const n = await smartInterpret('banana split please', null, ctx, async () => { asked++; return 'SAY: I do not know that one.'; }, undefined, m);
  assert.equal(asked, 1); assert.equal(n.via, 'model');
}
console.log('meaning: all checks passed');
