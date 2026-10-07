// Man overboard turns worked from the ship's own turning data. Pure; `node tools/manOverboard.check.ts` checks it.
// Frame: the man falls overboard at the origin while the ship is on course 000 (up); x is to starboard, y is ahead, in yards.
// Each turn leg moves the ship by the table's advance (along her head) and transfer (to the side she turns to), then
// her head changes by the turn. The same simplification as the Fishtail calculator; the man is taken as not drifting.

export type Side = 'Port' | 'Starboard';
export type RescueTurn = 'williamson' | 'scharnow';
export interface Leg { advance: number; transfer: number; time: number }   // yards, yards, seconds
export type Lookup = (turnDegrees: number) => Leg;

export const TURNS: Record<RescueTurn, { name: string; short: string; how: (side: Side) => string }> = {
  williamson: {
    name: 'Williamson turn', short: 'Williamson',
    how: s => `Wheel hard ${s.toLowerCase()}. At 060° off the original course (${rel(60, s)}) wheel hard to the other side, and steady on the reciprocal. Ease the wheel about 20° before it.`,
  },
  scharnow: {
    name: 'Scharnow turn', short: 'Scharnow',
    how: s => `Wheel hard ${s.toLowerCase()}. At 240° off the original course (${rel(240, s)}) wheel hard to the other side, and steady on the reciprocal.`,
  },
};

const rel = (deg: number, side: Side) => `${String(deg).padStart(3, '0')}${side === 'Starboard' ? ' to starboard' : ' to port'}`;

/** Signed turns (starboard +) for the manoeuvre, given the side the man fell. */
export function turnsFor(kind: RescueTurn, side: Side): number[] {
  const t = kind === 'williamson' ? [60, -240] : [240, -60];
  return side === 'Starboard' ? t : t.map(a => -a);
}

export interface Outcome {
  x: number; y: number;           // where the ship ends, relative to the man (yards)
  headingEnd: number;             // ship's head at the end (000-360)
  seconds: number;                // time to complete the turn
  distance: number;               // straight-line distance from the man, yards
  /** the man's bearing relative to the ship's head at the end, 0-360 clockwise */
  manRelativeBearing: number;
  /** ship's offset from the original track, yards, + to starboard of the original course */
  lateral: number;
  /** distance still to run before being abeam of the man along the reciprocal, yards (negative = already past him) */
  toRun: number;
}

export function rescue(kind: RescueTurn, side: Side, lookup: Lookup): Outcome {
  let x = 0, y = 0, head = 0, seconds = 0;
  for (const turn of turnsFor(kind, side)) {
    const leg = lookup(Math.abs(turn));
    const h = (head * Math.PI) / 180, s = turn >= 0 ? 1 : -1, t = ((head + s * 90) * Math.PI) / 180;
    x += leg.advance * Math.sin(h) + leg.transfer * Math.sin(t);
    y += leg.advance * Math.cos(h) + leg.transfer * Math.cos(t);
    head = (((head + turn) % 360) + 360) % 360;
    seconds += leg.time;
  }
  const toMan = ((Math.atan2(-x, -y) * 180) / Math.PI + 360) % 360;       // true bearing from ship to man, original course = 000
  return {
    x, y, headingEnd: head, seconds, distance: Math.hypot(x, y),
    manRelativeBearing: (toMan - head + 360) % 360, lateral: x,
    toRun: y,   // on the reciprocal (head 180) the ship goes down the y axis, so y yards remain to the man's abeam
  };
}
