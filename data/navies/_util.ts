// Shorthand for writing the foreign-navy class tables: blanks stay blank, and the numbers for the vessel's particulars are read from the text figures.
import type { ClassSpec, NavyCategory } from '../indianNavy.ts';

type Text = Partial<Omit<ClassSpec, 'name' | 'category' | 'loa' | 'breadth' | 'tons'>>;
const num = (s: string | undefined) => { const m = /(\d[\d,]*(?:\.\d+)?)/.exec(s ?? ''); return m ? parseFloat(m[1].replace(/,/g, '')) : 0; };

/** One class. `wiki` is the Wikipedia article for the picture and description; `displacement` etc. follow Wikipedia (flagged "Wiki" where `janes` differs). */
export function cls(name: string, category: NavyCategory, wiki: string, f: Text = {}): ClassSpec {
  const t = (k: keyof Text) => (f[k] as string | undefined) ?? '';
  return {
    name, category, wiki, builder: t('builder'), displacement: t('displacement'), length: t('length'), beam: t('beam'), draught: t('draught'),
    speed: t('speed'), propulsion: t('propulsion'), complement: t('complement'), armament: t('armament'), sensors: t('sensors'), aircraft: t('aircraft'),
    loa: num(f.length), breadth: num(f.beam), tons: num(f.displacement), ...(f.janes ? { janes: f.janes } : {}),
  };
}
