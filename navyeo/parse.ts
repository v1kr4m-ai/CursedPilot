// Small helpers for reading numbers out of a typed request. Pure.
import type { LengthUnit } from '../tools/navMath.ts';

export const NUM = '(-?\\d+(?:\\.\\d+)?)';
export const UNIT_WORDS: [RegExp, LengthUnit][] = [
  [/^(?:cables?|cbl?s?)\b/, 'cables'], [/^(?:nm|nautical miles?|miles?)\b/, 'nm'], [/^(?:metres?|meters?|m)\b/, 'metres'],
  [/^(?:yards?|yds?|yd)\b/, 'yards'], [/^(?:km|kilomet(?:re|er)s?)\b/, 'km'], [/^(?:feet|foot|ft)\b/, 'feet'], [/^(?:fathoms?|fm)\b/, 'fathoms'],
];

export const num = (t: string, re: string): number | null => {
  const m = new RegExp(re).exec(t);
  return m ? parseFloat(m[1]) : null;
};

/** A number with an optional length unit after it: "6 nm", "12", "3 cables". */
export function lengthAfter(t: string, words: string): { value: number; unit: LengthUnit | null } | null {
  const m = new RegExp(`(?:${words})\\s*(?:of|is|=|:)?\\s*${NUM}\\s*([a-z]*)`).exec(t);
  if (!m) return null;
  const unit = UNIT_WORDS.find(([re]) => re.test(m[2]))?.[1] ?? null;
  return { value: parseFloat(m[1]), unit };
}

/** "Green 15", "red 30", "port 20", "ahead", "astern": an angle off the bow, + starboard, or null. */
export function offBow(t: string): number | null {
  const m = new RegExp(`\\b(green|stbd|starboard|red|port)\\s*${NUM}`).exec(t);
  if (m) return (m[1] === 'red' || m[1] === 'port' ? -1 : 1) * parseFloat(m[2]);
  if (/\b(?:right ahead|dead ahead|ahead|bows on)\b/.test(t)) return 0;
  if (/\b(?:astern|dead astern|stern on)\b/.test(t)) return 180;
  return null;
}

/** A clock time typed as "0930", "09:30" or "9.30": hours, or null. */
export function clockHours(s: string): number | null {
  const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h + mi / 60;
}
