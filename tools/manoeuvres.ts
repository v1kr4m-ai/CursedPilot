// Mathematics of Manoeuvres (Navigation Direction School): altering course by Corpen, regaining track by the radian rule, and coming
// alongside for RAS. Lengths in yards (200 yards a cable, 2000 yards a n mile), speeds in knots, as in the school's notes.
// Radian rule: L = R x angle / 60 (angle in degrees). Pure; `node tools/manoeuvres.ts` is checked by manoeuvres.check.ts.

const deg = (r: number) => (r * 180) / Math.PI;
export const YD_PER_NM = 2000;
export const YD_PER_CABLE = 200;
/** Yards a ship steams in `seconds` at `knots`. */
export const yardsRun = (knots: number, seconds: number) => (knots * YD_PER_NM * seconds) / 3600;

// ---- Corpen ------------------------------------------------------------------------------------------------------------------
/** Stopwatch method: the ship stationed `distance` yards astern of the Guide alters when the Guide's wheel-over point is reached, after distance / speed. */
export const stopwatchSeconds = (distance: number, knots: number) => (distance / (knots * YD_PER_NM)) * 3600;

/** `angle` is the amount of the turn in degrees (90 when not given); advance and transfer are the ship's figures for that turn. */
export interface ColumnInput { knots: number; distance: number; advance: number; transfer: number; turnSeconds: number; regainSeconds?: number; angle?: number }
export interface TurnPoint {
  /** yards the Guide steams while own ship turns and regains the speed she lost (A'A) */
  guideRun: number;
  /** the leg of the triangle along the new course, and the one across it, yards */
  along: number; across: number;
  /** angle in degrees: exact (tangent) and by the radian rule; alter when the Guide bears (90 - angle) off the bow on the side turned toward */
  exact: number; radian: number;
  /** where the Guide bears from own ship's head, in degrees toward the side turned to, at the moment own ship should put her wheel over */
  bearing: number;
  /** how far short of the Guide's wheel-over point own ship turns, along the old course, yards (negative: after it) */
  early: number;
}
/**
 * Own ship stationed astern: she turns early so that, after her turn, she is the stationed distance astern on the Guide's new track.
 * For a 90 degree turn tan(angle) = Adv / (T + (D - A'A)), the school's form. For a turn of theta the same picture gives, with the Guide's
 * wheel-over point as the origin, the old course along y and the new course at theta from it: own ship starts her turn q = Adv - T / tan(theta) short of
 * the point, and the Guide is then g = D - A'A + T / sin(theta) along the new track. (theta = 90 gives q = Adv and g = T + D - A'A.)
 */
export function columnTurn(i: ColumnInput): TurnPoint | null {
  const theta = i.angle ?? 90, th = (theta * Math.PI) / 180;
  if (!(theta > 0 && theta < 180)) return null;
  const guideRun = yardsRun(i.knots, i.turnSeconds + (i.regainSeconds ?? 0));
  const along = i.transfer / Math.sin(th) + (i.distance - guideRun);
  const across = i.advance - i.transfer / Math.tan(th);
  if (!(along > 0) || !(i.advance >= 0)) return null;
  return {
    guideRun, along, across, exact: deg(Math.atan2(across, along)), radian: (60 * across) / along,
    bearing: deg(Math.atan2(along * Math.sin(th), along * Math.cos(th) + across)), early: across,
  };
}

export interface AbreastInput { knots: number; range: number; transfer: number; turnSeconds: number; lossYards?: number }
export interface AbreastTurn { guideRun: number; netAhead: number; exact: number; radian: number }
/** Corpen 'S': ships abreast at `range`. The Guide turns at once and the other ship continues ahead, so the Guide draws ahead of her by
 *  (the Guide's run in the turn) - (own transfer) + (distance lost). She turns that far early: the angle is net / range by the radian rule. */
export function abreastTurn(i: AbreastInput): AbreastTurn | null {
  const guideRun = yardsRun(i.knots, i.turnSeconds), netAhead = guideRun - i.transfer + (i.lossYards ?? 0);
  if (!(i.range > 0)) return null;
  return { guideRun, netAhead, exact: deg(Math.atan2(netAhead, i.range)), radian: (60 * netAhead) / i.range };
}

// ---- regaining track ------------------------------------------------------------------------------------------------------------
/** Distance to run along the track to regain it: off-track x 60 / throw-off angle. */
export const distanceToRegain = (offTrack: number, throwOff: number) => (offTrack * 60) / throwOff;
/** Throw-off needed to regain the track after running `distance`. */
export const throwOffToRegain = (offTrack: number, distance: number) => (offTrack * 60) / distance;
/** Allowance for a stream across the track: sin(angle) = stream / own speed. */
export const streamAllowance = (stream: number, knots: number) => (stream < knots ? deg(Math.asin(stream / knots)) : null);

// ---- RAS: coming alongside -----------------------------------------------------------------------------------------------------
/** Lateral separation in feet from range in cables and angle in degrees: L = R x angle x 10. */
export const lateralFeet = (rangeCables: number, angle: number) => rangeCables * angle * 10;
/** Angle at a range for a wanted lateral separation. */
export const angleForSeparation = (feet: number, rangeCables: number) => feet / (rangeCables * 10);
/** The surge: yards the receiving ship gains on the supplier while she slows from `fast` to `slow` in `seconds` (the average speed is run). */
export const surgeYards = (fast: number, slow: number, supplier: number, seconds: number) => yardsRun((fast + slow) / 2, seconds) - yardsRun(supplier, seconds);
