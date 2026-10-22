// Pakistan Navy: principal ships from Wikipedia's "List of active Pakistan Navy ships" (Oct 2026). Dimensions the list does not give are left blank.
import type { NavyData } from '../foreignNavies.ts';
import { cls } from './_util.ts';

export const PAKISTAN: NavyData = {
  navy: { id: 'pk', label: 'Pakistan', prefix: 'PNS', words: 'pakistan pakistani pn' },
  classes: {
    hangor: cls('Hangor class (Type 039B export)', 'Submarines', 'Hangor-class_submarine', { builder: 'China', displacement: '2,800 t' }),
    agosta90: cls('Agosta 90B (Khalid) class', 'Submarines', 'Khalid-class_submarine', { builder: 'DCN / KSEW Karachi', displacement: '2,050 t' }),
    agosta70: cls('Agosta 70 (Hashmat) class', 'Submarines', 'Hashmat-class_submarine', { builder: 'France', displacement: '1,760 t' }),
    tughril: cls('Tughril class (Type 054A/P)', 'Frigates', 'Tughril-class_frigate', { builder: 'Hudong-Zhonghua, China', displacement: '4,200 t' }),
    zulfiquar: cls('Zulfiquar class (F-22P)', 'Frigates', 'Zulfiquar-class_frigate', { builder: 'Hudong-Zhonghua / KSEW', displacement: '3,144 t' }),
    perry: cls('Alamgir (ex-Oliver Hazard Perry)', 'Frigates', 'PNS_Alamgir', { builder: 'United States', displacement: '4,200 t' }),
    babur: cls('Babur class (MILGEM)', 'Corvettes', 'Babur-class_corvette', { builder: 'Istanbul Naval Shipyard, Turkey', displacement: '3,000 t' }),
    yarmook: cls('Yarmook class (Damen OPV)', 'Offshore Patrol Vessels', 'Yarmook-class_offshore_patrol_vessel', { builder: 'Damen Shipyards Galati', displacement: '2,300 t' }),
    azmat: cls('Azmat class', 'Fast Attack Craft', 'Azmat-class_fast_attack_craft', { builder: 'KSEW Karachi', displacement: '560 t' }),
    jalalat: cls('Jalalat class', 'Fast Attack Craft', 'Jalalat-class_fast_attack_craft', { builder: 'KSEW Karachi', displacement: '250 t' }),
    munsif: cls('Munsif class (Eridan)', 'Mine Countermeasures', 'Munsif-class_minehunter', { builder: 'DCN / KSEW', displacement: '536 t' }),
    moawin: cls('Moawin class (fleet tanker)', 'Fleet Tankers', 'PNS_Moawin', { builder: 'KSEW Karachi', displacement: '17,000 t' }),
    fuqing: cls('Fuqing class (replenishment)', 'Fleet Tankers', 'PNS_Nasr_(A47)', { builder: 'China', displacement: '22,099 t' }),
    survey: cls('Behr Masah (survey ship)', 'Survey & Research Vessels', 'PNS_Behr_Masah', { builder: 'Jiangsu Dajin, China', displacement: '3,000 t' }),
  },
  ships: {
    hangor: [['Hangor', '', '2026']],
    agosta90: [['Khalid', 'S137', ''], ['Saad', 'S138', ''], ['Hamza', 'S139', '']],
    agosta70: [['Hashmat', 'S135', ''], ['Hurmat', 'S136', '']],
    tughril: [['Tughril', 'F261', '2022'], ['Taimur', 'F262', '2022'], ['Tippu Sultan', 'F263', '2023'], ['Shah Jahan', 'F264', '2023']],
    zulfiquar: [['Zulfiquar', 'F251', ''], ['Shamsheer', 'F252', ''], ['Saif', 'F253', ''], ['Aslat', 'F254', '', { builder: 'KSEW Karachi' }]],
    perry: [['Alamgir', 'F260', '']],
    babur: [['Babur', 'F280', '2024-09'], ['Khaibar', 'F282', '2025-12']],
    yarmook: [['Yarmook', 'F271', '2020-02'], ['Tabuk', 'F272', '2020-11'], ['Hunain', 'F273', '2024-07', { builder: 'Damen Shipyards Galati' }], ['Yamama', 'F274', '2024-12']],
    azmat: [['Azmat', 'P1013', '', { builder: 'China' }], ['Dehshat', 'P1014', ''], ['Himmat', 'P1027', ''], ['Haibat', 'P1028', '']],
    jalalat: [['Jalalat', 'P1029', ''], ['Shujaat', 'P1030', '']],
    munsif: [['Munsif', 'M166', '', { builder: 'DCN, France' }], ['Muhafiz', '', ''], ['Mujahid', '', '']],
    moawin: [['Moawin', 'A39', '']],
    fuqing: [['Nasr', 'A47', '1987-08']],
    survey: [['Behr Masah', '', '2019-11']],
  },
};
