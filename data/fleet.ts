// Fleet registry logic: the built-in catalogue as ships, category names, and the user's pins, usage counts,
// sort choice and "My Ship". All pure apart from load/save, so `node data/fleet.check.ts` can check it.
import type { Ship, ShipInfo } from '../types.ts';
import { CATALOG, NAVY_CATEGORIES } from './indianNavy.ts';
import type { CatalogShip } from './indianNavy.ts';

export const CATEGORIES: readonly string[] = NAVY_CATEGORIES;
export const MAX_PINS = 5;

const LEGACY: Record<string, string> = {
  Destroyer: 'Destroyers', Frigate: 'Frigates', Corvette: 'Corvettes', Submarine: 'Submarines',
  OPVs: 'Offshore Patrol Vessels', NOPVs: 'Offshore Patrol Vessels', LSTs: 'Amphibious Ships',
  Tankers: 'Fleet Tankers', 'Research Vessels': 'Survey & Research Vessels',
};
/** Maps the category names older versions saved ("Destroyer", "NOPVs"...) onto the current list. */
export const normalizeCategory = (t: string) => (CATEGORIES.includes(t) ? t : LEGACY[t] ?? 'Other');

const displayName = (c: CatalogShip) => (/^INSV /.test(c.name) ? c.name : `INS ${c.name}`);

export function catalogToShip(c: CatalogShip): Ship {
  const info: ShipInfo = {
    shipClass: c.cls.name, pennant: c.pennant, builder: c.builder, commissioned: c.commissioned, status: c.status,
    displacement: c.cls.displacement, length: c.cls.length, beam: c.cls.beam, draught: c.cls.draught, speed: c.cls.speed,
    propulsion: c.cls.propulsion, complement: c.cls.complement, armament: c.cls.armament, sensors: c.cls.sensors,
    aircraft: c.cls.aircraft, notes: c.notes, wiki: c.wikiCandidates.join(','),
  };
  return {
    id: c.id, name: displayName(c), type: c.cls.category,
    particulars: { lengthOverall: c.cls.loa, breadthOverall: c.cls.breadth, displacement: c.cls.tons, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 },
    turningDataSets: [], accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: [],
    info, catalog: true,
  };
}

/**
 * The saved fleet plus any catalogue ships it does not have yet, with old category names updated.
 * Ships already present are never overwritten, so the user's edits survive.
 */
export function mergeCatalog(stored: Ship[]): Ship[] {
  const have = new Set(stored.map(s => s.id));
  const fixed = stored.map(s => (CATEGORIES.includes(s.type) ? s : { ...s, type: normalizeCategory(s.type) }));
  return [...fixed, ...CATALOG.filter(c => !have.has(c.id)).map(catalogToShip)];
}

// ---- commissioning date --------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2014-08" -> "Aug 2014", "2008" -> "2008"; anything else is shown as typed. */
export function formatCommissioned(v: string | undefined): string {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-\d{2})?$/.exec((v ?? '').trim());
  if (!m) return (v ?? '').trim();
  return m[2] && +m[2] >= 1 && +m[2] <= 12 ? `${MONTHS[+m[2] - 1]} ${m[1]}` : m[1];
}

/** A sortable "YYYY-MM" from whatever was typed; '' when no year can be found. */
export function commissionedKey(v: string | undefined): string {
  const t = (v ?? '').trim();
  const iso = /^(\d{4})(?:-(\d{2}))?/.exec(t);
  if (iso) return `${iso[1]}-${iso[2] ?? '00'}`;
  const year = /\b(\d{4})\b/.exec(t);
  if (!year) return '';
  const mon = MONTHS.findIndex(m => new RegExp(`\\b${m}`, 'i').test(t));
  return `${year[1]}-${String(mon + 1).padStart(2, '0')}`;
}

// ---- pins, usage, My Ship, sorting ----------------------------------------------------------------

export type SortKey = 'category' | 'name' | 'used' | 'recent' | 'newest';
export const SORT_LABELS: Record<SortKey, string> = {
  category: 'Category', name: 'Name A–Z', used: 'Most used', recent: 'Recently used', newest: 'Newest commissioned',
};

export interface FleetMeta {
  pinned: string[];
  usage: Record<string, number>;
  lastUsed: Record<string, number>;
  myShipId: string | null;
  sort: SortKey;
  category: string | null;
}

export const defaultMeta = (): FleetMeta => ({ pinned: [], usage: {}, lastUsed: {}, myShipId: null, sort: 'category', category: null });

const META_KEY = 'cursedpilot.fleet.v1';

/** Validates untrusted data (storage, backup files) into a usable FleetMeta. */
export function sanitizeMeta(p: any): FleetMeta {
  const d = defaultMeta();
  if (!p || typeof p !== 'object') return d;
  const numMap = (m: unknown): Record<string, number> =>
    m && typeof m === 'object' ? Object.fromEntries(Object.entries(m as Record<string, unknown>).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) as Record<string, number> : {};
  return {
    pinned: Array.isArray(p.pinned) ? [...new Set<string>(p.pinned.filter((x: unknown) => typeof x === 'string'))].slice(0, MAX_PINS) : d.pinned,
    usage: numMap(p.usage),
    lastUsed: numMap(p.lastUsed),
    myShipId: typeof p.myShipId === 'string' ? p.myShipId : null,
    sort: p.sort in SORT_LABELS ? p.sort : d.sort,
    category: typeof p.category === 'string' ? p.category : null,
  };
}

export function loadMeta(): FleetMeta {
  try { return sanitizeMeta(JSON.parse(localStorage.getItem(META_KEY) || 'null')); } catch { return defaultMeta(); }
}

export function saveMeta(m: FleetMeta): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* storage full or blocked */ }
}

export function togglePin(m: FleetMeta, id: string): { meta: FleetMeta; ok: boolean } {
  if (m.pinned.includes(id)) return { meta: { ...m, pinned: m.pinned.filter(x => x !== id) }, ok: true };
  if (m.pinned.length >= MAX_PINS) return { meta: m, ok: false };
  return { meta: { ...m, pinned: [...m.pinned, id] }, ok: true };
}

export const recordUse = (m: FleetMeta, id: string, now: number): FleetMeta =>
  ({ ...m, usage: { ...m.usage, [id]: (m.usage[id] ?? 0) + 1 }, lastUsed: { ...m.lastUsed, [id]: now } });

export const setMyShip = (m: FleetMeta, id: string | null): FleetMeta => ({ ...m, myShipId: id });

/** Drops pins and My Ship that point at ships which no longer exist. */
export function pruneMeta(m: FleetMeta, ships: Ship[]): FleetMeta {
  const ids = new Set(ships.map(s => s.id));
  const pinned = m.pinned.filter(id => ids.has(id));
  const myShipId = m.myShipId && ids.has(m.myShipId) ? m.myShipId : null;
  return pinned.length === m.pinned.length && myShipId === m.myShipId ? m : { ...m, pinned, myShipId };
}

const sortName = (s: Ship) => s.name.replace(/^INSV? /i, '');
const byName = (a: Ship, b: Ship) => sortName(a).localeCompare(sortName(b), undefined, { sensitivity: 'base' });

export interface ShipGroup { title: string; ships: Ship[] }

/**
 * What the registry shows: pinned ships first (in pin order), then the rest sorted as chosen. Search matches
 * name, pennant and class; the category filter applies to both parts.
 */
export function orderShips(ships: Ship[], meta: FleetMeta, query: string): { pinned: Ship[]; groups: ShipGroup[] } {
  const q = query.trim().toLowerCase();
  const matches = (s: Ship) =>
    (!meta.category || s.type === meta.category) &&
    (!q || [s.name, s.info?.pennant ?? '', s.info?.shipClass ?? ''].some(t => t.toLowerCase().includes(q)));
  const visible = ships.filter(matches);

  const pinned = meta.pinned.map(id => visible.find(s => s.id === id)).filter((s): s is Ship => !!s);
  const rest = visible.filter(s => !meta.pinned.includes(s.id));

  if (meta.sort === 'category') {
    const order = (c: string) => { const i = CATEGORIES.indexOf(c); return i < 0 ? CATEGORIES.length : i; };
    const cats = [...new Set(rest.map(s => s.type))].sort((a, b) => order(a) - order(b));
    return { pinned, groups: cats.map(c => ({ title: c, ships: rest.filter(s => s.type === c).sort(byName) })) };
  }
  const sorted = [...rest].sort((a, b) => {
    if (meta.sort === 'used') return (meta.usage[b.id] ?? 0) - (meta.usage[a.id] ?? 0) || byName(a, b);
    if (meta.sort === 'recent') return (meta.lastUsed[b.id] ?? 0) - (meta.lastUsed[a.id] ?? 0) || byName(a, b);
    if (meta.sort === 'newest') {
      const ka = commissionedKey(a.info?.commissioned), kb = commissionedKey(b.info?.commissioned);
      if (!ka !== !kb) return ka ? -1 : 1;                       // ships with no date go last
      return kb.localeCompare(ka) || byName(a, b);
    }
    return byName(a, b);
  });
  return { pinned, groups: sorted.length ? [{ title: '', ships: sorted }] : [] };
}
