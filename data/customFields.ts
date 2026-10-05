// The user's own particulars and detail headings on a ship. Pure; `node data/customFields.check.ts` checks it.
import type { CustomField, Ship } from '../types.ts';

export type Group = CustomField['group'];

let counter = 0;
export const newField = (group: Group): CustomField =>
  ({ id: `cf-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`, group, label: '', value: '', unit: group === 'particulars' ? '' : undefined });

export const fieldsOf = (ship: Pick<Ship, 'custom'>, group: Group): CustomField[] => (ship.custom ?? []).filter(f => f.group === group);

/** What is worth showing and exporting: a heading is required; a heading with no value is still a (blank) row to fill in later. */
export const shownFields = (ship: Pick<Ship, 'custom'>, group: Group): CustomField[] => fieldsOf(ship, group).filter(f => f.label.trim() !== '');

/** Replaces one group's fields, keeping the other group untouched and in place order (particulars first). */
export function withGroup(ship: Pick<Ship, 'custom'>, group: Group, fields: CustomField[]): CustomField[] {
  const other = group === 'particulars' ? 'details' : 'particulars';
  const rest = fieldsOf(ship, other);
  return group === 'particulars' ? [...fields, ...rest] : [...rest, ...fields];
}

/** Drops rows that were added but never given a heading or a value, trimming the text of the rest. */
export const tidy = (fields: CustomField[]): CustomField[] =>
  fields
    .map(f => ({ ...f, label: f.label.trim(), value: f.value.trim(), unit: f.unit?.trim() || undefined }))
    .filter(f => f.label !== '' || f.value !== '');

/** "12.5 m", "Kirloskar", "" -> "" ; units follow the value. */
export const formatField = (f: CustomField): string => [f.value.trim(), f.value.trim() && f.unit ? f.unit.trim() : ''].filter(Boolean).join(' ');

/** Validates custom fields read from a file or storage; anything malformed is dropped. */
export function sanitizeFields(raw: unknown): CustomField[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CustomField[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { id, group, label, value, unit } = r as Record<string, unknown>;
    if ((group !== 'particulars' && group !== 'details') || typeof label !== 'string' || typeof value !== 'string') continue;
    const fid = typeof id === 'string' && id && !seen.has(id) ? id : newField(group).id;
    seen.add(fid);
    out.push({ id: fid, group, label, value, unit: typeof unit === 'string' && unit ? unit : undefined });
  }
  return out;
}
