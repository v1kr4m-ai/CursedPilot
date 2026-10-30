import React, { useEffect, useRef, useState } from 'react';
import { useMemory } from './kit';
import { arrange, moveTo } from '../navyeo/order';

// The tabs of a tool with several parts. Tap a tab to open it; press and hold one, then slide it along to put it somewhere else. The order is
// remembered for each tool (until NavYeo's clear-all), like the tool tiles (navyeo/order.ts).

const HOLD_MS = 450;

export function TabBar<K extends string>({ id, tabs, labels, value, onChange, label }: {
  id: string; tabs: readonly K[]; labels: Record<K, string>; value: string; onChange: (k: K) => void; label: string;
}) {
  const [saved, setSaved] = useMemory<string[]>(`${id}:order`, []);
  const order = arrange([...tabs], { order: saved, pinned: [] }) as K[];
  const [dragging, setDragging] = useState<K | null>(null);
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; moved: boolean; x: number; y: number }>({ moved: false, x: 0, y: 0 });
  const bar = useRef<HTMLDivElement>(null);

  // while a tab is being moved the bar must not scroll under the finger
  useEffect(() => {
    const el = bar.current;
    if (!el || !dragging) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, [dragging]);

  const end = () => { if (hold.current.timer) clearTimeout(hold.current.timer); hold.current.timer = undefined; setDragging(null); };
  return (
    <div ref={bar} className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label={label}
      onPointerMove={e => {
        if (!dragging) {   // a finger that slides before the hold is a scroll, not a move
          if (hold.current.timer && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 8) { clearTimeout(hold.current.timer); hold.current.timer = undefined; }
          return;
        }
        const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-tab]')?.getAttribute('data-tab') as K | null;
        if (over && over !== dragging) setSaved(moveTo(order, dragging, over, []));
      }}
      onPointerUp={end} onPointerCancel={end} onPointerLeave={() => { if (dragging) end(); }}>
      {order.map(k => (
        <button key={k} data-tab={k} role="tab" aria-selected={value === k}
          onPointerDown={e => {
            hold.current.moved = false; hold.current.x = e.clientX; hold.current.y = e.clientY;
            const target = e.currentTarget;
            hold.current.timer = setTimeout(() => { hold.current.moved = true; setDragging(k); try { target.releasePointerCapture(e.pointerId); } catch { /* not captured */ } navigator.vibrate?.(15); }, HOLD_MS);
          }}
          onClick={() => { if (!hold.current.moved) onChange(k); hold.current.moved = false; }}
          onContextMenu={e => e.preventDefault()}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border select-none transition-transform ${dragging === k ? 'scale-110 shadow-lg ring-2 ring-blue-300' : ''} ${value === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>{labels[k]}</button>
      ))}
    </div>
  );
}
