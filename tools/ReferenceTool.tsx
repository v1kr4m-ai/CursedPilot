import React from 'react';
import { BUOYAGE_NOTES, BUOYS, LIGHT_TYPES, REFERENCE_NOTE, SHAPES, SOUND_FOG, SOUND_MANOEUVRING, VESSEL_LIGHTS, VISIBILITY } from './refData';
import type { Buoy, RefRow, Topmark } from './refData';
import { Card, Field, useMemory } from './kit';
import { groupedRules, ruleLabels, ruleName, ruleSearchText } from './colregsInfo';
import type { RuleText } from './colregsText';
import { LightPicture } from './LightPics';
import { RorQuiz } from './RorQuiz';

// The BR 45 explanations and examples are kept out of the public copy of the project: tools/private/colregsCommentary.json is
// picked up when it is there, and the info buttons say so when it is not.
interface Commentary { para: string; title: string; blocks: string[] }
const privateFiles = (import.meta as any).glob('./private/colregsCommentary.json', { eager: true, import: 'default' }) as Record<string, { rules: Record<string, Commentary[]> }>;
const COMMENTARY: Record<string, Commentary[]> | null = Object.values(privateFiles)[0]?.rules ?? null;

const InfoPanel: React.FC<{ rules: number[] }> = ({ rules }) => {
  const secs = COMMENTARY ? rules.flatMap(n => COMMENTARY[String(n)] ?? []).filter((c, i, a) => a.findIndex(x => x.para === c.para) === i) : [];
  return (
    <div className="mt-1 rounded-lg bg-amber-50 border border-amber-200 p-2 space-y-1.5">
      {!COMMENTARY && <p className="text-[11px] text-amber-800 font-medium">The BR 45 explanation and examples are not part of this build. The book is UK RESTRICTED, so they are kept out of the public copy of the app.</p>}
      {COMMENTARY && !secs.length && <p className="text-[11px] text-amber-800 font-medium">BR 45 has no separate note for this one.</p>}
      {secs.map(c => (
        <div key={c.para}>
          <p className="text-[11px] font-bold text-amber-900">BR 45(4) para {c.para}. {c.title}</p>
          {c.blocks.map((b, i) => <p key={i} className="text-[11px] text-slate-700 font-medium leading-snug mt-0.5">{b}</p>)}
        </div>
      ))}
      {secs.length > 0 && <p className="text-[10px] text-amber-700 font-medium">From BR 45(4) chapter 9. The figures and plots of the book are not included.</p>}
    </div>
  );
};

/** The info button: shows the BR 45 explanation of the rule(s). It sits in a summary, so it must not toggle the row. */
const InfoButton: React.FC<{ rules: number[]; open: boolean; toggle: () => void }> = ({ rules, open, toggle }) => (
  <button type="button" aria-label={`Explanation of ${rules.map(n => `Rule ${n}`).join(', ')}`} aria-expanded={open} onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(); }}
    className={`shrink-0 w-5 h-5 rounded-full border text-[11px] font-bold leading-none ${open ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-300'}`}>i</button>
);


// Rules and Buoyage: a quick reference to look things up in. The text is in refData.ts.

const TOPMARK_COLOUR: Record<string, string> = { port: '#dc2626', stbd: '#16a34a', 'pref-stbd': '#dc2626', 'pref-port': '#16a34a', safe: '#dc2626', special: '#facc15', wreck: '#facc15' };

/** A topmark drawn about the point (cx, bottomY): `bottomY` is the top of the buoy. */
const TopmarkShape: React.FC<{ mark: Topmark; cx: number; bottomY: number; fill: string }> = ({ mark, cx, bottomY, fill }) => {
  const up = (y: number) => <polygon points={`${cx},${y - 9} ${cx - 6},${y} ${cx + 6},${y}`} fill={fill} />;           // cone, point up, base at y
  const down = (y: number) => <polygon points={`${cx - 6},${y - 9} ${cx + 6},${y - 9} ${cx},${y}`} fill={fill} />;     // cone, point down, base at y - 9
  const y1 = bottomY - 2, y2 = bottomY - 13;
  switch (mark) {
    case 'can': return <rect x={cx - 6} y={bottomY - 14} width={12} height={12} fill={fill} />;
    case 'cone-up': return up(bottomY - 2);
    case 'cone-down': return down(bottomY - 2);
    case 'two-cones-up': return <>{up(y1)}{up(y2)}</>;
    case 'two-cones-down': return <>{down(y1)}{down(y2)}</>;
    case 'two-cones-base': return <>{down(y1)}{up(y2 + 0)}</>;       // lower cone points down, upper points up: bases meet
    case 'two-cones-point': return <>{up(y1)}{down(y2)}</>;          // lower cone points up, upper points down: points meet
    case 'two-spheres': return <><circle cx={cx} cy={y1 - 4} r={5} fill={fill} /><circle cx={cx} cy={y2 - 4} r={5} fill={fill} /></>;
    case 'sphere': return <circle cx={cx} cy={bottomY - 8} r={6} fill={fill} />;
    case 'x': return <g stroke={fill} strokeWidth={3} strokeLinecap="round"><line x1={cx - 6} y1={bottomY - 14} x2={cx + 6} y2={bottomY - 2} /><line x1={cx + 6} y1={bottomY - 14} x2={cx - 6} y2={bottomY - 2} /></g>;
    case 'cross': return <g stroke={fill} strokeWidth={3} strokeLinecap="round"><line x1={cx} y1={bottomY - 15} x2={cx} y2={bottomY - 2} /><line x1={cx - 6} y1={bottomY - 9} x2={cx + 6} y2={bottomY - 9} /></g>;
    default: return null;
  }
};

export const BuoyGlyph: React.FC<{ b: Buoy }> = ({ b }) => {
  const W = 52, H = 96, cx = W / 2, top = 42, bottom = 80, id = `clip-${b.id}`;
  const body = (() => {
    switch (b.shape) {
      case 'can': return <rect x={cx - 12} y={top} width={24} height={bottom - top} />;
      case 'cone': return <polygon points={`${cx},${top - 2} ${cx + 13},${bottom} ${cx - 13},${bottom}`} />;
      case 'sphere': return <circle cx={cx} cy={(top + bottom) / 2 + 2} r={17} />;
      case 'spar': return <rect x={cx - 3} y={top - 14} width={6} height={bottom - top + 14} />;
      default: return <rect x={cx - 8} y={top - 6} width={16} height={bottom - top + 6} />;
    }
  })();
  // where the body starts, so the bands are spread over the body itself
  const bodyTop = b.shape === 'cone' ? top - 2 : b.shape === 'sphere' ? (top + bottom) / 2 + 2 - 17 : b.shape === 'spar' ? top - 14 : b.shape === 'pillar' ? top - 6 : top;
  const tmTop = bodyTop;
  const stripes = b.paint.kind === 'stripes' ? b.paint.colours : null;
  let y = bodyTop;
  const total = bottom - bodyTop;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${b.name}: ${b.colour}`} className="shrink-0 rounded-lg bg-sky-100">
      <defs><clipPath id={id}>{body}</clipPath></defs>
      <rect x={0} y={bottom + 4} width={W} height={H - bottom - 4} fill="#38bdf8" opacity={0.5} />
      <g clipPath={`url(#${id})`}>
        {b.paint.kind === 'bands'
          ? b.paint.bands.map(([colour, share], i) => { const h = share * total, r = <rect key={i} x={0} y={y} width={W} height={h + 0.5} fill={colour} />; y += h; return r; })
          : Array.from({ length: 6 }, (_, i) => <rect key={i} x={(W / 6) * i + 0} y={bodyTop} width={W / 6 + 0.5} height={total} fill={stripes![i % 2]} />)}
      </g>
      <g stroke="#0f172a" strokeOpacity={0.35} strokeWidth={0.8} fill="none">{body}</g>
      {b.topmark && <TopmarkShape mark={b.topmark} cx={cx} bottomY={tmTop} fill={TOPMARK_COLOUR[b.id] ?? '#111827'} />}
    </svg>
  );
};

const matches = (q: string, ...parts: string[]) => q.trim() === '' || parts.join(' ').toLowerCase().includes(q.trim().toLowerCase());

const asList = (r?: number | number[]) => (r === undefined ? [] : Array.isArray(r) ? r : [r]);

const Rows: React.FC<{ rows: RefRow[]; q: string }> = ({ rows, q }) => {
  const [info, setInfo] = React.useState<string | null>(null);
  const shown = rows.filter(r => matches(q, r.title, ...r.lines, r.rule ? ruleLabels(r.rule) : ''));
  if (!shown.length) return <p className="text-xs text-slate-400 font-medium">Nothing matches.</p>;
  return (
    <div className="space-y-1.5">
      {shown.map(r => (
        <details key={r.title} open={q.trim() !== ''} className="group bg-white rounded-xl border border-slate-200">
          <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-xs font-bold text-slate-700">
            <span className="min-w-0">{r.title}{r.rule !== undefined && <span className="block text-[10px] font-semibold text-blue-600">{ruleLabels(r.rule)}</span>}</span>
            <span className="flex items-center gap-2 shrink-0">
              {r.rule !== undefined && <InfoButton rules={asList(r.rule)} open={info === r.title} toggle={() => setInfo(info === r.title ? null : r.title)} />}
              <span className="text-slate-300 group-open:rotate-90 transition-transform" aria-hidden>›</span>
            </span>
          </summary>
          <div className="px-3 pb-2 space-y-1">
            {info === r.title && r.rule !== undefined && <InfoPanel rules={asList(r.rule)} />}
            <div className="flex gap-3 items-start">
              {r.pic && <div className="space-y-0.5"><LightPicture pic={r.pic} />{r.pic.view && <p className="text-[9px] text-slate-400 font-medium max-w-[110px] leading-tight">{r.pic.view}</p>}</div>}
              <div className="space-y-1 min-w-0">{r.lines.map((l, i) => <p key={i} className="text-xs text-slate-600 font-medium leading-snug">{l}</p>)}</div>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
};

const INDENT = ['', 'pl-0', 'pl-5', 'pl-9'];

/** One rule or annex word for word. */
const RuleBody: React.FC<{ r: RuleText }> = ({ r }) => (
  <div className="space-y-1">
    {r.blocks.map(([level, marker, text], i) => (
      <p key={i} className={`text-xs text-slate-700 font-medium leading-snug flex gap-1.5 ${INDENT[Math.min(level, 3)]}`}>
        {marker && <span className="shrink-0 font-bold text-slate-500">{marker}</span>}<span>{text}</span>
      </p>
    ))}
  </div>
);

const RulesTab: React.FC<{ q: string }> = ({ q }) => {
  const [info, setInfo] = React.useState<string | null>(null);
  const searching = q.trim() !== '';
  const groups = groupedRules().map(g => ({ ...g, items: g.items.filter(r => matches(q, ruleSearchText(r))) })).filter(g => g.items.length);
  if (!groups.length) return <p className="text-xs text-slate-400 font-medium">Nothing matches.</p>;
  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">About the Rules (BR 45 chapter 9)</span>
        <InfoButton rules={[0]} open={info === 'about'} toggle={() => setInfo(info === 'about' ? null : 'about')} />
      </div>
      {info === 'about' && <InfoPanel rules={[0]} />}
      {groups.map(g => (
        <Card key={g.key} title={g.title} closed={!searching}>
          <div className="space-y-1.5">
            {g.items.map(r => {
              const id = `${r.kind}${r.n}`;
              const num = typeof r.n === 'number' ? [r.n] : [];
              return (
                <details key={id} open={searching} className="group bg-white rounded-xl border border-slate-200">
                  <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-xs font-bold text-slate-700">
                    <span>{ruleName(r)}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {num.length > 0 && <InfoButton rules={num} open={info === id} toggle={() => setInfo(info === id ? null : id)} />}
                      <span className="text-slate-300 group-open:rotate-90 transition-transform" aria-hidden>›</span>
                    </span>
                  </summary>
                  <div className="px-3 pb-2 space-y-1.5">
                    {info === id && <InfoPanel rules={num} />}
                    <RuleBody r={r} />
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
};

const BuoyRow: React.FC<{ b: Buoy }> = ({ b }) => (
  <div className="flex gap-3 p-2 bg-white rounded-xl border border-slate-200">
    <BuoyGlyph b={b} />
    <div className="min-w-0 text-xs space-y-0.5">
      <p className="font-bold text-slate-800 text-[13px] leading-tight">{b.name}</p>
      <p className="text-slate-600 font-medium"><b>Colour:</b> {b.colour}</p>
      <p className="text-slate-600 font-medium"><b>Topmark:</b> {b.topmarkText}</p>
      <p className="text-slate-600 font-medium"><b>Light:</b> {b.light}</p>
      <p className="text-slate-500 font-medium leading-snug">{b.meaning}</p>
    </div>
  </div>
);

const TABS = [['buoyage', 'Buoyage'], ['lights', 'Lights'], ['sound', 'Sound'], ['rules', 'Rules'], ['quiz', 'ROR quiz']] as const;

export const ReferenceTool: React.FC = () => {
  const [tab, setTab] = useMemory<string>('ref:tab', 'buoyage');
  const [q, setQ] = useMemory<string>('ref:q', '');
  const groups: Buoy['group'][] = ['Lateral', 'Cardinal', 'Other'];
  const any = (rows: RefRow[]) => rows.some(r => matches(q, r.title, ...r.lines, r.rule ? ruleLabels(r.rule) : ''));
  return (
    <div className="space-y-2">
      <Field label="Search" text hint="e.g. trawling, east cardinal, overtaking" value={q} onChange={setQ} />
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Reference sections">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border ${tab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
        ))}
      </div>

      {tab === 'buoyage' && (
        <>
          <Card title="IALA buoyage, Region A (India)" closed>{BUOYAGE_NOTES.map(n => <p key={n} className="text-xs text-slate-600 font-medium leading-snug">{n}</p>)}</Card>
          {groups.map(g => {
            const list = BUOYS.filter(b => b.group === g && matches(q, b.name, b.colour, b.topmarkText, b.light, b.meaning));
            return list.length ? <Card key={g} title={`${g} marks`}>{list.map(b => <BuoyRow key={b.id} b={b} />)}</Card> : null;
          })}
          {!BUOYS.some(b => matches(q, b.name, b.colour, b.topmarkText, b.light, b.meaning)) && <p className="text-xs text-slate-400 font-medium">Nothing matches.</p>}
        </>
      )}

      {tab === 'lights' && (
        <>
          {any(LIGHT_TYPES) && <Card title="The lights and their arcs (Part C, Rule 21)" closed={q.trim() === ''}><Rows rows={LIGHT_TYPES} q={q} /></Card>}
          {matches(q, 'visibility range nm masthead sidelight sternlight towing all-round length') && (
            <Card title="How far the lights are seen (Part C, Rule 22)" closed={q.trim() === ''}>
              <div className="overflow-x-auto"><table className="w-full text-[11px] text-slate-700">
                <thead><tr className="text-left text-[9px] uppercase text-slate-400"><th className="py-1 pr-2">Vessel</th><th className="pr-2">Mast-head</th><th className="pr-2">Side</th><th className="pr-2">Stern</th><th className="pr-2">Tow</th><th>All-round</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{VISIBILITY.map(v => <tr key={v.length} className="font-medium align-top"><td className="py-1 pr-2 font-bold">{v.length}</td><td className="pr-2">{v.masthead}</td><td className="pr-2">{v.side}</td><td className="pr-2">{v.stern}</td><td className="pr-2">{v.towing}</td><td>{v.allRound}</td></tr>)}</tbody>
              </table></div>
            </Card>
          )}
          {any(VESSEL_LIGHTS) && <Card title="Lights and shapes by vessel (Part C, Rules 23 to 31)"><Rows rows={VESSEL_LIGHTS} q={q} /></Card>}
          {any(SHAPES) && <Card title="Day shapes" closed={q.trim() === ''}><Rows rows={SHAPES} q={q} /></Card>}
        </>
      )}

      {tab === 'sound' && (
        <>
          {any(SOUND_MANOEUVRING) && <Card title="Manoeuvring and warning signals (Part D, Rules 32 and 34)"><Rows rows={SOUND_MANOEUVRING} q={q} /></Card>}
          {any(SOUND_FOG) && <Card title="In or near restricted visibility (Part D, Rule 35)"><Rows rows={SOUND_FOG} q={q} /></Card>}
        </>
      )}

      {tab === 'rules' && <RulesTab q={q} />}
      {tab === 'quiz' && <RorQuiz />}
      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{REFERENCE_NOTE}</p>
    </div>
  );
};
