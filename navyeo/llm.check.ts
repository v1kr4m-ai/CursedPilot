// Run: node navyeo/llm.check.ts
import assert from 'node:assert/strict';
import { GRAMMAR, SAY_GRAMMAR, SYSTEM_PROMPT, isQuestion, parseModelReply, reference, userPrompt } from './llmPrompt.ts';
import { madeUpNumbers, smartInterpret } from './smart.ts';
import type { Complete } from './smart.ts';
import type { Context } from './commands.ts';

const ctx = (extra: Partial<Context> = {}): Context => ({ tables: [], unit: 'nm', ...extra });
const fake = (answer: string, seen: { calls: number; user?: string } = { calls: 0 }): Complete => async (_s, user) => { seen.calls++; seen.user = user; return answer; };

// the model's one line
assert.deepEqual(parseModelReply('CMD: 1 degree at 1 nm'), { kind: 'cmd', text: '1 degree at 1 nm' });
assert.deepEqual(parseModelReply('  SAY: Hello there.\nignored'), { kind: 'say', text: 'Hello there.' });
assert.equal(parseModelReply('whatever'), null); assert.equal(parseModelReply('CMD:   '), null); assert.equal(parseModelReply(''), null);

// the instructions carry the app's own request styles, and are the same every time (so the phone can keep them in memory)
assert.ok(SYSTEM_PROMPT.includes('CMD: cpa own course 040') && SYSTEM_PROMPT.includes('CMD: course to steer track 090'));   // the formats are in the examples
assert.ok(SYSTEM_PROMPT.includes('CMD:') && SYSTEM_PROMPT.includes('SAY:'));
assert.ok(SYSTEM_PROMPT.length < 2200, `the instructions are ${SYSTEM_PROMPT.length} characters: the phone reads them before its first answer, so keep them short`);
assert.match(GRAMMAR, /root ::= "CMD: " req \| "SAY: " ans/);

// a question gets the app's own explanation to answer from; a calculation does not
assert.match(reference('what is the radian rule'), /L = \(R × angle\) \/ 60/);
assert.match(reference('how does course to steer work'), /set|drift|current/i);
assert.equal(reference('cpa own course 090 own speed 12'), '');
assert.equal(reference('hello'), '');
assert.match(userPrompt('what is the radian rule', null, 'INS Test'), /^Ship: INS Test\nReference: .*\nUser: what is the radian rule\nReply:$/s);
assert.match(userPrompt('target course 270', 'cpa own course 090', undefined), /An earlier request still needs details: cpa own course 090\nUser: target course 270/);

// rules first: when they understand, the model is not asked at all
{
  const seen = { calls: 0 };
  const r = await smartInterpret('1 degree at 1 nm is?', null, ctx(), fake('CMD: nonsense', seen));
  assert.equal(seen.calls, 0); assert.equal(r.via, 'rules'); assert.match((r.reply as { say: string }).say, /33\.3 yd/);
}
// no model (a browser, or none installed): the rules' own reply, including "I did not understand"
{
  const r = await smartInterpret('what is the weather like', null, ctx());
  assert.equal(r.via, 'rules'); assert.ok((r.reply as { unknown?: boolean }).unknown);
}
// the model turns loose speech into a request, and the calculators do the sum
{
  const seen = { calls: 0 } as { calls: number; user?: string };
  const r = await smartInterpret('what angle does a ship of one hundred yards make at a mile', null, ctx(), fake('CMD: what angle does 100 yards subtend at 1 nm', seen));
  assert.equal(seen.calls, 1); assert.equal(r.via, 'model'); assert.equal(r.understoodAs, 'what angle does 100 yards subtend at 1 nm');
  assert.match((r.reply as { say: string }).say, /Angle 3\.00°/);                  // 60 x 100 / 2000, worked out by the app, not the model
  const c = await smartInterpret('steer for a track of north at ten knots with the current setting east at two', null, ctx(), fake('CMD: course to steer track 000 speed 10 set 090 drift 2'));
  assert.equal(c.via, 'model'); assert.match((c.reply as { say: string }).say, /Steer 348°/);   // north and east are 000 and 090: not made up
}
// a request carrying a number that was never said is not used: the model must not invent a figure or work one out
{
  const r = await smartInterpret('steer please', null, ctx(), fake('CMD: course to steer track 000 speed 10 set 090 drift 2'));
  assert.match((r.reply as { say: string }).say, /could not turn that into a calculation/); assert.match(r.modelNote ?? '', /put in 0, 10, 90, 2, which you did not say/);
  const d = await smartInterpret('what is the distance between twelve thirty north seventy two forty five east and fifteen ten north seventy three fifty east', null, ctx(), fake('CMD: distance 12 nm speed 15'));
  assert.doesNotMatch((d.reply as { say: string }).say, /48 min/);   // the probe's made-up "speed 15": now the rules read the two positions themselves
  assert.match((d.reply as { say: string }).say, /Great circle \d+\.\d nm/);
  assert.deepEqual(madeUpNumbers('cpa own course 090 own speed 12 bearing 045 range 6 nm', 'i am on 090 at 12 he bears 045 at 6 miles', null), []);
  assert.deepEqual(madeUpNumbers('atb bearing 135', 'contact bears 045', null), [135]);
}
// a model that fails or is too slow says why, so the screen can show it rather than silently giving the keyword answer
{
  const r = await smartInterpret('do the thing', null, ctx(), async () => { throw new Error('The NavYeo model took too long.'); });
  assert.equal(r.via, 'rules'); assert.equal(r.modelNote, 'The NavYeo model took too long.');
}
// spoken CPA: "he is on 270 doing 8, I am on 090 at 12" is read by the rules themselves
{
  const seen = { calls: 0 };
  const r = await smartInterpret('what is my closest point of approach contact bearing zero four five at six miles he is on two seven zero doing eight i am on zero nine zero at twelve', null, ctx(), fake('SAY: no', seen));
  assert.equal(seen.calls, 0); assert.match((r.reply as { say: string }).say, /CPA 4\.24 nm/);
}
// a question is answered by the model's own short line
{
  const r = await smartInterpret('who are you', null, ctx(), fake('SAY: I am NavYeo, your navigator\'s assistant.'));
  assert.equal(r.via, 'model'); assert.deepEqual(r.reply, { kind: 'say', say: 'I am NavYeo, your navigator\'s assistant.' }); assert.equal(r.pending, null);
}
// a request the rules still cannot read, or a model that fails or rambles, never becomes a made-up answer
{
  const bad = await smartInterpret('do the thing', null, ctx(), fake('CMD: dance with the moon'));
  assert.match((bad.reply as { say: string }).say, /could not turn that into a calculation/);
  const failed = await smartInterpret('do the thing', null, ctx(), async () => { throw new Error('model gone'); });
  assert.equal(failed.via, 'rules'); assert.ok((failed.reply as { unknown?: boolean }).unknown);
  const junk = await smartInterpret('do the thing', null, ctx(), fake('lorem ipsum'));
  assert.equal(junk.via, 'rules');
}
// an unfinished request is still waiting for its numbers, and the model sees it
{
  const first = await smartInterpret('cpa own course 090 own speed 12 bearing 045', null, ctx());
  assert.ok(first.pending);
  const seen = { calls: 0 } as { calls: number; user?: string };
  const next = await smartInterpret('target course two seven zero she is doing eight and six off', first.pending, ctx(), fake('CMD: cpa own course 090 own speed 12 bearing 045 range 6 nm target course 270 speed 8', seen));
  assert.match(seen.user ?? '', /An earlier request still needs details: cpa own course 090/); assert.equal(next.via, 'model'); assert.match((next.reply as { say: string }).say, /CPA 4\.24 nm/);
}

// a spoken sentence with a stray keyword ("setting" would open Rise and Set) goes to the model, which sends the real request to the calculators
{
  const seen = { calls: 0 };
  const said = 'i am making good zero nine zero at twelve knots with the current setting zero four five at two knots what course should i steer';
  const r = await smartInterpret(said, null, ctx(), fake('CMD: course to steer track 090 speed 12 set 045 drift 2', seen));
  assert.equal(seen.calls, 1); assert.equal(r.via, 'model'); assert.match((r.reply as { say: string }).say, /Steer \d{3}°/);
  // spoken number words reach the rules as digits, so "twelve knots" is understood without the model
  const w = await smartInterpret('convert twelve knots to metres per second', null, ctx(), fake('CMD: nonsense', { calls: 0 }));
  assert.equal(w.via, 'rules'); assert.match((w.reply as { say: string }).say, /12 knots = 6\.173/);
  // the contact "steering" 270 is not a word the rules know: the model reads it, and the answer is worked out exactly
  const a = await smartInterpret('the contact bears zero four five and is steering two seven zero what is the angle on the bow', null, ctx(), fake('CMD: atb bearing 045 target course 270'));
  assert.equal(a.via, 'model'); assert.match((a.reply as { say: string }).say, /45° red \(port\)/);
}
// a model that does no better than the rules leaves the rules' own reply
{
  const r = await smartInterpret('i am making good zero nine zero at twelve knots with the current setting zero four five at two knots what course should i steer', null, ctx(), fake('CMD: rise and set'));
  assert.equal(r.via, 'rules'); assert.equal(r.reply.kind, 'open');
}
// questions are answered, never turned into a calculation: the model is held to SAY, and gets the app's own definition
{
  let grammar = '', user = '';
  const ask: Complete = async (_s, u, g) => { grammar = g; user = u; return 'SAY: A cable is a tenth of a nautical mile.'; };
  const r = await smartInterpret('what is a cable', null, ctx(), ask);
  assert.equal(grammar, SAY_GRAMMAR); assert.match(user, /Reference: A cable is one tenth of a nautical mile/); assert.equal(r.via, 'model'); assert.deepEqual(r.reply, { kind: 'say', say: 'A cable is a tenth of a nautical mile.' });
  await smartInterpret('what is cpa', null, ctx(), ask); assert.equal(grammar, SAY_GRAMMAR); assert.match(user, /closest point of approach/);
  assert.equal(isQuestion('what is a cable'), true); assert.equal(isQuestion('explain the radian rule'), true); assert.equal(isQuestion('how does corpen work'), true);
  assert.equal(isQuestion('how many hours will fifty miles take'), false); assert.equal(isQuestion('how far on eighty tonnes'), false); assert.equal(isQuestion('cpa own course 090'), false);
  assert.equal(isQuestion('what is my closest point of approach contact bearing 045 at 6 miles he is on 270 doing 8 i am on 090 at 12'), false);
  assert.equal(isQuestion('what is the angle on the bow if the contact bears 045 and is steering 270'), false);
  assert.equal(isQuestion('what is the distance between 12 30 north 72 45 east and 15 10 north 73 50 east'), false);
  assert.equal(isQuestion('explain the radian rule for 1 degree at 1 mile'), true);
  assert.match(reference('what is the difference between true and magnetic north'), /True north is toward the geographic pole/);
}
// a calculation asked in the form of a question is not held to a plain answer: the model may send it to the calculators
{
  let grammar = '';
  const ask: Complete = async (_s, _u, g) => { grammar = g; return 'CMD: atb bearing 045 target course 270'; };
  const r = await smartInterpret('what is the angle on the bow if the contact bears zero four five and is steering two seven zero', null, ctx(), ask);
  assert.equal(grammar, GRAMMAR); assert.equal(r.via, 'model'); assert.match((r.reply as { say: string }).say, /45° red \(port\)/);
}
// short commands that the rules already handle never wait for the model
{
  const seen = { calls: 0 };
  for (const q of ['compass', 'open cpa', 'regain track', 'tides']) { const r = await smartInterpret(q, null, ctx(), fake('SAY: no', seen)); assert.equal(r.via, 'rules', q); }
  assert.equal(seen.calls, 0);
}
console.log('llm: all checks passed');
