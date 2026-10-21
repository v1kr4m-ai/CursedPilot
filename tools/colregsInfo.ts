import { RULE_TEXT } from './colregsText.ts';
import type { RuleText } from './colregsText.ts';

/** "Rule 23 · Part C, Lights and Shapes" (for Part B the Section as well). */
export const ruleLabel = (n: number): string => {
  const r = RULE_TEXT.find(x => x.kind === 'rule' && x.n === n);
  if (!r) return `Rule ${n}`;
  return `Rule ${n} · Part ${r.part}, ${r.partTitle}${r.section ? ` · Section ${r.section}` : ''}`;
};

export const ruleLabels = (rule: number | number[]): string => (Array.isArray(rule) ? rule : [rule]).map(n => `Rule ${n} · Part ${RULE_TEXT.find(x => x.n === n)?.part ?? '?'}`).join(', ');

/** The rules and annexes grouped as they are printed: Part A, Part B Section I, ... Annexes. */
export const groupedRules = (): { key: string; title: string; items: RuleText[] }[] => {
  const out: { key: string; title: string; items: RuleText[] }[] = [];
  for (const r of RULE_TEXT) {
    const key = `${r.part}${r.section}`;
    let g = out.find(x => x.key === key);
    if (!g) {
      const title = r.kind === 'annex' ? 'Annexes' : `Part ${r.part} — ${r.partTitle}${r.section ? ` · Section ${r.section} — ${r.sectionTitle}` : ''}`;
      g = { key, title, items: [] };
      out.push(g);
    }
    g.items.push(r);
  }
  return out;
};

export const ruleName = (r: RuleText): string => (r.kind === 'rule' ? `Rule ${r.n} — ${r.title}` : `Annex ${r.n} — ${r.title}`);
export const ruleSearchText = (r: RuleText): string => `${ruleName(r)} ${r.blocks.map(b => b[2]).join(' ')}`;
