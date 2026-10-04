import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Ship, ShipParticulars } from '../types';

const APP_ID = 'cursedpilot';
const VERSION = 1;
const EMPTY_PARTICULARS: ShipParticulars = { lengthOverall: 0, breadthOverall: 0, displacement: 0, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 };

export type FileContent = { text: string } | { base64: string };

/** Hands a file to the user: the share sheet on Android, a download on the web. */
export async function saveFile(fileName: string, content: FileContent, mime: string, title = 'Cursed Pilot'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile('text' in content
      ? { path: fileName, data: content.text, directory: Directory.Cache, encoding: Encoding.UTF8 }
      : { path: fileName, data: content.base64, directory: Directory.Cache });
    await Share.share({ title, files: [uri] });
    return;
  }
  const part = 'text' in content ? content.text : Uint8Array.from(atob(content.base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([part], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  URL.revokeObjectURL(url);
}

/** Saves all ships as a JSON backup. */
export async function exportBackup(ships: Ship[]): Promise<void> {
  const json = JSON.stringify({ app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), ships }, null, 2);
  await saveFile(`cursedpilot-backup-${new Date().toISOString().slice(0, 10)}.json`, { text: json }, 'application/json', 'Cursed Pilot backup');
}

/** One vessel as a JSON file. Restoring it adds or updates that vessel and leaves the rest of the fleet alone. */
export async function exportVesselJson(ship: Ship, fileName: string): Promise<void> {
  const json = JSON.stringify({ app: APP_ID, version: VERSION, kind: 'vessel', exportedAt: new Date().toISOString(), ships: [ship] }, null, 2);
  await saveFile(fileName, { text: json }, 'application/json', `${ship.name} (Cursed Pilot)`);
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface Backup { ships: Ship[]; /** 'vessel' files merge into the fleet; 'fleet' backups replace it. */ kind: 'fleet' | 'vessel' }

/** Parses and validates a backup file's text. Throws an Error with a readable message. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  const list = isObj(data) && data.app === APP_ID ? data.ships : null;
  if (!Array.isArray(list)) throw new Error('Not a Cursed Pilot backup file.');

  const ships = list.map((s, i) => {
    if (!isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string' || !isObj(s.particulars)) {
      throw new Error(`Vessel #${i + 1} in the backup is malformed.`);
    }
    return {
      ...s,
      type: typeof s.type === 'string' ? s.type : '',
      particulars: { ...EMPTY_PARTICULARS, ...s.particulars },
      turningDataSets: Array.isArray(s.turningDataSets) ? s.turningDataSets : [],
      accelDecelData: Array.isArray(s.accelDecelData) ? s.accelDecelData : [],
      fishtails: Array.isArray(s.fishtails) ? s.fishtails : [],
      emLogCalibration: Array.isArray(s.emLogCalibration) ? s.emLogCalibration : [],
      compassSwing: Array.isArray(s.compassSwing) ? s.compassSwing : [],
    } as Ship;
  });
  return { kind: (data as Record<string, unknown>).kind === 'vessel' ? 'vessel' : 'fleet', ships };
}
