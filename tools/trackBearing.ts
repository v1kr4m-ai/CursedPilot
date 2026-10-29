// Bearing Calculator: an object on a steady course (a track) seen from a fixed point. Given its bearing and range at one point of the track, the bearing and range
// at every 5 cables or 1 nm further along (or back along) it. Pure; `node tools/trackBearing.check.ts`.

const RAD = Math.PI / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

export interface TrackInput {
  /** true bearing of the object from the observer at the known point, degrees */
  bearing: number;
  /** the object's course (its track), degrees true */
  course: number;
  /** range at the known point, nm */
  range: number;
  /** is the known point where the run starts, or where it ends */
  known: 'initial' | 'final';
  /** distance run between rows, nm */
  step: number;
  /** how many steps */
  count: number;
}
export interface TrackRow {
  /** distance run along the track from the first row, nm; for a final range the distance still to run is `togo` */
  run: number;
  /** distance run from the known point: 0 at the known point, negative before it, positive after it */
  fromKnown: number;
  bearing: number;
  range: number;
  /** this row is the known point */
  isKnown: boolean;
}
export interface TrackResult {
  rows: TrackRow[];
  /** closest approach to the observer and where along the track it falls (negative: already past it before the known point) */
  cpa: { range: number; bearing: number; fromKnown: number };
}

/** Position of the object (east, north, nm) after running `d` nm from the known point. */
const at = (t: TrackInput, d: number): [number, number] => [
  t.range * Math.sin(t.bearing * RAD) + d * Math.sin(t.course * RAD),
  t.range * Math.cos(t.bearing * RAD) + d * Math.cos(t.course * RAD),
];
const polar = ([e, n]: [number, number]) => ({ range: Math.hypot(e, n), bearing: norm360(Math.atan2(e, n) / RAD) });

/** null when the figures cannot be worked: a range, step or count that is not above zero. */
export function trackTable(t: TrackInput): TrackResult | null {
  if (![t.bearing, t.course, t.range, t.step, t.count].every(Number.isFinite) || t.range <= 0 || t.step <= 0 || t.count < 1) return null;
  const n = Math.min(Math.floor(t.count), 200);
  const rows: TrackRow[] = [];
  for (let i = 0; i <= n; i++) {
    const run = i * t.step;
    const fromKnown = t.known === 'initial' ? run : run - n * t.step;
    rows.push({ run, fromKnown, isKnown: Math.abs(fromKnown) < 1e-9, ...polar(at(t, fromKnown)) });
  }
  // the closest point is where the run along the course takes the object square to the line of sight: d = -(P . u)
  const [e, nn] = at(t, 0);
  const d = -(e * Math.sin(t.course * RAD) + nn * Math.cos(t.course * RAD));
  return { rows, cpa: { ...polar(at(t, d)), fromKnown: d } };
}
