// Station from Bows (Joining from Ahead), BR 45(6) paras 0425-0427: where to put the wheel over so that, after the turn, own ship arrives
// on station on the Guide. The sum is worked backwards on a plot with the Guide (A) at the centre, in yards (2000 yards to the n mile):
//   B  the station: its bearing and distance from the Guide
//   C  the aim point: B moved by the lateral safety margin (normally 100 yards)
//   D  C moved back by the turn's transfer: the ship gains it toward the side she turns to, so the wheel-over is that far to the other side
//   E  D laid back by the turn's advance, along the approach course
//   F  E moved for the speed correction: (approach speed - loss of speed in the turn - Guide's speed) x deceleration distance per knot.
//      Excess speed (positive) delays the wheel-over; a speed short of the Guide's (negative) advances it. Laid off along the Guide's course
//      (back for excess, forward for a shortfall, as in Examples 4-4 and 4-5).
//   G  F moved by the Guide's run during the turn, along her course: the Wheel-Over Point
// The answer is the bearing and distance of the Guide from G, and the relative bearing on which to wheel over. Pure; `node tools/stationTurn.check.ts`.

const rad = (d: number) => (d * Math.PI) / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;
export const YD_PER_NM = 2000;

export interface P { x: number; y: number }
const step = (p: P, bearing: number, yards: number): P => ({ x: p.x + yards * Math.sin(rad(bearing)), y: p.y + yards * Math.cos(rad(bearing)) });

export interface Input {
  guideCourse: number; guideSpeed: number;       // true degrees, knots
  approachCourse: number; approachSpeed: number; // own course and speed before the turn
  stationBearing: number; stationDistance: number;  // true bearing of the station from the Guide, yards
  margin: number; marginSide: 'Starboard' | 'Port';  // lateral safety margin, yards, and the Guide's side it is taken on
  advance: number; transfer: number;             // the turn, yards
  speedLoss: number; decelPerKnot: number;       // knots lost in the turn, yards per knot of deceleration
  turnSeconds: number;                           // time the turn takes
  turn?: 'Auto' | 'Port' | 'Starboard';          // which way the ship turns onto the Guide's course (Auto: the shorter way)
}

export type Variant = 'near stationing speed' | 'very high speed' | 'equal speed';

export interface Solution {
  points: { B: P; C: P; D: P; E: P; F: P; G: P };
  /** the turn made, degrees, + to starboard */
  turnAngle: number;
  /** true bearing and distance (yards) of the Guide from the Wheel-Over Point */
  guideBearing: number; guideDistance: number;
  /** the same bearing relative to the approach course: + is on the starboard (green) side */
  relativeBearing: number;
  /** distance of the approach track from the Guide's, across her course, at the wheel-over, yards */
  lateralSeparation: number;
  guideRun: number;                              // yards the Guide steams during the turn
  transferBearing: number;
  /** approach speed - loss in the turn - Guide's speed, knots, and the correction it makes in yards (+ later, - earlier) */
  excess: number; correction: number;
  variant: Variant;
}

export function solve(i: Input): Solution {
  const raw = ((i.guideCourse - i.approachCourse + 540) % 360) - 180;       // -180..180, + to starboard
  if ((i.turn ?? 'Auto') === 'Auto' && Math.abs(raw) > 179.5) {
    // a reciprocal approach: no shorter way, so turn toward the Guide (the side on which she lies at the wheel-over)
    const stbd = solve({ ...i, turn: 'Starboard' });
    return stbd.relativeBearing > 0 ? stbd : solve({ ...i, turn: 'Port' });
  }
  const turnAngle = i.turn === 'Port' ? (raw > 0 ? raw - 360 : raw) : i.turn === 'Starboard' ? (raw < 0 ? raw + 360 : raw) : raw;
  const B = step({ x: 0, y: 0 }, i.stationBearing, i.stationDistance);
  const C = step(B, i.guideCourse + (i.marginSide === 'Starboard' ? 90 : -90), i.margin);
  const transferBearing = norm(i.approachCourse + (turnAngle >= 0 ? 90 : -90));
  const D = step(C, transferBearing + 180, i.transfer);
  const E = step(D, i.approachCourse + 180, i.advance);
  const excess = i.approachSpeed - i.speedLoss - i.guideSpeed, correction = excess * i.decelPerKnot;
  const F = step(E, i.guideCourse, -correction);
  const guideRun = (i.guideSpeed * YD_PER_NM * i.turnSeconds) / 3600;
  const G = step(F, i.guideCourse, guideRun);
  const guideBearing = norm((Math.atan2(-G.x, -G.y) * 180) / Math.PI);
  const rel = ((guideBearing - i.approachCourse + 540) % 360) - 180;
  const lateral = Math.abs(G.x * Math.cos(rad(i.guideCourse)) - G.y * Math.sin(rad(i.guideCourse)));
  return {
    points: { B, C, D, E, F, G }, turnAngle, guideBearing, guideDistance: Math.hypot(G.x, G.y), relativeBearing: rel, lateralSeparation: lateral,
    guideRun, transferBearing, excess, correction, variant: Math.abs(excess) < 0.05 ? 'near stationing speed' : excess > 0 ? 'very high speed' : 'equal speed',
  };
}

// ---- the same manoeuvre on own ship's radar ----------------------------------------------------------------------------------------
// The working above keeps the Guide at the centre; on the radar own ship is at the centre and the Guide's blip moves. At the wheel-over the
// Guide lies at the bearing and distance worked out (the EBL and VRM to set). Before it, on steady courses and speeds, her blip comes in along
// the relative track: her velocity less own ship's. On station she lies on the reciprocal of the station bearing.

export interface Blip { minutes: number; x: number; y: number; trueBearing: number; relativeBearing: number; range: number }
export interface Radar {
  /** the Guide at the wheel-over: where to set the EBL (bearing) and VRM (range) */
  wheelOver: Blip;
  /** the Guide at each whole minute before the wheel-over (minutes negative), the earliest first */
  blips: Blip[];
  /** the Guide's relative track during the approach: direction (°T) and speed (knots) */
  relCourse: number; relSpeed: number;
  /** the Guide once own ship is on station (true frame, yards from own ship) */
  onStation: { x: number; y: number; trueBearing: number; range: number };
}

/** The Guide as seen from own ship (x east, y north, yards) for `minutes` whole minutes before the wheel-over. */
export function radarPicture(i: Input, s: Solution, minutes = 6): Radar {
  const vx = (i.guideSpeed * Math.sin(rad(i.guideCourse)) - i.approachSpeed * Math.sin(rad(i.approachCourse))) * YD_PER_NM / 60;   // yards a minute
  const vy = (i.guideSpeed * Math.cos(rad(i.guideCourse)) - i.approachSpeed * Math.cos(rad(i.approachCourse))) * YD_PER_NM / 60;
  const blip = (m: number): Blip => {
    const x = -s.points.G.x + vx * m, y = -s.points.G.y + vy * m;   // the Guide relative to own ship: minus own ship relative to the Guide
    const tb = norm((Math.atan2(x, y) * 180) / Math.PI);
    return { minutes: m, x, y, trueBearing: tb, relativeBearing: ((tb - i.approachCourse + 540) % 360) - 180, range: Math.hypot(x, y) };
  };
  const st = { x: -(i.stationDistance * Math.sin(rad(i.stationBearing))), y: -(i.stationDistance * Math.cos(rad(i.stationBearing))) };
  return {
    wheelOver: blip(0),
    blips: Array.from({ length: minutes }, (_, k) => blip(k - minutes)),
    relCourse: norm((Math.atan2(vx, vy) * 180) / Math.PI), relSpeed: (Math.hypot(vx, vy) * 60) / YD_PER_NM,
    onStation: { ...st, trueBearing: norm((Math.atan2(st.x, st.y) * 180) / Math.PI), range: i.stationDistance },
  };
}
