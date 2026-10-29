// Fleet registry logic: the built-in catalogue as ships, category names, and the user's pins, usage counts,
// sort choice and "My Ship". All pure apart from load/save, so `node data/fleet.check.ts` can check it.
import type { Ship, ShipInfo } from '../types.ts';
import { CATALOG, NAVY_CATEGORIES } from './indianNavy.ts';
import type { CatalogShip } from './indianNavy.ts';
import { FOREIGN_CATALOG, NAVY_LIST } from './foreignNavies.ts';

export const CATEGORIES: readonly string[] = NAVY_CATEGORIES;
export const MAX_PINS = 5;

const LEGACY: Record<string, string> = {
  Destroyer: 'Destroyers', Frigate: 'Frigates', Corvette: 'Corvettes', Submarine: 'Submarines',
  OPVs: 'Offshore Patrol Vessels', NOPVs: 'Offshore Patrol Vessels', LSTs: 'Amphibious Ships',
  Tankers: 'Fleet Tankers', 'Research Vessels': 'Survey & Research Vessels',
};
/** Maps the category names older versions saved ("Destroyer", "NOPVs"...) onto the current list. */
export const normalizeCategory = (t: string) => (CATEGORIES.includes(t) ? t : LEGACY[t] ?? 'Other');

const displayName = (c: CatalogShip) => (c.prefix ? `${c.prefix} ${c.name}` : /^INSV /.test(c.name) ? c.name : `INS ${c.name}`);

/** Janes figures that differ from the (Wikipedia) class figures, for the Wiki / Janes flags. */
function differing(cls: CatalogShip['cls']): { janes?: Record<string, string> } {
  const j = Object.fromEntries(Object.entries(cls.janes ?? {}).filter(([k, v]) => v && v.trim() !== String((cls as unknown as Record<string, unknown>)[k] ?? '').trim())) as Record<string, string>;
  return Object.keys(j).length ? { janes: j } : {};
}

/** A fleet tanker whose rigs are not published: two stations a side, to be named and placed by the user. */
const TANKER_RIGS: { name: string; side: 'Port' | 'Starboard' }[] = [{ name: 'Port Fwd', side: 'Port' }, { name: 'Port Aft', side: 'Port' }, { name: 'Stbd Fwd', side: 'Starboard' }, { name: 'Stbd Aft', side: 'Starboard' }];
/** Rig names given by earlier versions: a list of only these, with no positions entered, is renamed. */
const OLD_RIG_NAMES = new Set(['RAS station 1', 'RAS station 2', 'RAS station 3', 'RAS station 4', 'Port 1', 'Port 2', 'Starboard 1', 'Starboard 2', 'Stern']);

export function catalogToShip(c: CatalogShip): Ship {
  const info: ShipInfo = {
    shipClass: c.cls.name, pennant: c.pennant, builder: c.builder, commissioned: c.commissioned, status: c.status,
    displacement: c.cls.displacement, length: c.cls.length, beam: c.cls.beam, draught: c.cls.draught, speed: c.cls.speed,
    propulsion: c.cls.propulsion, complement: c.cls.complement, armament: c.cls.armament, sensors: c.cls.sensors,
    aircraft: c.cls.aircraft, notes: c.notes, wiki: c.wikiCandidates.join(','),
    ...differing(c.cls),
  };
  return {
    id: c.id, name: displayName(c), type: c.cls.category,
    particulars: { lengthOverall: c.cls.loa, breadthOverall: c.cls.breadth, displacement: c.cls.tons, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0,
      ...(c.cls.rigs ?? (c.cls.category === 'Fleet Tankers' ? TANKER_RIGS : undefined) ? { rigs: (c.cls.rigs ?? TANKER_RIGS).map(r => ({ ...r, stemDistance: 0 })) } : {}) },
    turningDataSets: [], accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: [],
    info, catalog: true, ...(c.navy ? { navy: c.navy } : {}),
  };
}

/**
 * The saved fleet plus any catalogue ships it does not have yet, with old category names updated.
 * Ships already present are never overwritten, so the user's edits survive.
 */
export function mergeCatalog(stored: Ship[]): Ship[] {
  const have = new Set(stored.map(s => s.id));
  const all = [...CATALOG, ...FOREIGN_CATALOG];
  const fresh = new Map(all.filter(c => have.has(c.id)).map(c => [c.id, c]));
  const fixed = stored.map(s => {
    const typeFixed = CATEGORIES.includes(s.type) ? s : { ...s, type: normalizeCategory(s.type) };
    const c = s.catalog ? fresh.get(s.id) : undefined;
    return c ? fillBlanks(typeFixed, catalogToShip(c)) : typeFixed;
  });
  return [...fixed, ...all.filter(c => !have.has(c.id)).map(catalogToShip)];
}

/**
 * A ship saved by an earlier version may lack details the catalogue has since gained (armament, sensors, dimensions...). Empty fields are
 * filled from the catalogue; anything already there, typed or not, is kept. The same ship object is returned when nothing was missing.
 */
function fillBlanks(saved: Ship, fresh: Ship): Ship {
  const info: Record<string, unknown> = { ...(saved.info ?? {}) };
  let changed = false;
  for (const [k, v] of Object.entries(fresh.info ?? {})) {
    const have = info[k];
    const empty = have === undefined || have === null || (typeof have === 'string' && have.trim() === '');
    if (empty && v !== undefined && v !== '' ) { info[k] = v; changed = true; }
  }
  const particulars = { ...saved.particulars };
  for (const k of ['lengthOverall', 'breadthOverall', 'displacement'] as const) {
    if (!particulars[k] && fresh.particulars[k]) { particulars[k] = fresh.particulars[k]; changed = true; }
  }
  const oldNames = particulars.rigs?.length && particulars.rigs.every(r => OLD_RIG_NAMES.has(r.name) && !r.stemDistance);
  if ((!particulars.rigs?.length || oldNames) && fresh.particulars.rigs?.length) { particulars.rigs = fresh.particulars.rigs; changed = true; }
  return changed ? { ...saved, info: info as unknown as Ship['info'], particulars } : saved;
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
  /** the countries whose ships are listed in the Fleet: 'in' (India) and the ids of NAVY_LIST. One or more; the user's own ships are always listed */
  countries: string[];
}

export const defaultMeta = (): FleetMeta => ({ pinned: [], usage: {}, lastUsed: {}, myShipId: null, sort: 'category', category: null, countries: ['in'] });

const META_KEY = 'cursedpilot.fleet.v1';

export const COUNTRY_IDS: readonly string[] = ['in', ...NAVY_LIST.map(n => n.id)];

/** The chosen countries (at least one, India by default). Settings saved before India was a choice listed only the foreign navies shown beside the Indian ones. */
function sanitizeCountries(p: any): string[] {
  const clean = (a: unknown[]) => [...new Set(a.filter((x): x is string => typeof x === 'string' && COUNTRY_IDS.includes(x)))];
  const list = Array.isArray(p.countries) ? clean(p.countries) : Array.isArray(p.navies) ? clean(['in', ...p.navies]) : ['in'];
  return list.length ? list : ['in'];
}

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
    countries: sanitizeCountries(p),
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
  // the catalogue's ships are listed for the countries chosen (one or more) and, when something is typed in the search, from every country;
  // ships the user added are always listed
  const words = (id: string) => (id === 'in' ? 'india indian in' : NAVY_LIST.find(n => n.id === id)?.words ?? '');
  const matches = (s: Ship) =>
    (!meta.category || s.type === meta.category) &&
    (s.catalog !== true || meta.countries.includes(s.navy ?? 'in') || !!q) &&
    (!q || [s.name, s.info?.pennant ?? '', s.info?.shipClass ?? '', s.info?.builder ?? '', words(s.navy ?? 'in')].some(t => t.toLowerCase().includes(q)));
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
