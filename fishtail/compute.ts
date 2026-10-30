import { CalculationResult, ManeuverType, SideOfTurn, TurningDataPoint } from './types';
import { interpolateData } from './utils/interpolation';
import { calculateManeuverLocally } from './utils/maneuverEngine';

// A fishtail worked from a vessel's turning table: the turns for each kind, and the plot from the advance, transfer and time read off the
// table for each turn. Used by the Fishtail Calculator and by the round-the-clock station changes.

/** The turns of a fishtail, + to starboard: half (out and back), full (out, back twice, out), or distorted (out a1, back a1 + a2, out a2). */
export function fishtailAngles(type: ManeuverType, side: SideOfTurn, angle: number, a2 = 0): number[] {
  const s = side === SideOfTurn.STARBOARD ? 1 : -1;
  if (type === ManeuverType.HALF) return [s * angle, -s * angle];
  if (type === ManeuverType.FULL) return [s * angle, -2 * s * angle, s * angle];
  return [s * angle, -s * (angle + a2), s * a2];
}

/** The rows of one turning table (speed, wheel, side and table name, as the table key `speed|rudder|side|name` gives them). */
export const tableRows = (rows: TurningDataPoint[], key: string) => {
  const [speed, rudder, side, name] = key.split('|');
  return rows.filter(d => d.ownSpeed === parseFloat(speed) && d.rudder === rudder && d.side === side && d.tableName === name);
};
export const tableKeyOf = (d: TurningDataPoint) => `${d.ownSpeed}|${d.rudder}|${d.side}|${d.tableName}`;

/** The fishtail's plot from the table: each turn's advance, transfer and time (a distorted fishtail's middle turn is read at a1 + a2). */
export function computeFishtail(table: TurningDataPoint[], type: ManeuverType, angles: number[], guideSpeed: number, offsets?: { advance: number; transfer: number }): CalculationResult {
  const legs = angles.map((angle, idx) => {
    let lookup = angle;
    if (type === ManeuverType.DISTORTED) {
      const alpha = Math.abs(angles[0]), beta = Math.abs(angles[2]);
      lookup = idx === 1 ? alpha + beta : idx === 2 ? beta : alpha;
    }
    const r = interpolateData(lookup, table);
    return offsets ? { ...r, advance: r.advance + offsets.advance, transfer: r.transfer + offsets.transfer } : r;
  });
  return calculateManeuverLocally(angles, legs, guideSpeed);
}
