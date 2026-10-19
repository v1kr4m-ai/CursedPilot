// The order of the tool tiles in the NavYeo drawer and which are pinned. Pure; `node navyeo/order.check.ts` checks it.

export interface TileOrder { order: string[]; pinned: string[] }

/** Pinned tiles first (in their saved order), then the rest in the saved order; tools that are new, or not yet placed, go last in their natural order. */
export function arrange(names: string[], saved: TileOrder): string[] {
  const known = new Set(names);
  const placed = saved.order.filter(n => known.has(n));
  const rest = names.filter(n => !placed.includes(n));
  const all = [...placed, ...rest];
  const pinned = saved.pinned.filter(n => known.has(n));
  return [...all.filter(n => pinned.includes(n)), ...all.filter(n => !pinned.includes(n))];
}

/** Moves `name` to where `target` is (before it when coming from below, after it when coming from above), keeping pinned tiles in front. */
export function moveTo(current: string[], name: string, target: string, pinned: string[]): string[] {
  const from = current.indexOf(name), to = current.indexOf(target);
  if (from < 0 || to < 0 || from === to) return current;
  const next = current.filter(n => n !== name);
  next.splice(to, 0, name);
  return [...next.filter(n => pinned.includes(n)), ...next.filter(n => !pinned.includes(n))];
}

export const togglePin = (saved: TileOrder, name: string): TileOrder =>
  ({ order: saved.order, pinned: saved.pinned.includes(name) ? saved.pinned.filter(n => n !== name) : [...saved.pinned, name] });

export function parseOrder(text: string | null): TileOrder {
  try {
    const v = JSON.parse(text ?? '');
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
    return { order: list(v?.order), pinned: list(v?.pinned) };
  } catch { return { order: [], pinned: [] }; }
}
