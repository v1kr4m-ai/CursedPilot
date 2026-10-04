import * as XLSX from 'xlsx';
import type { TurningDataPoint } from './types';
import { hasEmbeddedMetadata, rowsToPoints } from './tableConvert';

export type ParsedFile =
  | { kind: 'points'; points: TurningDataPoint[] }
  | { kind: 'flat'; rows: Record<string, unknown>[] };   // no speed/wheel/side in the file: the user must supply them

/** Reads an Excel, CSV or JSON file of turning data. Throws an Error with a readable message. */
export async function parseTurningFile(file: File): Promise<ParsedFile> {
  if (/\.json$/i.test(file.name)) {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error('File is not valid JSON.'); }
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every(p => p && p.heading !== undefined && p.advance !== undefined)) {
      throw new Error('JSON must be a list of points that each have a heading and an advance.');
    }
    return { kind: 'points', points: rowsToPoints(parsed) };
  }
  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Record<string, unknown>[];
  } catch { throw new Error('Could not read that file as a spreadsheet.'); }
  if (!rows.length) throw new Error('The sheet is empty.');
  return hasEmbeddedMetadata(rows) ? { kind: 'points', points: rowsToPoints(rows) } : { kind: 'flat', rows };
}
