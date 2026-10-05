// Placement maths for the floating NavYeo icon and panel. Pure, so `node navyeo/layout.check.ts` can check it.

export const ICON = 56;          // collapsed button size, px
export const MARGIN = 8;         // minimum gap to the screen edge
export const PANEL_MAX_WIDTH = 380;
export const PANEL_MIN_HEIGHT = 160;

export interface Pos { x: number; y: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Keeps the icon fully on screen. */
export const clampPos = (p: Pos, vw: number, vh: number): Pos => ({
  x: clamp(p.x, MARGIN, vw - ICON - MARGIN),
  y: clamp(p.y, MARGIN, vh - ICON - MARGIN),
});

/** Where the icon sits before the user has moved it: bottom right, above the bottom bar. */
export const defaultPos = (vw: number, vh: number, bottomOffset = 96): Pos => clampPos({ x: vw - ICON - 16, y: vh - ICON - bottomOffset }, vw, vh);

/**
 * The expanded panel is centred on screen and never taller than the screen, so every feature is reachable
 * whatever corner the icon was parked in; the content scrolls inside it if needed.
 */
export function centredPanel(vw: number, vh: number) {
  const width = Math.min(PANEL_MAX_WIDTH, vw - 2 * MARGIN);
  return { left: (vw - width) / 2, width, maxHeight: Math.max(PANEL_MIN_HEIGHT, vh - 2 * MARGIN) };
}

/** Where, relative to the panel's top-left corner, the icon's centre is: the point the panel grows from and shrinks to. */
export const growOrigin = (icon: Pos, panelLeft: number, panelTop: number): Pos =>
  ({ x: icon.x + ICON / 2 - panelLeft, y: icon.y + ICON / 2 - panelTop });

/** Moving by (dx, dy) from `origin`, staying on screen. */
export const moved = (origin: Pos, dx: number, dy: number, vw: number, vh: number): Pos => clampPos({ x: origin.x + dx, y: origin.y + dy }, vw, vh);

/** A drag only counts once the pointer has travelled this far, so a tap is still a tap. */
export const DRAG_THRESHOLD = 6;
export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) >= DRAG_THRESHOLD;

export function parsePos(raw: string | null): Pos | null {
  try {
    const p = JSON.parse(raw ?? 'null');
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
  } catch { return null; }
}
