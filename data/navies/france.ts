// French Navy (Marine nationale): principal combatants, submarines and the larger amphibious and support ships. Written from the commonly published class
// figures (Wikipedia); NOT complete (no patrol boats, minehunters, tugs) and not checked against the official list. Where a date is not known it is blank.
import type { NavyData } from '../foreignNavies.ts';
import { cls } from './_util.ts';

export const FRANCE: NavyData = {
  navy: { id: 'fr', label: 'France', prefix: 'FS', words: 'france french marine nationale fs' },
  classes: {
    cdg: cls('Charles de Gaulle (R91)', 'Aircraft Carriers', 'French_aircraft_carrier_Charles_de_Gaulle', { builder: 'DCN Brest', displacement: '42,000 t (full load)', length: '261.5 m', beam: '31.5 m (waterline), 64.4 m (flight deck)', draught: '9.4 m', speed: '27 kn', propulsion: '2 × K15 PWR nuclear reactors; 2 shafts', complement: '~1,950 (incl. air group)', aircraft: '~40 aircraft (Rafale M, E-2C/D Hawkeye, helicopters)' }),
    mistral: cls('Mistral class (LHD)', 'Amphibious Ships', 'Mistral-class_amphibious_assault_ship', { builder: 'DCN / STX France', displacement: '21,500 t (full load)', length: '199 m', beam: '32 m', draught: '6.3 m', speed: '19 kn' }),
    horizon: cls('Horizon class (Forbin)', 'Destroyers', 'Horizon-class_frigate', { builder: 'DCNS Lorient', displacement: '7,050 t (full load)', length: '153.5 m', beam: '20.3 m', draught: '5.4 m', speed: '29 kn' }),
    fremm: cls('Aquitaine class (FREMM)', 'Frigates', 'Aquitaine-class_frigate', { builder: 'DCNS Lorient', displacement: '6,000 t (full load)', length: '142 m', beam: '20 m', draught: '5 m', speed: '27 kn' }),
    lafayette: cls('La Fayette class', 'Frigates', 'La_Fayette-class_frigate', { builder: 'DCN Lorient', displacement: '3,600 t (full load)', length: '125 m', beam: '15.4 m', draught: '4.1 m', speed: '25 kn' }),
    floreal: cls('Floréal class (surveillance frigate)', 'Frigates', 'Floréal-class_frigate', { builder: 'Chantiers de l\'Atlantique', displacement: '2,950 t (full load)', length: '93.5 m', beam: '14 m', draught: '4.3 m', speed: '20 kn' }),
    triomphant: cls('Le Triomphant class (SSBN)', 'Submarines', 'Triomphant-class_submarine', { builder: 'DCN Cherbourg', displacement: '14,335 t (submerged)', length: '138 m', beam: '12.5 m', draught: '10 m', speed: '25 kn (submerged)', propulsion: 'K15 PWR nuclear reactor; 1 shaft (pump-jet)' }),
    suffren: cls('Suffren class (Barracuda SSN)', 'Submarines', 'Suffren-class_submarine', { builder: 'Naval Group Cherbourg', displacement: '5,300 t (submerged)', length: '99 m', beam: '8.8 m', draught: '7.3 m', speed: '25 kn (submerged)', propulsion: 'K15 PWR nuclear reactor; 1 shaft (pump-jet)' }),
    chevallier: cls('Jacques Chevallier class (fleet tanker)', 'Fleet Tankers', 'Jacques_Chevallier-class_replenishment_oiler', { builder: 'Chantiers de l\'Atlantique', displacement: '31,000 t (full load)', length: '194 m' }),
  },
  ships: {
    cdg: [['Charles de Gaulle', 'R91', '2001-05']],
    mistral: [['Mistral', 'L9013', '2006-12'], ['Tonnerre', 'L9014', '2007-08'], ['Dixmude', 'L9015', '2012-12']],
    horizon: [['Forbin', 'D620', '2010'], ['Chevalier Paul', 'D621', '2011']],
    fremm: [['Aquitaine', 'D650', '2012-11'], ['Normandie', 'D651', '2014'], ['Provence', 'D652', '2015'], ['Languedoc', 'D653', '2016'], ['Auvergne', 'D654', '2017'],
      ['Bretagne', 'D655', ''], ['Alsace', 'D656', '', { notes: 'air-defence (DA) variant' }], ['Lorraine', 'D657', '', { notes: 'air-defence (DA) variant' }]],
    lafayette: [['La Fayette', 'F710', '1996'], ['Surcouf', 'F711', '1997'], ['Courbet', 'F712', '1996'], ['Aconit', 'F713', '1999'], ['Guépratte', 'F714', '2001']],
    floreal: [['Floréal', 'F730', '1992'], ['Prairial', 'F731', '1992'], ['Nivôse', 'F732', '1993'], ['Ventôse', 'F733', '1994'], ['Vendémiaire', 'F734', '1994'], ['Germinal', 'F735', '1994']],
    triomphant: [['Le Triomphant', 'S616', '1997'], ['Le Téméraire', 'S617', '1999'], ['Le Vigilant', 'S618', '2004'], ['Le Terrible', 'S619', '2010']],
    suffren: [['Suffren', 'S635', '2020'], ['Duguay-Trouin', 'S636', ''], ['Tourville', 'S637', '']],
    chevallier: [['Jacques Chevallier', 'A725', '2023']],
  },
};
