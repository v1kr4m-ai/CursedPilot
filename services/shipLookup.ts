// Picture and short description for a ship from Wikipedia's public summary API (text CC BY-SA). Looked up only when
// a ship is opened and the device is online, then kept in localStorage so it still shows offline.
import type { Ship } from '../types.ts';

export interface ShipWiki {
  title: string;
  extract: string;
  /** a data: URL once downloaded, else the remote URL */
  image?: string;
  /** the article the picture came from, when that is not the article the description came from */
  imageTitle?: string;
  page?: string;
  fetchedAt: number;
}

const CACHE_KEY = 'cursedpilot.wiki.v1';
const MAX_CACHED = 30;                       // pictures are the bulk of this; keep well inside the localStorage quota
const STALE_AFTER_MS = 30 * 24 * 3600 * 1000;

function readCache(): Record<string, ShipWiki> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { return {}; }
}

function writeCache(cache: Record<string, ShipWiki>): void {
  const entries = Object.entries(cache).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt);
  let keep = entries.slice(0, MAX_CACHED);
  for (;;) {                                  // drop the oldest until it fits
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep))); return; }
    catch { if (keep.length <= 1) return; keep = keep.slice(0, -1); }
  }
}

export const getCachedWiki = (shipId: string): ShipWiki | null => readCache()[shipId] ?? null;
export const isStale = (w: ShipWiki | null) => !w || Date.now() - w.fetchedAt > STALE_AFTER_MS;

/** First sentences of the extract, up to about `max` characters, ending on a full stop where possible. */
export function shorten(text: string, max = 380): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('. '));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

/** Article titles to try, most specific first. */
export const wikiCandidates = (ship: Ship): string[] => {
  const given = (ship.info?.wiki ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return given.length ? given : [`INS_${ship.name.replace(/^INSV? /i, '').replace(/ /g, '_')}`];
};

// "Two ships operated by the Indian Navy have had the name INS Vikrant" and similar list pages describe no single ship
const INDEX_PAGE = /\b(?:two|three|four|five|six|several|many)\s+(?:\w+\s+){0,4}(?:ships|vessels|submarines|boats)\b[^.]*\b(?:name|named)\b|may refer to|have (?:borne|had|been given) the name|set index/i;

/** Accepts only Indian Navy articles about one ship or class, so a shared name or a list page cannot slip in. */
export const isIndianNavyArticle = (j: { type?: string; extract?: string; description?: string }) =>
  j.type !== 'disambiguation' && !INDEX_PAGE.test(j.extract ?? '') && /\b(Indian|India)\b/.test(`${j.description ?? ''} ${j.extract ?? ''}`);

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  if (blob.size > 400_000) return url;        // too big to keep: use the remote link
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Fetches (and caches) the Wikipedia summary for a ship: the first suitable article gives the description, and if it
 * has no picture the next suitable article that has one (usually the class page) supplies it. Resolves to null when
 * offline or nothing suitable is found.
 */
export async function lookupShip(ship: Ship): Promise<ShipWiki | null> {
  let best: { title: string; extract: string; page?: string; imageUrl?: string; imageTitle?: string } | null = null;
  for (const title of wikiCandidates(ship)) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { Accept: 'application/json' } });
      if (res.status === 429) break;          // rate limited: use what we have rather than hammering the service
      if (!res.ok) continue;
      const j = await res.json();
      if (!isIndianNavyArticle(j) || !j.extract) continue;
      const thumb: string | undefined = j.thumbnail?.source;
      if (!best) best = { title: j.title, extract: shorten(j.extract), page: j.content_urls?.desktop?.page, imageUrl: thumb, imageTitle: thumb ? j.title : undefined };
      else if (!best.imageUrl && thumb) { best.imageUrl = thumb; best.imageTitle = j.title; }
      if (best.imageUrl) break;
    } catch {
      break;                                  // network failure: stop trying, the caller keeps whatever is cached
    }
  }
  if (!best) return null;
  let image = best.imageUrl;
  if (image) { try { image = await toDataUrl(image); } catch { /* keep the remote URL */ } }
  const wiki: ShipWiki = { title: best.title, extract: best.extract, image, imageTitle: best.imageTitle, page: best.page, fetchedAt: Date.now() };
  writeCache({ ...readCache(), [ship.id]: wiki });
  return wiki;
}
