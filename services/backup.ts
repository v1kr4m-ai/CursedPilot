import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Ship, ShipParticulars } from '../types';

const APP_ID = 'cursedpilot';
const VERSION = 1;
const EMPTY_PARTICULARS: ShipParticulars = { lengthOverall: 0, breadthOverall: 0, displacement: 0, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 };

/** Saves all ships as a JSON backup: share sheet on Android, file download on web. */
export async function exportBackup(ships: Ship[]): Promise<void> {
  const json = JSON.stringify({ app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), ships }, null, 2);
  const fileName = `cursedpilot-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Cursed Pilot backup', files: [uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  URL.revokeObjectURL(url);
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses and validates a backup file's text. Throws an Error with a readable message. */
export function parseBackup(text: string): Ship[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('File is not valid JSON.'); }
  const list = isObj(data) && data.app === APP_ID ? data.ships : null;
  if (!Array.isArray(list)) throw new Error('Not a Cursed Pilot backup file.');

  return list.map((s, i) => {
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
}
