import { useMemory } from './kit';
import { PREF } from './toolMemory';
import type { NavTool } from './NavTools';

// The names the user gives the tools: shown on the tiles, the home bar and the tool's header instead of the app's own. Kept as a preference, so
// NavYeo's clear-all keeps them; the app still knows each tool by its own name (NavYeo's commands, the saved home bar, the explanations).

export function useToolNames() {
  const [names, setNames] = useMemory<Record<string, string>>(`${PREF}toolnames`, {});
  return {
    /** the name in the tool's header */
    title: (t: NavTool) => names[t.name] ?? t.title ?? t.name,
    /** the label under the tile and on the home bar */
    short: (t: NavTool) => names[t.name] ?? t.short,
    /** asks for a new name; an empty one goes back to the app's own */
    rename: (t: NavTool) => {
      const v = window.prompt(`Name for "${t.title ?? t.name}" (leave empty for the original)`, names[t.name] ?? t.short);
      if (v === null) return;
      const next = { ...names };
      if (v.trim()) next[t.name] = v.trim().slice(0, 40); else delete next[t.name];
      setNames(next);
    },
  };
}
