// The written-down class specifications of the other navies, keyed "navy id:class key" (see foreignNavies.ts, which fills the classes from them).
import type { Spec } from '../_util.ts';
import { PAKISTAN_SPECS } from './pakistan.ts';
import { FRANCE_SPECS } from './france.ts';
import { CHINA_SPECS } from './china.ts';
import { USA_SPECS } from './usa.ts';
import { BANGLADESH_SPECS } from './bangladesh.ts';
import { SRI_LANKA_SPECS } from './sriLanka.ts';
import { TURKEY_SPECS } from './turkey.ts';
import { SOUTH_KOREA_SPECS } from './southKorea.ts';

const keyed = (id: string, r: Record<string, Spec>): [string, Spec][] => Object.entries(r).map(([k, v]) => [`${id}:${k}`, v]);
export const SPECS: Record<string, Spec> = Object.fromEntries([
  ...keyed('pk', PAKISTAN_SPECS), ...keyed('fr', FRANCE_SPECS), ...keyed('cn', CHINA_SPECS), ...keyed('us', USA_SPECS),
  ...keyed('bd', BANGLADESH_SPECS), ...keyed('lk', SRI_LANKA_SPECS), ...keyed('tr', TURKEY_SPECS), ...keyed('kr', SOUTH_KOREA_SPECS),
]);
