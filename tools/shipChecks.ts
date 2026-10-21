// Calibration and checks on navigation equipment, as in Handbook on Navigation (2019) chapter 8, with the speed-log formulas of
// BR 45(3) para 0427 (4.9 and 4.10). Pure; `node tools/shipChecks.check.ts`.

const deg = (r: number) => (r * 180) / Math.PI;

// ---- radar ------------------------------------------------------------------------------------------------------------------
/** Range index error: true (charted) range less radar range. Add it to a radar range to get the true range. */
export const rangeIndexError = (trueRange: number, radarRange: number) => trueRange - radarRange;
/** Two-mark method: passing between two objects, the error is half the difference between the charted distance and the two ranges added. */
export const twoMarkIndexError = (chartedBetween: number, range1: number, range2: number) => (chartedBetween - (range1 + range2)) / 2;
/** Bearing error: the reference (visual) bearing less the radar bearing, to be added to radar bearings. Gyro error must be allowed for first. */
export const radarBearingError = (referenceBearing: number, radarBearing: number) => ((referenceBearing - radarBearing + 540) % 360) - 180;

// ---- speed log ----------------------------------------------------------------------------------------------------------------
/** Ground speed over a measured distance (BR 45(3) 4.8): knots from n miles and seconds. */
export const groundSpeed = (distanceNm: number, seconds: number) => (distanceNm * 3600) / seconds;

export interface Run { ground: number; log: number }       // ground speed over the run, and the mean log (water) speed, knots
export interface LogResult {
  /** C, the percentage speed log correction: add this percentage of the log reading to get the true water speed */
  percent: number;
  /** mean speeds (knots) and the error log - ground in knots and as a percentage of the log speed (Handbook para 12) */
  meanGround: number; meanLog: number; errorKn: number; errorPercent: number;
  method: 'two-run' | 'four-run';
}

/** Two runs: C = 100 (V1 + V2) / (L1 + L2) - 1) (formula 4.9). Four runs, tide changing: weights 1, 3, 3, 1 (formula 4.10). */
export function logCorrection(runs: Run[]): LogResult | null {
  if (runs.length !== 2 && runs.length !== 4) return null;
  const w = runs.length === 2 ? [1, 1] : [1, 3, 3, 1];
  const v = runs.reduce((s, r, i) => s + w[i] * r.ground, 0), l = runs.reduce((s, r, i) => s + w[i] * r.log, 0);
  if (!(l > 0)) return null;
  const sum = w.reduce((a, b) => a + b, 0);
  const meanGround = v / sum, meanLog = l / sum;
  return { percent: 100 * (v / l - 1), meanGround, meanLog, errorKn: meanLog - meanGround, errorPercent: (100 * (meanLog - meanGround)) / meanLog, method: runs.length === 2 ? 'two-run' : 'four-run' };
}
/** True water speed from a log reading and the percentage correction. */
export const correctedSpeed = (reading: number, percent: number) => reading * (1 + percent / 100);

// ---- lubber's line --------------------------------------------------------------------------------------------------------------
/** Toe-in angle E of a repeater off the centre line by `offset`, with the Jackstaff `ahead` of it along the ship (same units). */
export const toeInAngle = (offset: number, ahead: number) => deg(Math.atan2(offset, ahead));
/** The bearing the Jackstaff should read from a wing repeater: the ship's head plus E for a port-side repeater, minus E for starboard. */
export const jackstaffReads = (head: number, e: number, side: 'Port' | 'Starboard') => (((head + (side === 'Port' ? e : -e)) % 360) + 360) % 360;

// ---- echo sounder -------------------------------------------------------------------------------------------------------------------
/** Handbook para 31: the report interval in metres of change, by depth (and in any case at least once a minute). */
export const soundingReportStep = (depth: number) => (depth < 20 ? 1 : depth <= 40 ? 5 : 10);
/** Echo sounder error against a hand lead line: lead depth less echo sounder depth, allowing for the transducer offset (both to the same datum). */
export const echoError = (leadDepth: number, echoDepth: number) => leadDepth - echoDepth;

