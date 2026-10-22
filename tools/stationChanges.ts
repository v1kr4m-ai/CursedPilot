// Station changes from BR 45(6) paras 0427 to 0429: losing distance (a 360 degree turn), reversing the order of ships in column, and the
// suggested solutions to the 'round the clock' OOW manoeuvres. Yards, knots, 2000 yards to the n mile. Pure; `node tools/stationChanges.check.ts`.

import { yardsRun } from './manoeuvres.ts';

// ---- 0428: reversing the order of ships in column -------------------------------------------------------------------------------------------
export interface ReverseInput {
  ships: number;               // ships in the column
  spacing: number;             // yards between ships
  columnSpeed: number;         // knots
  stationingSpeed: number;     // knots; the rear ship runs at one knot less
  orderedSpeed?: number;       // the others reduce to this (7 knots unless ordered)
  perKnot: number;             // gain or loss of speed correction, yards per knot
}
export interface ReverseResult {
  lengthYards: number;
  minutes: number;             // approximate time to complete the manoeuvre
  distanceNm: number;          // run by the rear ship at one knot less than stationing speed
  seaRoomNm: number;           // sea room ahead of the leader, with the 25 % margin
  seaRoomNoMarginNm: number;
}
/**
 * The rear ship runs 2 x the length of the column at the relative speed S between (stationing speed - 1) and the ordered speed, plus the
 * distance to gain speed and for the leader to lose speed, 2 x C x (gain + loss): T = 2 (L + C (gain + loss)) / S (in yards a minute).
 * Reproduces Example 4-6: 4 ships 500 yd apart at 12 kn, stationing speed 20, 33 yd/kn: 9.48 min, 3.0 nm, sea room 2.8 nm.
 */
export function reverseOrder(i: ReverseInput): ReverseResult | null {
  const ordered = i.orderedSpeed ?? 7, fast = i.stationingSpeed - 1, S = fast - ordered;
  if (!(i.ships >= 2) || !(S > 0) || !(i.spacing > 0)) return null;
  const L = (i.ships - 1) * i.spacing;
  const gain = Math.max(0, fast - i.columnSpeed), loss = Math.max(0, i.columnSpeed - ordered);
  const yardsPerMin = (S * 2000) / 60;
  const minutes = (2 * (L + i.perKnot * (gain + loss))) / yardsPerMin;
  const distanceNm = (fast * minutes) / 60, seaRoomNoMarginNm = distanceNm - L / 2000;
  return { lengthYards: L, minutes, distanceNm, seaRoomNoMarginNm, seaRoomNm: seaRoomNoMarginNm * 1.25 };
}

// ---- 0427c: losing distance by a 360 degree turn ---------------------------------------------------------------------------------------------------------
export interface Turn360Input { guideSpeed: number; turnSeconds: number; speedLoss: number; perKnot: number }
/**
 * A first approximation (the book says such figures need refining in practice): the Guide steams on while the ship goes round, and the
 * speed lost in the turn costs the acceleration distance to recover.
 */
export const distanceLost360 = (i: Turn360Input): number => yardsRun(i.guideSpeed, i.turnSeconds) + i.speedLoss * i.perKnot;

// ---- 0429: round the clock ---------------------------------------------------------------------------------------------------------------------------------------
export const STATIONS = ['Ahead', 'Bow (45)', 'Abeam', 'Quarter', 'Astern'] as const;
export type Station = (typeof STATIONS)[number];
export interface Solution { speed: 'Equal speed' | 'Stationing speed'; text: string[]; warning?: boolean; para: string }

const ahead_astern: Solution = { speed: 'Equal speed', para: '0429a', text: ['Make a 90 degree fishtail manoeuvre: turn 90 degrees away from the Guide, then back 180, then 90 to resume the Guide\'s course. It can be made to port or starboard.'] };
const SOLUTIONS: Partial<Record<`${Station}>${Station}`, Solution>> = {
  'Ahead>Astern': ahead_astern,
  'Ahead>Abeam': { speed: 'Equal speed', para: '0429b', text: ['Turn out about 60 to 75 degrees, steady and immediately turn back to the Guide\'s course.'] },
  'Bow (45)>Abeam': { speed: 'Equal speed', para: '0429c', text: ['Turn 50 degrees away from the Guide, steady and immediately alter 40 degrees back, before resuming the original course. This is an unbalanced fishtail.'] },
  'Bow (45)>Quarter': { speed: 'Equal speed', para: '0429d', text: ['Make a 75 degree fishtail manoeuvre.'] },
  'Abeam>Astern': { speed: 'Equal speed', para: '0429e', warning: true, text: [
    'Method 1: alter course toward the Guide and steady pointing at her stern, then alter back to the original course to follow in her wake.',
    'Method 2: alter course 90 degrees toward the Guide and then immediately alter back to the original course.',
    'It may be safer for the ship altering to reduce speed momentarily after execution, particularly a large ship.'] },
  'Astern>Abeam': { speed: 'Stationing speed', para: '0429f', text: [
    'Increase to stationing speed and steer about 15 to 20 degrees out (the angle depends on the difference between the Guide\'s speed and stationing speed: about 2 degrees for each knot of relative speed).',
    'Use the deceleration distances and the radian rule to decide when to reduce speed; about 25 degrees is not unusual.'] },
  'Astern>Quarter': { speed: 'Stationing speed', para: '0429f note 2', text: ['As astern to abeam, but allow about 4 degrees for each knot of relative speed.'] },
  'Abeam>Ahead': { speed: 'Stationing speed', para: '0429g', text: ['Increase to stationing speed and steer about 15 degrees in.', 'Use the deceleration distances to decide when to reduce speed.'] },
};
const abeamToAbeam: Solution = { speed: 'Stationing speed', para: '0429h', warning: true, text: [
  'Do it in two parts. First alter course toward the Guide and point at her stern, increasing to stationing speed as soon as it is safe to do so; adjust course to pass close under her stern.',
  'When clear of her stern, alter toward the new station (heading about 30 degrees off the Guide\'s course). Use the deceleration distances and the radian rule to decide when to reduce speed.',
  'It may be safer for the ship altering to reduce speed momentarily after execution, particularly a large ship.'] };

/** The book's suggested solution for changing between two of the standard stations, or null when para 0429 does not cover that pair. */
export function roundTheClock(from: Station, to: Station, abeamSides: 'same' | 'opposite' = 'opposite'): Solution | null {
  if (from === 'Abeam' && to === 'Abeam') return abeamSides === 'opposite' ? abeamToAbeam : null;
  return SOLUTIONS[`${from}>${to}`] ?? null;
}
/** The angle to steer out for an astern to abeam (2 degrees a knot) or astern to quarter (4 degrees a knot) change at stationing speed. */
export const angleOut = (guideSpeed: number, stationingSpeed: number, degreesPerKnot = 2) => (stationingSpeed - guideSpeed) * degreesPerKnot;
