import * as XLSX from 'xlsx';
import { readDocxTables } from '../services/docx';
import { hasEmbeddedMetadata, hasTurnColumn, tableToRows } from './tableConvert';

export interface ParsedFile {
  rows: Record<string, unknown>[];
  /** true when the file has no speed, wheel and side columns, so the user must say which table the rows belong to */
  needsMeta: boolean;
}

export const IMPORT_ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.docx,.json';

/**
 * Reads turning data from an Excel, OpenDocument, CSV/TSV/text, Word (.docx) or JSON file. Sheets and Word tables
 * without a turn-amount column are ignored, so a whole-vessel workbook can be imported too. Throws an Error with a
 * readable message.
 */
export async function parseTurningFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  let groups: Record<string, unknown>[][];

  if (name.endsWith('.json')) {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error('File is not valid JSON.'); }
    if (!Array.isArray(parsed) || !parsed.every(r => r && typeof r === 'object' && !Array.isArray(r))) throw new Error('JSON must be a list of rows.');
    groups = [parsed as Record<string, unknown>[]];
  } else if (name.endsWith('.docx')) {
    groups = (await readDocxTables(await file.arrayBuffer())).map(tableToRows);
  } else if (name.endsWith('.doc') || name.endsWith('.pdf') || name.endsWith('.rtf')) {
    throw new Error('Save it as a Word .docx, Excel, CSV or JSON file first; that format cannot be read.');
  } else {
    try {
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      groups = wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { raw: false, defval: '' }) as Record<string, unknown>[]);
    } catch { throw new Error('Could not read that file as a spreadsheet.'); }
  }

  const rows = groups.filter(hasTurnColumn).flat();
  if (!rows.length) throw new Error('No turning data found: the file needs a column for the turn amount (Turn, Heading or Angle) and columns such as Advance and Transfer.');
  return { rows, needsMeta: !hasEmbeddedMetadata(rows) };
}
