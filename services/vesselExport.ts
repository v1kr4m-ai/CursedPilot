import type { Ship } from '../types';
import { exportVesselJson, saveFile } from './backup';
import { vesselFileName, vesselReportHtml, vesselSheets } from './vesselReport';

export type ExportFormat = 'xlsx' | 'report' | 'json';

/** Exports one vessel. The spreadsheet library is loaded only when a workbook is asked for. */
export async function exportVessel(ship: Ship, format: ExportFormat): Promise<void> {
  if (format === 'json') return exportVesselJson(ship, vesselFileName(ship, 'json'));
  if (format === 'report') {
    return saveFile(vesselFileName(ship, 'html'), { text: vesselReportHtml(ship) }, 'text/html', `${ship.name} report`);
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  vesselSheets(ship).forEach(({ name, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows.reduce<number[]>((w, r) => r.map((c, i) => Math.max(w[i] ?? 8, Math.min(40, String(c).length + 2))), []).map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await saveFile(vesselFileName(ship, 'xlsx'), { base64 }, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${ship.name} workbook`);
}
