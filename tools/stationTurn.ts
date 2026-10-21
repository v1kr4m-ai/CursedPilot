// Station Turn: where to put the wheel over so that, after the turn, own ship arrives on station on the Guide. The sum is worked
// backwards on a plot with the Guide (A) at the centre, in yards (2000 yards to the n mile, 200 to the cable, as in pilotage work):
//   B  the station: its bearing and distance from the Guide
//   C  the aim point: B moved by the lateral safety margin, on the Guide's starboard or port side
//   D  C moved by the turn's transfer, on the side the ship turns away from her approach course
//   E  D laid back by the turn's advance, along the approach course
//   F  E moved by the loss of speed (deceleration distance x knots lost), back along the Guide's course
//   G  F moved by the Guide's run during the turn, along the Guide's course: the Wheel-Over Point
// The answer is the bearing and distance of the Guide from G. Pure; `node tools/stationTurn.check.ts`.

const rad = (d: number) => (d * Math.PI) / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;
export const YD_PER_NM = 2000;

export interface P { x: number; y: number }
const step = (p: P, bearing: number, yards: number): P => ({ x: p.x + yards * Math.sin(rad(bearing)), y: p.y + yards * Math.cos(rad(bearing)) });

export interface Input {
  guideCourse: number; guideSpeed: number;       // true degrees, knots
  approachCourse: number;                        // own course before the turn
  stationBearing: number; stationDistance: number;  // true bearing of the station from the Guide, yards
  margin: number; marginSide: 'Starboard' | 'Port';  // lateral safety margin, yards, and the Guide's side it is taken on
  advance: number; transfer: number;             // the turn, yards
  speedLoss: number; decelPerKnot: number;       // knots lost in the turn, yards per knot
  turnSeconds: number;                           // time the turn takes
  turn?: 'Auto' | 'Port' | 'Starboard';          // which way the ship turns onto the Guide's course (Auto: the shorter way)
}

export interface Solution {
  points: { B: P; C: P; D: P; E: P; F: P; G: P };
  /** the turn made, degrees, + to starboard */
  turnAngle: number;
  /** true bearing and distance (yards) of the Guide from the Wheel-Over Point */
  guideBearing: number; guideDistance: number;
  guideRun: number;                              // yards the Guide steams during the turn
  transferBearing: number;
}

export function solve(i: Input): Solution {
  const raw = ((i.guideCourse - i.approachCourse + 540) % 360) - 180;       // -180..180, + to starboard
  const turnAngle = i.turn === 'Port' ? (raw > 0 ? raw - 360 : raw) : i.turn === 'Starboard' ? (raw < 0 ? raw + 360 : raw) : raw;
  const B = step({ x: 0, y: 0 }, i.stationBearing, i.stationDistance);
  const C = step(B, i.guideCourse + (i.marginSide === 'Starboard' ? 90 : -90), i.margin);
  const transferBearing = norm(i.approachCourse + (turnAngle >= 0 ? 90 : -90));
  const D = step(C, transferBearing, i.transfer);
  const E = step(D, i.approachCourse + 180, i.advance);
  const F = step(E, i.guideCourse, -(i.speedLoss * i.decelPerKnot));
  const guideRun = (i.guideSpeed * YD_PER_NM * i.turnSeconds) / 3600;
  const G = step(F, i.guideCourse, guideRun);
  return { points: { B, C, D, E, F, G }, turnAngle, guideBearing: norm((Math.atan2(-G.x, -G.y) * 180) / Math.PI), guideDistance: Math.hypot(G.x, G.y), guideRun, transferBearing };
}
