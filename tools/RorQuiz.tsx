import React from 'react';
import { useMemory } from './kit';

// ROR card quiz: a card shows the lights (or shapes) a vessel is seen to show; work out what she is, what you do, the day signal and
// the sound signal, then reveal the answer and mark yourself. The cards come from the private overlay tools/private/ror (the picture
// of each card and its answer, taken from the ROR card set); without it the quiz says so.

interface Card { n: number; page: number; label: string; img: string; lines: string[] }
const dataFiles = (import.meta as any).glob('./private/ror/cards.json', { eager: true, import: 'default' }) as Record<string, Card[]>;
const imageFiles = (import.meta as any).glob('./private/ror/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const CARDS: Card[] = Object.values(dataFiles)[0] ?? [];
const imageOf = (c: Card) => imageFiles[`./private/ror/${c.img}`];

type Mark = 'ok' | 'miss';
const DECKS = [['all', 'All'], ['unseen', 'Not yet seen'], ['missed', 'Missed']] as const;
const pick = (pool: Card[], not?: number) => { const p = pool.length > 1 ? pool.filter(c => c.n !== not) : pool; return p[Math.floor(Math.random() * p.length)]; };

export const RorQuiz: React.FC = () => {
  const [marks, setMarks] = useMemory<Record<string, Mark>>('ror:marks', {});
  const [deck, setDeck] = useMemory<string>('ror:deck', 'all');
  const [cur, setCur] = React.useState<number>(() => (CARDS.length ? CARDS[Math.floor(Math.random() * CARDS.length)].n : 0));   // a random card each time the quiz opens
  const [shown, setShown] = React.useState(false);
  if (!CARDS.length) return <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium">The ROR cards are not part of this build. They come from your own card set and are kept out of the public copy of the app (tools/private/ror).</p>;

  const pool = CARDS.filter(c => deck === 'missed' ? marks[c.n] === 'miss' : deck === 'unseen' ? !marks[c.n] : true);
  const card = CARDS.find(c => c.n === cur) ?? CARDS[0];
  const next = () => { setShown(false); const p = pick(pool.length ? pool : CARDS, card.n); setCur(p.n); };
  const mark = (m: Mark) => { setMarks(prev => ({ ...prev, [card.n]: m })); next(); };
  const ok = CARDS.filter(c => marks[c.n] === 'ok').length, miss = CARDS.filter(c => marks[c.n] === 'miss').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">{DECKS.map(([k, label]) => <button key={k} onClick={() => { setDeck(k); setShown(false); }} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${deck === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>)}</div>
        <span className="text-[10px] font-semibold text-slate-500">{ok} right · {miss} missed · {CARDS.length - ok - miss} new</span>
      </div>
      {pool.length === 0 ? <p className="text-xs text-slate-500 font-medium">No cards in this deck. {deck === 'missed' ? 'Nothing missed yet.' : 'You have seen them all.'}</p> : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-2 space-y-2">
            <p className="text-[10px] font-semibold text-slate-400">Card {card.n} of {CARDS.length}{marks[card.n] ? ` · last time ${marks[card.n] === 'ok' ? 'right' : 'missed'}` : ''}</p>
            <img src={imageOf(card)} alt="The lights or shapes on the card" className="w-full rounded-lg" />
            <p className="text-[11px] text-slate-500 font-medium">What is she, which aspect do you see, what do you do, the day signal and the sound signal?</p>
            {shown ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 space-y-0.5">{card.lines.map((l, i) => <p key={i} className="text-xs text-slate-700 font-medium leading-snug">{l}</p>)}</div>
            ) : <button onClick={() => setShown(true)} className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Show the answer</button>}
          </div>
          {shown && <div className="grid grid-cols-2 gap-2"><button onClick={() => mark('ok')} className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">I knew it</button><button onClick={() => mark('miss')} className="py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">I missed it</button></div>}
          <div className="flex justify-between">
            <button onClick={next} className="text-[11px] font-bold text-slate-500">Skip</button>
            <button onClick={() => { if (confirm('Clear your marks?')) { setMarks({}); setShown(false); } }} className="text-[11px] font-bold text-slate-400">Reset scores</button>
          </div>
        </>
      )}
    </div>
  );
};
