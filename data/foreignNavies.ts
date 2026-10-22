// Ships of other navies, in the same form as the Indian Navy catalogue (indianNavy.ts): classes with their commonly published figures, and the
// ships of each class. They are compiled from open sources (chiefly Wikipedia class and ship articles) and are NOT official data: the fleets change
// constantly, class figures are the commonly published ones, and every field is editable in the app. They are only shown in the Fleet when the
// country is selected there, or when a search matches them. Not included: small craft, tugs, landing craft, and ships not yet in service.
import type { CatalogShip, ClassSpec, ShipRow } from './indianNavy.ts';
import { PAKISTAN } from './navies/pakistan.ts';
import { BANGLADESH } from './navies/bangladesh.ts';
import { SRI_LANKA } from './navies/sriLanka.ts';
import { TURKEY } from './navies/turkey.ts';
import { FRANCE } from './navies/france.ts';
import { CHINA } from './navies/china.ts';
import { USA } from './navies/usa.ts';
import { SOUTH_KOREA } from './navies/southKorea.ts';

export interface NavyInfo { id: string; label: string; /** how a ship's name is written: PNS Tughril */ prefix: string; /** words a search may use for the country */ words: string }
export interface NavyData { navy: NavyInfo; classes: Record<string, ClassSpec>; ships: Record<string, ShipRow[]> }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function buildCatalog(n: NavyData): CatalogShip[] {
  return Object.entries(n.ships).flatMap(([key, rows]) => rows.map(([name, pennant, commissioned, extra = {}]): CatalogShip => {
    const cls = n.classes[key];
    if (!cls) throw new Error(`${n.navy.label}: no class ${key}`);
    const under = name.replace(/ /g, '_');
    const prefix = extra.prefix ?? n.navy.prefix;
    return {
      id: `${n.navy.id}-${slug(pennant || name)}-${slug(name)}`,
      name, pennant, commissioned, cls, navy: n.navy.id, prefix,
      builder: extra.builder ?? cls.builder, status: extra.status ?? 'In service', notes: extra.notes ?? '',
      wikiCandidates: [
        ...(extra.wiki ? [extra.wiki] : []),
        ...(pennant ? [`${prefix}_${under}_(${pennant})`] : []),
        `${prefix}_${under}`,
        cls.wiki,
      ],
    };
  }));
}

export const NAVY_DATA: NavyData[] = [PAKISTAN, FRANCE, CHINA, USA, BANGLADESH, SRI_LANKA, TURKEY, SOUTH_KOREA];
/** The navies that can be toggled in the Fleet (the Indian Navy is always shown). */
export const NAVY_LIST: NavyInfo[] = NAVY_DATA.map(d => d.navy);
export const FOREIGN_CATALOG: CatalogShip[] = NAVY_DATA.flatMap(buildCatalog);
