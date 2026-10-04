import { Ship } from '../types';
import { SideOfTurn, TurningDataPoint } from './types';

// The Fishtail module keeps its turning tables under this localStorage key.
const FISHTAIL_DB_KEY = 'fishtail_db';

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

/** Replaces any rows previously synced for this vessel in the Fishtail library. Returns the row count written. */
export const syncShipToFishtail = (ship: Ship): number => {
  let existing: TurningDataPoint[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FISHTAIL_DB_KEY) || '[]');
    if (Array.isArray(parsed)) existing = parsed;
  } catch { /* unreadable library: start it fresh */ }
  const rows = shipToFishtailRows(ship);
  try {
    localStorage.setItem(FISHTAIL_DB_KEY, JSON.stringify([...existing.filter(p => p.tableName !== ship.name), ...rows]));
  } catch { /* storage full or blocked: the calculator just opens with what it has */ }
  return rows.length;
};
