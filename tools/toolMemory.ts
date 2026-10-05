// Remembers what was last typed or chosen in the NavYeo tools, so closing the window (or the app) does not lose it.
// Plain store with subscribers; the React hook lives in NavTools.tsx. `node tools/toolMemory.check.ts` checks it.

const KEY = 'cursedpilot.navyeo.entries.v1';
export const PREF = 'pref:';

export interface Storage_ { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function createMemory(storage: Storage_ | null) {
  let data: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
  } catch { /* unreadable: start empty */ }

  const listeners = new Set<() => void>();
  const commit = (next: Record<string, unknown>) => {
    data = next;
    try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked: still remembered until the app closes */ }
    listeners.forEach(l => l());
  };

  return {
    /** The whole store; a new object after every change, so it works as a React snapshot. */
    snapshot: () => data,
    get: <T,>(key: string, fallback: T): T => (key in data ? (data[key] as T) : fallback),
    set: (key: string, value: unknown) => { if (data[key] !== value) commit({ ...data, [key]: value }); },
    /** Forgets the entries but keeps preferences (keys starting "pref:"), such as each tool's last length unit. */
    clear: () => {
      const kept = Object.fromEntries(Object.entries(data).filter(([k]) => k.startsWith(PREF)));
      if (Object.keys(kept).length !== Object.keys(data).length) commit(kept);
    },
    /** True when there are no entries to clear (preferences do not count). */
    isEmpty: () => Object.keys(data).every(k => k.startsWith(PREF)),
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

export const toolMemory = createMemory(typeof window !== 'undefined' ? window.localStorage : null);
