// The ship's recorded turning data for a given turn: advance, transfer, the time the turn takes and the speed lost in it, for the approach speed,
// the wheel and the amount of turn. Between two recorded speeds the figures are interpolated; between two recorded amounts of turn too.
// Pure; `node tools/turnLookup.check.ts`.

import type { Ship, TurningDataSet } from '../types.ts';

export interface TurnPick {
  speed: number;                 // the recorded speed used (or the nearer of two when interpolating)
  speedFrom: number; speedTo: number;   // the recorded speeds bracketing the approach speed (equal when one set is used)
  wheels: number[];              // wheel angles recorded on this side at the speed
  wheel: number;                 // the wheel used
  advance: number; transfer: number;   // yards
  seconds: number;               // the time the turn takes
  loss?: number;                 // knots lost in the turn, when the speed after the turn is recorded
  interpolatedSpeed: boolean;    // the approach speed lies between two recorded speeds
  outsideTurn: boolean;          // the turn is more than the largest amount recorded
}

const toSeconds = (t: string | number): number => {
  if (typeof t === 'number') return t;
  const m = /^(\d+):(\d{1,2})$/.exec(t.trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};
const speedAfter = (v: number | string): number | undefined => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) && n > 0 ? n : undefined; };

interface Row { turn: number; advance: number; transfer: number; seconds: number; lost?: number }
const rowsOf = (set: TurningDataSet): Row[] => set.data.filter(r => r.advance > 0 || r.transfer > 0).map(r => {
  const after = speedAfter(r.speed);
  return { turn: r.turnAmount, advance: r.advance, transfer: r.transfer, seconds: toSeconds(r.time), lost: after !== undefined && after <= set.testSpeed ? set.testSpeed - after : undefined };
}).sort((a, b) => a.turn - b.turn);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Interpolate the rows at an amount of turn; the nearest end is used outside the recorded range. */
function atTurn(rows: Row[], turn: number): Row & { outside: boolean } {
  const first = rows[0], last = rows[rows.length - 1];
  if (turn <= first.turn) return { ...first, outside: false };
  if (turn >= last.turn) return { ...last, outside: turn > last.turn };
  const i = rows.findIndex(r => r.turn >= turn), a = rows[i - 1], b = rows[i], t = (turn - a.turn) / (b.turn - a.turn);
  return { turn, advance: lerp(a.advance, b.advance, t), transfer: lerp(a.transfer, b.transfer, t), seconds: lerp(a.seconds, b.seconds, t), lost: a.lost !== undefined && b.lost !== undefined ? lerp(a.lost, b.lost, t) : undefined, outside: false };
}

/** The set at a speed on a side, with the wheel asked for or the nearest recorded (the largest when none is asked for). */
function setAt(sets: TurningDataSet[], speed: number, wheel?: number): TurningDataSet | undefined {
  const here = sets.filter(s => s.testSpeed === speed);
  if (!here.length) return undefined;
  if (wheel === undefined) return here.reduce((a, b) => (b.wheelAngle > a.wheelAngle ? b : a));
  return here.reduce((a, b) => (Math.abs(b.wheelAngle - wheel) < Math.abs(a.wheelAngle - wheel) ? b : a));
}

export function lookupTurn(ship: Pick<Ship, 'turningDataSets'> | undefined, side: 'Port' | 'Starboard', approachSpeed: number, turnDegrees: number, wheel?: number): TurnPick | null {
  const sets = (ship?.turningDataSets ?? []).filter(s => s.turnSide === side && rowsOf(s).length > 0);
  if (!sets.length || !(approachSpeed > 0)) return null;
  const speeds = [...new Set(sets.map(s => s.testSpeed))].sort((a, b) => a - b);
  const lo = [...speeds].reverse().find(s => s <= approachSpeed) ?? speeds[0], hi = speeds.find(s => s >= approachSpeed) ?? speeds[speeds.length - 1];
  const turn = Math.abs(turnDegrees);
  const pickAt = (sp: number) => { const set = setAt(sets, sp, wheel)!; return { set, r: atTurn(rowsOf(set), turn) }; };
  const a = pickAt(lo), b = pickAt(hi), t = hi === lo ? 0 : (approachSpeed - lo) / (hi - lo);
  const nearer = t < 0.5 ? a : b;
  const wheels = [...new Set(sets.filter(s => s.testSpeed === nearer.set.testSpeed).map(s => s.wheelAngle))].sort((x, y) => x - y);
  return {
    speed: nearer.set.testSpeed, speedFrom: lo, speedTo: hi, wheels, wheel: nearer.set.wheelAngle,
    advance: lerp(a.r.advance, b.r.advance, t), transfer: lerp(a.r.transfer, b.r.transfer, t), seconds: lerp(a.r.seconds, b.r.seconds, t),
    loss: a.r.lost !== undefined && b.r.lost !== undefined ? lerp(a.r.lost, b.r.lost, t) : (nearer.r.lost),
    interpolatedSpeed: hi !== lo && approachSpeed !== lo && approachSpeed !== hi, outsideTurn: a.r.outside || b.r.outside,
  };
}
