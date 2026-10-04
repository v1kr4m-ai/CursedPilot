import { Ship } from '../types';
import { SideOfTurn, TurningDataPoint } from './types';

/** "01:45" -> 105 seconds; a bare number is taken as seconds. Anything else -> 0. */
const toSeconds = (t: string): number => {
  const m = /^(\d+):(\d{1,2})$/.exec(t.trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

/** Converts a vessel's recorded turning data into Fishtail table rows (blank sheet rows are skipped). */
export const shipToFishtailRows = (ship: Ship): TurningDataPoint[] =>
  ship.turningDataSets.flatMap(set =>
    set.data
      .filter(r => r.advance > 0 || r.transfer > 0)
      .map(r => ({
        id: `${ship.id}-${set.testSpeed}-${set.wheelAngle}-${set.turnSide}-${r.id}`,
        tableName: ship.name,
        heading: r.turnAmount,
        advance: r.advance,
        transfer: r.transfer,
        time: toSeconds(r.time),
        ownSpeed: set.testSpeed,
        rudder: String(set.wheelAngle),
        side: set.turnSide === 'Port' ? SideOfTurn.PORT : SideOfTurn.STARBOARD,
      }))
  );
