import * as XLSX from 'xlsx';
import type { Ship } from '../types';
import { saveFile } from './backup';
import { buildDocx } from './docx';
import { toCsv, turningObjects, turningTable, vesselFileName } from './vesselReport';

export type TurningFormat = 'xlsx' | 'csv' | 'docx' | 'json';

export const TURNING_FORMATS: { id: TurningFormat; title: string; desc: string }[] = [
  { id: 'xlsx', title: 'Excel workbook', desc: '.xlsx, opens in any spreadsheet app' },
  { id: 'csv', title: 'CSV', desc: '.csv, plain text for any program' },
  { id: 'docx', title: 'Word document', desc: '.docx with the table' },
  { id: 'json', title: 'JSON', desc: '.json, one object per row' },
];

/** Exports all of a vessel's turning data in one table. Every format can be imported back without loss. */
export async function exportTurning(ship: Ship, format: TurningFormat): Promise<void> {
  const table = turningTable(ship);
  if (table.length < 2) throw new Error('There is no turning data to export yet.');
  const file = (ext: string) => vesselFileName(ship, ext, new Date(), 'turning-data');
  const title = `${ship.name} - turning data`;

  if (format === 'csv') {
    // a leading byte-order mark makes Excel read the degree signs correctly
    return saveFile(file('csv'), { text: `﻿${toCsv(table)}` }, 'text/csv', title);
  }
  if (format === 'json') {
    return saveFile(file('json'), { text: JSON.stringify(turningObjects(table), null, 2) }, 'application/json', title);
  }
  if (format === 'docx') {
    const bytes = await buildDocx(title, [{ rows: table.map(r => r.map(String)) }]);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return saveFile(file('docx'), { base64: btoa(bin) }, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', title);
  }
  const ws = XLSX.utils.aoa_to_sheet(table);
  ws['!cols'] = table[0].map((_, i) => ({ wch: Math.min(24, Math.max(8, ...table.map(r => String(r[i] ?? '').length + 2))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Turning data');
  await saveFile(file('xlsx'), { base64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) }, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', title);
}
