// Sri Lanka Navy: the larger ships only. Wikipedia's article gives few dates, builders or dimensions, so those are left blank.
import type { NavyData } from '../foreignNavies.ts';
import { cls } from './_util.ts';

export const SRI_LANKA: NavyData = {
  navy: { id: 'lk', label: 'Sri Lanka', prefix: 'SLNS', words: 'sri lanka lankan sln ceylon' },
  classes: {
    hamilton: cls('Hamilton class (ex-USCG)', 'Frigates', 'Hamilton-class_cutter', { builder: 'Avondale Shipyard, USA', displacement: '3,250 t' }),
    saryu: cls('Saryu class (Indian-built OPV)', 'Offshore Patrol Vessels', 'Saryu-class_patrol_vessel', { builder: 'Goa Shipyard Limited', length: '105 m' }),
    opv: cls('Offshore patrol vessels', 'Offshore Patrol Vessels', 'Sri_Lanka_Navy'),
    saar4: cls('Nandimithra (Saar 4) class', 'Fast Attack Craft', 'Sa\'ar_4-class_missile_boat', { builder: 'Israel Shipyards' }),
    yuhai: cls('Yuhai class (Type 074)', 'Amphibious Ships', 'Type_074_landing_ship', { builder: 'China' }),
  },
  ships: {
    hamilton: [['Gajabahu', 'P626', '2018-08'], ['Vijayabahu', 'P627', '2021-10']],
    saryu: [['Sayurala', 'P623', '2018-04'], ['Sindurala', 'P624', '2018-08']],
    opv: [['Parakramabahu', 'P625', ''], ['Samudura', 'P261', ''], ['Sayura', '', ''], ['Sagara', '', ''], ['Samudravijaya', '', '']],
    saar4: [['Nandimithra', '', '2001'], ['Suranimala', '', '2001']],
    yuhai: [['Shathi', '', '']],
  },
};
