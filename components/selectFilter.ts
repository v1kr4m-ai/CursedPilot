// The search in SelectSearch's lists. Pure; `node components/selectFilter.check.ts`.
export interface Item { value: string; text: string; group: string; disabled: boolean }

/** Items whose text (or group) has every word typed, those with a word starting with the first typed word first. */
export function filterItems(items: Item[], query: string): Item[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  const hits = items.filter(i => words.every(w => `${i.text} ${i.group}`.toLowerCase().includes(w)));
  const starts = (i: Item) => i.text.toLowerCase().split(/[\s(/-]+/).some(t => t.startsWith(words[0]));
  return [...hits.filter(starts), ...hits.filter(i => !starts(i))];
}
