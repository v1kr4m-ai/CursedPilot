import { useEffect, useRef } from 'react';

// Android's back button (or back swipe) steps back one layer at a time: whatever is open on top closes first (the voice assistant, NavYeo,
// a sheet or menu), then the page goes back to the one before it. App.tsx decides what happens when nothing is left (exit on a second back).

interface Layer { close: () => void; level: number }
const layers: Layer[] = [];

/** While `open`, the back button calls `close`. A higher `level` is closed first (0: a page of the app, 1: a sheet or panel, 2: a full-screen overlay). */
export function useBackLayer(open: boolean, close: () => void, level = 1): void {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open) return;
    const layer: Layer = { close: () => ref.current(), level };
    layers.push(layer);
    return () => { const i = layers.indexOf(layer); if (i >= 0) layers.splice(i, 1); };
  }, [open, level]);
}

/** Closes the top layer; false when there is none (the app is at its home page). */
export function goBack(): boolean {
  let top: Layer | undefined;
  for (const l of layers) if (!top || l.level >= top.level) top = l;   // the highest level, and of those the latest opened
  if (!top) return false;
  top.close();
  return true;
}
