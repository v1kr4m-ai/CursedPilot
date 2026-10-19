// Range from a sextant angle and the horizon formulas, as in BR 45(1)(1) para 0803 and Appendix 6, with the coefficients
// other books use. Distances in nautical miles unless the name says otherwise. Pure; `node tools/rangeFormulas.check.ts`.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const M_PER_NM = 1852;

/** The angle in degrees from the observed angle and the index error (minutes, + added, - taken off). */
export const correctedAngle = (observedDeg: number, indexErrorMin: number) => observedDeg + indexErrorMin / 60;

/** Dip of the sea horizon in minutes of arc for a height of eye in metres (Nautical Almanac: 1.76 sqrt(h)). */
export const dipMinutes = (heightOfEyeM: number) => 1.758 * Math.sqrt(Math.max(0, heightOfEyeM));

/** 8.1: distance = visible height of object x cot (angle). */
export const distanceByHeight = (heightM: number, angleDeg: number) => (angleDeg > 0 ? heightM / Math.tan(rad(angleDeg)) / M_PER_NM : NaN);

/**
 * The charted elevation is above MHWS (or MHHW), so it is corrected for the height of tide: with the tide `belowMhwsM`
 * metres below that level the object stands that much higher out of the water (para 0803h, Example 8-1).
 */
export const correctedElevation = (elevationM: number, belowMhwsM: number) => elevationM + belowMhwsM;

/** 8.1a: distance = width x 360 / (2 pi x angle in degrees), the width and the angle subtended. */
export const distanceByWidth = (widthM: number, angleDeg: number) => (angleDeg > 0 ? (widthM * 360) / (2 * Math.PI * angleDeg) / M_PER_NM : NaN);

export interface BeyondHorizon {
  distanceNm: number;
  /** the apparent altitude after dip, and the true altitude after terrestrial refraction, degrees */
  apparentDeg: number; trueDeg: number;
  refractionMin: number;
  iterations: number;
}

/**
 * Appendix 6 para 2b, formula A6.1: an object whose base is beyond the observer's horizon.
 * cos (d + t) = (R + h) / (R + H) x cos t, with R = 3437.75 nm, h the height of eye, H the height of the object, d the arc
 * of the Earth between them and t the true altitude. The terrestrial refraction is taken as 8% of the distance in nautical
 * miles, expressed in minutes of arc, so the distance is found by repeating from a first estimate.
 */
export function distanceBeyondHorizon(summitM: number, heightOfEyeM: number, observedDeg: number, indexErrorMin: number, firstGuessNm = 25): BeyondHorizon | null {
  const R = 3437.75, H = summitM / M_PER_NM, h = heightOfEyeM / M_PER_NM;
  if (!(H > h) || !(observedDeg > 0)) return null;
  const apparent = correctedAngle(observedDeg, indexErrorMin) - dipMinutes(heightOfEyeM) / 60;
  let d = firstGuessNm, t = apparent, r = 0;
  let n = 0;
  for (; n < 20; n++) {
    r = 0.08 * d;                                              // minutes of arc
    t = apparent - r / 60;
    const c = ((R + h) / (R + H)) * Math.cos(rad(t));
    if (c > 1 || c < -1) return null;
    const next = (deg(Math.acos(c)) - t) * 60;                 // degrees of arc at the Earth's centre = 60 nm per degree
    if (!(next > 0)) return null;
    if (Math.abs(next - d) < 1e-6) { d = next; break; }
    d = next;
  }
  return { distanceNm: d, apparentDeg: apparent, trueDeg: t, refractionMin: r, iterations: n };
}

/**
 * 8.3a/8.3b: the horizon method, for an object with no height known (its waterline against the sea horizon).
 * theta (minutes) = 1.8563 h / d + 0.42 d, h in metres, d in nautical miles, where theta is the angle below the horizontal:
 * the observed angle corrected for index error, plus the dip. Solved for d (the quadratic 0.42 d^2 - theta d + 1.8563 h = 0): the object lies inside the horizon, so the
 * smaller root is taken. Null if the angle is too small for any distance.
 */
export function distanceByHorizon(heightOfEyeM: number, observedDeg: number, indexErrorMin: number): { distanceNm: number; thetaMin: number } | null {
  // the object's waterline is below the sea horizon by the observed angle, so it is that far plus the dip below the observer's horizontal (Example 8-3: 13'.3 + 6'.8 = 20'.1)
  const theta = (correctedAngle(observedDeg, indexErrorMin) + dipMinutes(heightOfEyeM) / 60) * 60;
  if (!(theta > 0) || !(heightOfEyeM > 0)) return null;
  const disc = theta * theta - 4 * 0.42 * 1.8563 * heightOfEyeM;
  if (disc < 0) return null;
  return { distanceNm: (theta - Math.sqrt(disc)) / (2 * 0.42), thetaMin: theta };
}

// ---- horizons ---------------------------------------------------------------------------------

export interface HorizonSet { label: string; /** nautical miles per square root of height in metres */ visual: number; radar: number }

/** Coefficients as the books give them: distance in nautical miles = coefficient x sqrt (height in metres). */
export const HORIZON_SETS: Record<string, HorizonSet> = {
  br45: { label: 'BR 45 (2.08, radar 2.23)', visual: 2.08, radar: 2.23 },
  norie: { label: "Norie's Tables (2.095)", visual: 2.095, radar: 2.23 },
  allfs: { label: 'Admiralty List of Lights (2.03)', visual: 2.03, radar: 2.23 },
  geometric: { label: 'Geometric, no refraction (1.93)', visual: 1.93, radar: 2.23 },
  common: { label: 'As used before (2.08, radar 2.21)', visual: 2.08, radar: 2.21 },
};

export const horizon = (heightM: number, coefficient: number) => coefficient * Math.sqrt(Math.max(0, heightM));
/** Para 0803n: the range at which an object rises or dips is the horizon of the eye plus the horizon of the object. */
export const dippingRange = (eyeM: number, objectM: number, coefficient: number) => horizon(eyeM, coefficient) + horizon(objectM, coefficient);
