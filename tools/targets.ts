// Anything a navigator can shoot at night or in twilight: one of the 57 stars, a planet, or the Moon. One place to ask
// for its GHA and declination, its name and its brightness. Pure; checked through fourStar.check.ts and bodies.check.ts.
import { BODY_NAMES, bodyAt } from './bodies.ts';
import type { BodyName } from './bodies.ts';
import { STARS, starAt } from './stars.ts';
import type { Star } from './stars.ts';
import { starTrueAltitude, bodyTrueAltitude } from './sunSights.ts';
import type { AltitudeCorrections, Conditions } from './sunSights.ts';

export type Target = { kind: 'star'; star: Star } | { kind: 'body'; name: BodyName };

export const starTarget = (star: Star): Target => ({ kind: 'star', star });
export const bodyTarget = (name: BodyName): Target => ({ kind: 'body', name });

export const targetName = (t: Target): string => (t.kind === 'star' ? t.star.name : t.name);
/** "*47" for a star (its number in the almanac), "" for a planet or the Moon */
export const targetTag = (t: Target): string => (t.kind === 'star' ? `*${t.star.no}` : '');
export const targetKey = (t: Target): string => (t.kind === 'star' ? `star:${t.star.no}` : `body:${t.name}`);

/** Every target, the stars in the almanac's order, then the planets and the Moon. */
export const ALL_TARGETS: readonly Target[] = [...STARS.map(starTarget), ...BODY_NAMES.map(bodyTarget)];

export function targetByName(name: string): Target | undefined {
  const n = name.trim().toLowerCase();
  return ALL_TARGETS.find(t => targetName(t).toLowerCase() === n);
}

export interface TargetPlace { gha: number; dec: number; mag: number }

export function targetPlace(t: Target, jdUT: number): TargetPlace {
  if (t.kind === 'star') { const p = starAt(t.star, jdUT); return { gha: p.gha, dec: p.dec, mag: t.star.v }; }
  const p = bodyAt(t.name, jdUT);
  return { gha: p.gha, dec: p.dec, mag: p.mag };
}

/** True altitude from a sextant reading, with the corrections that belong to the target. */
export function targetTrueAltitude(t: Target, sextantDeg: number, cond: Conditions, jdUT: number): { apparent: number; ho: number; corr: AltitudeCorrections } {
  if (t.kind === 'star') return starTrueAltitude(sextantDeg, cond);
  const p = bodyAt(t.name, jdUT);
  return bodyTrueAltitude(sextantDeg, cond, { hp: p.hp, sd: p.sd, moon: t.name === 'Moon' });
}
