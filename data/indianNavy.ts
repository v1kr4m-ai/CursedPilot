// Indian Navy ships in service, compiled in October 2026 from open sources (chiefly Wikipedia class and ship
// articles). Class specifications are the commonly published figures, not official data, and the fleet changes
// constantly: every field is editable in the app, and anything that matters should be checked against official
// records. Ships are listed by class so shared specifications are written once.
//
// Not included: ships launched but not yet commissioned (e.g. further Nilgiri, Arnala, Mahe and the Shachi-class
// NOPVs), decommissioned or transferred ships, landing craft, tugs and other small auxiliaries.

export const NAVY_CATEGORIES = [
  'Aircraft Carriers',
  'Destroyers',
  'Frigates',
  'Corvettes',
  'Submarines',
  'Offshore Patrol Vessels',
  'Fast Attack Craft',
  'Amphibious Ships',
  'Fleet Tankers',
  'Survey & Research Vessels',
  'Training Ships',
  'Other',
] as const;
export type NavyCategory = (typeof NAVY_CATEGORIES)[number];

export interface ClassSpec {
  name: string;
  category: NavyCategory;
  builder: string;
  displacement: string;
  length: string;
  beam: string;
  draught: string;
  speed: string;
  propulsion: string;
  complement: string;
  armament: string;
  sensors: string;
  aircraft: string;
  /** numbers for the vessel's particulars (m, m, tons) */
  loa: number;
  breadth: number;
  tons: number;
  /** Wikipedia article used for the picture and short description when online */
  wiki: string;
}

/** [name, pennant, commissioned (YYYY-MM), optional overrides] */
export type ShipRow = [string, string, string, { builder?: string; status?: string; notes?: string; wiki?: string }?];

const MDL = 'Mazagon Dock Limited';
const GRSE = 'Garden Reach Shipbuilders & Engineers';
const GSL = 'Goa Shipyard Limited';

export const CLASSES: Record<string, ClassSpec> = {
  vikrant: {
    name: 'Vikrant class (IAC-1)', category: 'Aircraft Carriers', builder: 'Cochin Shipyard Limited',
    displacement: '45,000 t (full load)', length: '262.5 m', beam: '62 m (flight deck)', draught: '8.4 m', speed: '30 kn',
    propulsion: '4 × GE LM2500 gas turbines (COGAG)', complement: '~1,645 (196 officers, 1,449 sailors, incl. air crew)',
    armament: 'Barak 8 SAM (2 × 32-cell VLS); AK-630 CIWS; 12.7 mm remote-controlled guns',
    sensors: 'EL/M-2248 MF-STAR AESA radar; L-band air surveillance radar', aircraft: 'Up to 36 fixed- and rotary-wing aircraft',
    loa: 262.5, breadth: 62, tons: 45000, wiki: 'INS_Vikrant_(2013)',
  },
  vikramaditya: {
    name: 'Vikramaditya (ex-Admiral Gorshkov)', category: 'Aircraft Carriers', builder: 'Black Sea Shipyard / Sevmash (refit)',
    displacement: '45,000 t (full load)', length: '284 m', beam: '61 m', draught: '10.2 m', speed: '30+ kn',
    propulsion: '8 boilers, 4 geared steam turbines, 4 shafts (180,000 shp)', complement: '~1,610 (110 officers, 1,500 sailors)',
    armament: 'AK-630 CIWS; Barak 1 SAM (24 missiles)', sensors: 'Long-range air surveillance radars; LESORUB-E and Resistor-E radar complexes; Link II',
    aircraft: 'Up to 34 aircraft (MiG-29K fighters and Kamov helicopters)',
    loa: 284, breadth: 61, tons: 45000, wiki: 'INS_Vikramaditya',
  },
  p15b: {
    name: 'Visakhapatnam class (Project 15B)', category: 'Destroyers', builder: 'Mazagon Dock Shipbuilders Limited',
    displacement: '7,400 t (full load)', length: '163 m', beam: '17.4 m', draught: '6.5 m', speed: '30+ kn',
    propulsion: 'COGAG: 4 gas turbines', complement: '~300 (50 officers + 250 sailors)',
    armament: '32 × Barak 8 SAM; 16 × BrahMos; 1 × 76 mm gun; 4 × AK-630 CIWS; 4 × 533 mm torpedo tubes; 2 × RBU-6000',
    sensors: 'EL/M-2248 MF-STAR AESA radar; HUMSA-NG sonar', aircraft: '2 × HAL Dhruv / Seahawk / Sea King Mk 42B',
    loa: 163, breadth: 17.4, tons: 7400, wiki: 'Visakhapatnam-class_destroyer',
  },
  p15a: {
    name: 'Kolkata class (Project 15A)', category: 'Destroyers', builder: MDL,
    displacement: '7,400 t (full load)', length: '163 m', beam: '17.4 m', draught: '6.5 m', speed: '30 kn',
    propulsion: 'COGAG: 4 × DT-59 gas turbines (Zorya-Mashproekt)', complement: '~300 (50 officers + 250 sailors)',
    armament: '32 × Barak 8 SAM; 16 × BrahMos; 1 × 76 mm gun; 4 × AK-630 CIWS; 4 × 533 mm torpedo tubes; 2 × RBU-6000',
    sensors: 'EL/M-2248 MF-STAR AESA radar; Thales LW-08 air search radar; HUMSA-NG bow sonar', aircraft: '2 × Sea King / Seahawk / HAL Dhruv',
    loa: 163, breadth: 17.4, tons: 7400, wiki: 'Kolkata-class_destroyer',
  },
  p15: {
    name: 'Delhi class (Project 15)', category: 'Destroyers', builder: MDL,
    displacement: '6,200 t (full load)', length: '163 m', beam: '17 m', draught: '6.5 m', speed: '32 kn',
    propulsion: '2 × Zorya-Mashproekt M36E plants (DT-59 gas turbines), 82,820 hp, 2 controllable-pitch propellers', complement: '~350 (40 officers)',
    armament: '8 × BrahMos; 2 × Shtil-1 SAM (48 missiles); 32 × Barak 1 SAM; 1 × 76 mm gun; 2 × AK-630 CIWS; 2 × RBU-6000; quintuple 533 mm torpedo tubes',
    sensors: 'Fregat M2EM and RAWL radars; hull-mounted and towed-array sonar', aircraft: '2 × Sea King Mk 42B',
    loa: 163, breadth: 17, tons: 6200, wiki: 'Delhi-class_destroyer',
  },
  rajput: {
    name: 'Rajput class (Kashin II)', category: 'Destroyers', builder: '61 Kommunara Shipyard, Nikolayev (USSR)',
    displacement: '4,974 t (full load); 3,950 t standard', length: '146.5 m', beam: '15.8 m', draught: '4.8 m', speed: '35 kn',
    propulsion: '4 × gas turbines (COGAG), 72,000 hp, 2 shafts', complement: '~320 (35 officers)',
    armament: 'Anti-ship missiles (P-15 / BrahMos, varies by ship); SAM (S-125M, VL-SRSAM or Barak, varies); 76 mm gun; AK-630 CIWS; 533 mm torpedo tubes; RBU-6000',
    sensors: 'Air/surface search radars; hull-mounted and variable-depth sonar', aircraft: '1 × Ka-28 or HAL Chetak',
    loa: 146.5, breadth: 15.8, tons: 4974, wiki: 'Rajput-class_destroyer',
  },
  p17a: {
    name: 'Nilgiri class (Project 17A)', category: 'Frigates', builder: 'Mazagon Dock Shipbuilders Limited',
    displacement: '6,670 t', length: '149 m', beam: '17.8 m', draught: '5.22 m', speed: '32 kn',
    propulsion: 'CODOG: 2 × GE LM2500 gas turbines + 2 × MAN diesels', complement: '~226 (35 officers + 191 sailors)',
    armament: '32 × Barak 8 SAM; 8 × BrahMos; 1 × 76 mm gun; 2 × AK-630 CIWS; torpedoes',
    sensors: 'EL/M-2248 MF-STAR AESA radar; Lanza-N L-band radar; HUMSA-NG sonar; Shakti EW suite', aircraft: '1 × HAL Dhruv or Sea King Mk 42B',
    loa: 149, breadth: 17.8, tons: 6670, wiki: 'Nilgiri-class_frigate_(2019)',
  },
  p17: {
    name: 'Shivalik class (Project 17)', category: 'Frigates', builder: MDL,
    displacement: '6,200 t (full load)', length: '144 m', beam: '16.9 m', draught: '4.5 m', speed: '32 kn',
    propulsion: 'CODOG: 2 × GE LM2500+ gas turbines + 2 × Pielstick 16 PA6 STC diesels', complement: '~257 (35 officers + 222 sailors)',
    armament: '1 × Shtil-1 SAM (24 missiles); 8 × BrahMos (VLS); 1 × 76 mm gun; 2 × AK-630 CIWS; torpedo tubes; RBU-6000',
    sensors: 'Fregat M2EM radar and ELTA systems; HUMSA-NG sonar', aircraft: '2 × HAL Dhruv or Sea King Mk 42B',
    loa: 144, breadth: 16.9, tons: 6200, wiki: 'Shivalik-class_frigate',
  },
  talwar: {
    name: 'Talwar class (Project 1135.6)', category: 'Frigates', builder: 'Baltic Shipyard / Yantar Shipyard (Russia)',
    displacement: '4,035 t (full load); 3,850 t standard', length: '124.8 m', beam: '15.2 m', draught: '4.2 m', speed: '32 kn',
    propulsion: 'COGAG: 2 × DS-71 cruise + 2 × DT-59 boost gas turbines', complement: '~180 (18 officers)',
    armament: '8 × Klub anti-ship/land-attack missiles (BrahMos in Tushil and Tamal); Shtil-1 SAM (24 missiles); 1 × A-190E 100 mm gun; Kashtan CIWS; RBU-6000; 533 mm torpedo tubes',
    sensors: 'Fregat M2EM radar; Puma fire control; HUMSA sonar; TK-25E-5 EW suite', aircraft: '1 × Ka-28 / Ka-31 / HAL Dhruv',
    loa: 124.8, breadth: 15.2, tons: 4035, wiki: 'Talwar-class_frigate',
  },
  p16a: {
    name: 'Brahmaputra class (Project 16A)', category: 'Frigates', builder: GRSE,
    displacement: '3,850 t (full load); 3,600 t standard', length: '126.4 m', beam: '14.5 m', draught: '4.5 m', speed: '30+ kn',
    propulsion: '2 × BHEL steam turbines (30,000 shp), 2 shafts', complement: '~300',
    armament: '16 × Kh-35 Uran SSM; 24 × Barak point-defence SAM; 1 × 76 mm gun; 4 × AK-630; 2 × triple 324 mm torpedo tubes',
    sensors: 'Hull-mounted sonar (HUMSA); towed-array sonar; air/surface search radars', aircraft: '2 × Sea King or HAL Chetak',
    loa: 126.4, breadth: 14.5, tons: 3850, wiki: 'Brahmaputra-class_frigate',
  },
  kamorta: {
    name: 'Kamorta class (Project 28)', category: 'Corvettes', builder: GRSE,
    displacement: '3,300 t (full load)', length: '109 m', beam: '13.7 m', draught: '', speed: '25 kn',
    propulsion: 'CODAD: 4 × Pielstick 12PA 6 STC diesels', complement: '~123 (17 officers)',
    armament: '1 × 76 mm Super Rapid gun; 2 × AK-630M CIWS; 2 × RBU-6000; 2 × twin 533 mm torpedo tubes',
    sensors: 'Revathi central acquisition radar; HUMSA hull-mounted sonar; EL/M-2221 STGR fire-control radar', aircraft: '1 × Ka-28 or HAL Dhruv',
    loa: 109, breadth: 13.7, tons: 3300, wiki: 'Kamorta-class_corvette',
  },
  kora: {
    name: 'Kora class (Project 25A)', category: 'Corvettes', builder: GRSE,
    displacement: '1,320 t (full load)', length: '91.1 m', beam: '10.5 m', draught: '4.5 m', speed: '25 kn',
    propulsion: '2 × SEMT Pielstick/Kirloskar 18 PA6V 280 diesels (10,600 kW)', complement: '~134 (14 officers)',
    armament: '16 × Kh-35 SSM (4 × quad); SA-N-5 Grail launcher; 1 × 76 mm gun; 2 × AK-630 CIWS',
    sensors: 'MR-352 air/surface search radar; Garpun-B radar; fire-control radars', aircraft: '1 × HAL Dhruv or Chetak',
    loa: 91.1, breadth: 10.5, tons: 1320, wiki: 'Kora-class_corvette',
  },
  khukri: {
    name: 'Khukri class (Project 25)', category: 'Corvettes', builder: GRSE,
    displacement: '1,291 t (full load)', length: '91.1 m', beam: '10.5 m', draught: '4 m', speed: '24 kn',
    propulsion: '2 × SEMT Pielstick/Kirloskar 18 PA6V 280 diesels (10,600 kW)', complement: '~112 (12 officers)',
    armament: '4 × P-15 Termit missile launchers; SA-N-5 Grail launcher; 1 × AK-176 76 mm gun; 2 × AK-630',
    sensors: 'MR-352, Garpun-B, MR-123 and BEL 1245 radars', aircraft: '1 × HAL Chetak or Dhruv',
    loa: 91.1, breadth: 10.5, tons: 1291, wiki: 'Khukri-class_corvette',
  },
  veer: {
    name: 'Veer class (Tarantul, Project 1241RE)', category: 'Corvettes', builder: 'Mazagon Dock Limited / Goa Shipyard Limited',
    displacement: '455–477 t', length: '56.1 m', beam: '11.5 m', draught: '2.5 m', speed: '36 kn',
    propulsion: 'COGAG: 2 × DR77 + 2 × DR76 gas turbines', complement: '~41 (5 officers)',
    armament: '4 × anti-ship missiles (P-15 Termit / Kh-35 Uran / BrahMos variants); SA-N-5 launcher; 1 × 76 mm gun; 2 × AK-630',
    sensors: '', aircraft: '',
    loa: 56.1, breadth: 11.5, tons: 455, wiki: 'Veer-class_corvette',
  },
  arnala: {
    name: 'Arnala class (ASW-SWC)', category: 'Corvettes', builder: `${GRSE} (with L&T Kattupalli)`,
    displacement: '~900 t (1,490 GT)', length: '77.6 m', beam: '10.5 m', draught: '2.7 m', speed: '25 kn',
    propulsion: '3 × MTU 20V 4000 M93L diesels with waterjets', complement: '~57 (7 officers + 50 sailors)',
    armament: '1 × RBU-6000 ASW rocket launcher; 2 × triple lightweight torpedo launchers; ASW mines; 1 × 30 mm gun; 2 × 12.7 mm remote-controlled guns',
    sensors: 'DRDO Abhay hull-mounted sonar; low-frequency variable-depth sonar; fire control; IPMS', aircraft: '',
    loa: 77.6, breadth: 10.5, tons: 900, wiki: 'Anti-Submarine_Warfare_Shallow_Water_Craft',
  },
  mahe: {
    name: 'Mahe class (ASW-SWC)', category: 'Corvettes', builder: 'Cochin Shipyard Limited',
    displacement: '~896–1,100 t', length: '78 m', beam: '11.26 m', draught: '2.7 m', speed: '25 kn',
    propulsion: 'Marine diesels with L&T waterjets', complement: '',
    armament: '1 × RBU-6000 ASW rocket launcher; 2 × triple lightweight torpedo launchers; ASW mines; 1 × 30 mm gun; 2 × 12.7 mm remote-controlled guns',
    sensors: 'DRDO Abhay hull-mounted sonar; low-frequency variable-depth sonar; fire control; IPMS', aircraft: '',
    loa: 78, breadth: 11.26, tons: 900, wiki: 'Anti-Submarine_Warfare_Shallow_Water_Craft',
  },
  arihant: {
    name: 'Arihant class (SSBN)', category: 'Submarines', builder: 'Ship Building Centre, Visakhapatnam',
    displacement: '~6,000 t surfaced (Arihant); ~7,000 t (Aridhaman) - unofficial estimates', length: '111 m (Arihant); ~130 m (Aridhaman, est.)', beam: '11 m', draught: '', speed: '12–15 kn surfaced; ~24 kn submerged (est.)',
    propulsion: '1 × pressurised water reactor, 1 shaft', complement: '~95',
    armament: '6 × 533 mm torpedo tubes; 4 (Arihant) / 8 (Aridhaman) ballistic-missile tubes', sensors: '', aircraft: '',
    loa: 111, breadth: 11, tons: 6000, wiki: 'Arihant-class_submarine',
  },
  kalvari: {
    name: 'Kalvari class (Scorpène, Project 75)', category: 'Submarines', builder: 'Mazagon Dock Shipbuilders Limited (with Naval Group)',
    displacement: '1,615 t surfaced / 1,775 t submerged', length: '67.5 m', beam: '6.2 m', draught: '5.8 m', speed: '11 kn surfaced / 20 kn submerged',
    propulsion: '4 × MTU 12V 396 SE84 diesels, 360-cell battery; AIP planned', complement: '~43 (8 officers + 35 sailors)',
    armament: '6 × 533 mm torpedo tubes: SUT torpedoes, SM39 Exocet or mines. Test depth 350 m', sensors: '', aircraft: '',
    loa: 67.5, breadth: 6.2, tons: 1615, wiki: 'Kalvari-class_submarine_(2015)',
  },
  sindhughosh: {
    name: 'Sindhughosh class (Kilo, Project 877EKM)', category: 'Submarines', builder: 'USSR / Russia',
    displacement: '2,325 t surfaced / 3,076 t submerged', length: '72.6 m', beam: '9.9 m', draught: '6.6 m', speed: '11 kn surfaced / 19 kn submerged',
    propulsion: 'Diesel-electric', complement: '~53 (13 officers)',
    armament: 'Club-S missiles; 533 mm torpedoes (Type 53-65, TEST 71/76); up to 24 mines. Test depth 300 m', sensors: '', aircraft: '',
    loa: 72.6, breadth: 9.9, tons: 2325, wiki: 'Sindhughosh-class_submarine',
  },
  shishumar: {
    name: 'Shishumar class (Type 209/1500)', category: 'Submarines', builder: 'Howaldtswerke-Deutsche Werft (S44, S45); Mazagon Dock Limited (S46, S47)',
    displacement: '1,660 t surfaced / 1,850 t submerged', length: '64.4 m', beam: '6.5 m', draught: '6 m', speed: '11 kn surfaced / 22 kn submerged',
    propulsion: 'Diesel-electric: 4 × MTU diesels, 1 × Siemens motor', complement: '~40 (8 officers)',
    armament: '533 mm torpedo tubes (14 × AEG SUT Mod-1 torpedoes); 24 external mines; Harpoon missiles (S46, S47)', sensors: '', aircraft: '',
    loa: 64.4, breadth: 6.5, tons: 1660, wiki: 'Shishumar-class_submarine',
  },
  sukanya: {
    name: 'Sukanya class (OPV)', category: 'Offshore Patrol Vessels', builder: 'Korea Tacoma (P50–P52); Hindustan Shipyard (P53, P55, P56)',
    displacement: '1,890 t (full load)', length: '101.1 m', beam: '11.5 m', draught: '4.4 m', speed: '21 kn',
    propulsion: '2 × SEMT Pielstick 16 PA6 V 280 diesels (12,800 PS)', complement: '~140 (15 officers)',
    armament: '1 × 40 mm Bofors; 4 × 12.7 mm MG (Dhanush missile on some, 25 mm guns on P55)', sensors: '', aircraft: '',
    loa: 101.1, breadth: 11.5, tons: 1890, wiki: 'Sukanya-class_patrol_vessel',
  },
  saryu: {
    name: 'Saryu class (NOPV)', category: 'Offshore Patrol Vessels', builder: GSL,
    displacement: '2,230 t', length: '105 m', beam: '12.9 m', draught: '4.9 m', speed: '25 kn',
    propulsion: '2 × Pielstick PA 6B STC diesels (21,725 PS)', complement: '~118 (16 officers + 102 sailors)',
    armament: '1 × 76 mm Oto Melara; 2 × 30 mm AK-630 CIWS', sensors: 'Sperry Bridgemaster navigation radar; EON-51 electro-optical fire control', aircraft: '1 × HAL Dhruv',
    loa: 105, breadth: 12.9, tons: 2230, wiki: 'Saryu-class_patrol_vessel',
  },
  carnicobar: {
    name: 'Car Nicobar class (WJFAC)', category: 'Fast Attack Craft', builder: GSL,
    displacement: '293 t', length: '48.9 m', beam: '7.5 m', draught: '2.1 m', speed: '35 kn',
    propulsion: '3 × MTU 16V 4000 M90 diesels, 3 × Hamilton HM811 waterjets', complement: '29 (6 officers)',
    armament: '1 × CRN-91 30 mm gun; Igla SAM; 2 × 12.7 mm HMG', sensors: '', aircraft: '',
    loa: 48.9, breadth: 7.5, tons: 293, wiki: 'Car_Nicobar-class_patrol_vessel',
  },
  tihayu: {
    name: 'Car Nicobar class, follow-on (FOWJFAC)', category: 'Fast Attack Craft', builder: GSL,
    displacement: '315 t', length: '48.9 m', beam: '7.5 m', draught: '2.1 m', speed: '35 kn',
    propulsion: '3 × MTU 16V 4000 M90 diesels, 3 × Hamilton HM811 waterjets', complement: '29 (6 officers)',
    armament: '1 × CRN-91 30 mm gun; Igla SAM; 2 × 12.7 mm HMG', sensors: '', aircraft: '',
    loa: 48.9, breadth: 7.5, tons: 315, wiki: 'Car_Nicobar-class_patrol_vessel',
  },
  bangaram: {
    name: 'Bangaram class (FAC)', category: 'Fast Attack Craft', builder: GRSE,
    displacement: '260 t (full load)', length: '46 m', beam: '7.5 m', draught: '', speed: '30 kn',
    propulsion: '2 × MTU 4000 M90 diesels (7,492 hp)', complement: '33',
    armament: '1 × CRN-91 30 mm gun', sensors: '', aircraft: '',
    loa: 46, breadth: 7.5, tons: 260, wiki: 'Bangaram-class_patrol_vessel',
  },
  jalashwa: {
    name: 'Austin class (ex-USS Trenton, LPD)', category: 'Amphibious Ships', builder: 'Lockheed Shipbuilding and Construction Company (USA)',
    displacement: '16,600 t (full load); 12,000 t standard', length: '173.7 m', beam: '30.4 m', draught: '6.7 m', speed: '20 kn',
    propulsion: '2 boilers, 2 steam turbines, 2 shafts (24,000 shp)', complement: '~407 (27 officers + 380 sailors); up to 1,000 troops',
    armament: '4 × 3-inch/50 AA guns; 1 × AK-630M CIWS', sensors: '', aircraft: 'Up to 6 Sea King helicopters',
    loa: 173.7, breadth: 30.4, tons: 16600, wiki: 'INS_Jalashwa',
  },
  shardul: {
    name: 'Shardul class (LST(L))', category: 'Amphibious Ships', builder: GRSE,
    displacement: '5,650 t', length: '125 m', beam: '17.5 m', draught: '4 m', speed: '16 kn',
    propulsion: 'Kirloskar PA6 STC diesels', complement: '~156 (11 officers + 145 sailors); 500 troops',
    armament: '2 × WM-18 140 mm rocket launchers; 4 × CRN-91 30 mm guns; MANPADS', sensors: '',
    aircraft: '1 × Sea King / HAL Dhruv; 4 × LCVP; 11 MBT + 10 armoured vehicles',
    loa: 125, breadth: 17.5, tons: 5650, wiki: 'Shardul-class_tank_landing_ship',
  },
  magar: {
    name: 'Magar class (LST(L))', category: 'Amphibious Ships', builder: `Hindustan Shipyard / ${GRSE}`,
    displacement: '5,665 t (full load)', length: '120 m', beam: '17.5 m', draught: '4 m', speed: '15 kn',
    propulsion: '2 × diesels (8,560 hp sustained)', complement: '136 (16 officers); 500 troops',
    armament: '4 × Bofors 40 mm/60 guns; 2 × 122 mm multiple rocket launchers', sensors: '', aircraft: '4 × LCVP; 15 tanks, 8 APCs',
    loa: 120, breadth: 17.5, tons: 5665, wiki: 'INS_Gharial_(L23)',
  },
  deepak: {
    name: 'Deepak class (fleet tanker)', category: 'Fleet Tankers', builder: 'Fincantieri (Muggiano; Sestri Ponente)',
    displacement: '27,500 t (full load)', length: '175 m', beam: '25 m', draught: '9.1 m', speed: '20 kn',
    propulsion: '10,000 kW diesel engine', complement: '~248',
    armament: '4 × AK-630', sensors: '', aircraft: 'Flight deck for Sea King / HAL Chetak',
    loa: 175, breadth: 25, tons: 27500, wiki: 'Deepak-class_fleet_tanker',
  },
  jyoti: {
    name: 'Jyoti class (fleet tanker)', category: 'Fleet Tankers', builder: 'Admiralty Shipyard, St Petersburg',
    displacement: '35,900 t (full load)', length: '178 m', beam: '25.3 m', draught: '11.35 m', speed: '15 kn',
    propulsion: '1 × Bryansk-B&W 6DKRN60/195 diesel (10,948 bhp)', complement: '~208 (23 officers)',
    armament: 'Close-in weapon systems', sensors: '', aircraft: '1 × light helicopter',
    loa: 178, breadth: 25.3, tons: 35900, wiki: 'INS_Jyoti_(A58)',
  },
  aditya: {
    name: 'Aditya class (fleet tanker)', category: 'Fleet Tankers', builder: GRSE,
    displacement: '24,612 t (full load)', length: '172 m', beam: '23 m', draught: '7.5 m', speed: '20 kn',
    propulsion: '2 × MAN B&W diesels (23,972 hp), single shaft', complement: '~197 (incl. 6 aircrew)',
    armament: '1 × SA-N-10 SAM launcher; 3 × 30 mm Medak guns', sensors: '', aircraft: '1 × HAL Chetak',
    loa: 172, breadth: 23, tons: 24612, wiki: 'INS_Aditya_(A59)',
  },
  sandhayakNew: {
    name: 'Sandhayak class (2023, survey vessel large)', category: 'Survey & Research Vessels', builder: GRSE,
    displacement: '3,300 t', length: '110 m', beam: '16 m', draught: '', speed: '18 kn (cruise 16 kn)',
    propulsion: '', complement: '231', armament: '1 × CRN-91 gun (secondary role)',
    sensors: 'AUVs, ROVs, multi-beam echo sounders', aircraft: '1 × HAL Dhruv',
    loa: 110, breadth: 16, tons: 3300, wiki: 'Sandhayak-class_survey_vessel_(2023)',
  },
  sandhayakOld: {
    name: 'Sandhayak class (1981, survey ship)', category: 'Survey & Research Vessels', builder: `${GRSE} (J15); ${GSL} (J16, J17, J21, J22)`,
    displacement: '1,960 t (full load)', length: '87.8 m', beam: '12.8 m', draught: '3.3 m', speed: '16 kn',
    propulsion: '2 × diesels', complement: '~178 (18 officers + 160 sailors)',
    armament: '1 × Bofors 40 mm gun', sensors: '', aircraft: '1 × HAL Chetak',
    loa: 87.8, breadth: 12.8, tons: 1960, wiki: 'Sandhayak-class_survey_ship_(1981)',
  },
  sagardhwani: {
    name: 'Sagardhwani (marine research vessel)', category: 'Survey & Research Vessels', builder: GRSE,
    displacement: '2,083 t (full load)', length: '85.1 m', beam: '12.8 m', draught: '', speed: '16 kn',
    propulsion: '2 × diesels (3,860 hp), 2 shafts, 2 auxiliary thrusters', complement: '~96 (80 crew + 16 scientists)',
    armament: '', sensors: '', aircraft: '',
    loa: 85.1, breadth: 12.8, tons: 2083, wiki: 'INS_Sagardhwani',
  },
  tir: {
    name: 'Tir class (cadet training ship)', category: 'Training Ships', builder: MDL,
    displacement: '3,200 t (full load)', length: '105.85 m', beam: '13.2 m', draught: '4.8 m', speed: '18 kn',
    propulsion: '2 shafts, 2 × 7,072 hp motors', complement: 'Up to 293 (cadets and staff)',
    armament: '1 × CRN-91 30 mm; twin Bofors 40 mm/60; saluting guns', sensors: '', aircraft: '',
    loa: 105.85, breadth: 13.2, tons: 3200, wiki: 'INS_Tir_(A86)',
  },
  barque: {
    name: 'Tarangini class (sail training barque)', category: 'Training Ships', builder: GSL,
    displacement: '513 t', length: '54 m', beam: '8.53 m', draught: '4.5 m', speed: '',
    propulsion: '2 × Kirloskar Cummins diesels (320 hp each); 1,035 m² of sail', complement: '61',
    armament: '', sensors: '', aircraft: '',
    loa: 54, breadth: 8.53, tons: 513, wiki: 'INS_Tarangini',
  },
  varuna: {
    name: 'Varuna (square-rig sail training vessel)', category: 'Training Ships', builder: MDL,
    displacement: '110 t (burthen)', length: '29 m', beam: '8.5 m', draught: '4 m', speed: '',
    propulsion: '2 × Kirloskar Cummins diesels (320 hp each); 12 sails', complement: '37 (incl. 21 cadets)',
    armament: '', sensors: '', aircraft: '',
    loa: 29, breadth: 8.5, tons: 110, wiki: 'INS_Varuna',
  },
  mhadei: {
    name: 'Mhadei class (sail training boat)', category: 'Training Ships', builder: 'Aquarius Shipyard Private Limited',
    displacement: '23 t', length: '17.1 m', beam: '5 m', draught: '', speed: '',
    propulsion: 'Sail (Tonga 56 design)', complement: '',
    armament: '', sensors: '', aircraft: '',
    loa: 17.1, breadth: 5, tons: 23, wiki: 'Mhadei_class',
  },
};

const SHIPS: Record<string, ShipRow[]> = {
  vikrant: [['Vikrant', 'R11', '2022-09', { wiki: 'INS_Vikrant_(2013)' }]],
  vikramaditya: [['Vikramaditya', 'R33', '2013-11']],
  p15b: [['Visakhapatnam', 'D66', '2021-11'], ['Mormugao', 'D67', '2022-12'], ['Imphal', 'D68', '2023-12'], ['Surat', 'D69', '2025-01']],
  p15a: [['Kolkata', 'D63', '2014-08'], ['Kochi', 'D64', '2015-09'], ['Chennai', 'D65', '2016-11']],
  p15: [['Delhi', 'D61', '1997-11'], ['Mysore', 'D60', '1999-06'], ['Mumbai', 'D62', '2001-01']],
  rajput: [['Rana', 'D52', '1982-02'], ['Ranvir', 'D54', '1986-04'], ['Ranvijay', 'D55', '1987-12']],
  p17a: [
    ['Nilgiri', 'F33', '2025-01'], ['Udaygiri', 'F35', '2025-08'], ['Taragiri', 'F41', '2026-04'], ['Mahendragiri', 'F38', '2026-07'],
    ['Himgiri', 'F34', '2025-08', { builder: GRSE }], ['Dunagiri', 'F36', '2026-06', { builder: GRSE }],
  ],
  p17: [['Shivalik', 'F47', '2010-04'], ['Satpura', 'F48', '2011-08'], ['Sahyadri', 'F49', '2012-07']],
  talwar: [
    ['Talwar', 'F40', '2003-06', { builder: 'Baltic Shipyard, St Petersburg' }], ['Trishul', 'F43', '2003-06', { builder: 'Baltic Shipyard, St Petersburg' }],
    ['Tabar', 'F44', '2004-04', { builder: 'Baltic Shipyard, St Petersburg' }], ['Teg', 'F45', '2012-04', { builder: 'Yantar Shipyard, Kaliningrad' }],
    ['Tarkash', 'F50', '2012-11', { builder: 'Yantar Shipyard, Kaliningrad' }], ['Trikand', 'F51', '2013-06', { builder: 'Yantar Shipyard, Kaliningrad' }],
    ['Tushil', 'F70', '2024-12', { builder: 'Yantar Shipyard, Kaliningrad' }], ['Tamal', 'F71', '2025-07', { builder: 'Yantar Shipyard, Kaliningrad' }],
  ],
  p16a: [['Brahmaputra', 'F31', '2000-04', { status: 'Reported temporarily inactive' }], ['Betwa', 'F39', '2004-07'], ['Beas', 'F37', '2005-07']],
  kamorta: [['Kamorta', 'P28', '2014-08'], ['Kadmatt', 'P29', '2016-01'], ['Kiltan', 'P30', '2017-10'], ['Kavaratti', 'P31', '2020-10']],
  kora: [['Kora', 'P61', '1998-08'], ['Kirch', 'P62', '2001-01'], ['Kulish', 'P63', '2001-08'], ['Karmuk', 'P64', '2004-02']],
  khukri: [['Kuthar', 'P46', '1990-06'], ['Khanjar', 'P47', '1991-10']],
  veer: [
    ['Vibhuti', 'K45', '1991-06', { builder: MDL }], ['Vipul', 'K46', '1992-03', { builder: MDL }], ['Vinash', 'K47', '1993-11', { builder: GSL }],
    ['Vidyut', 'K48', '1995-01', { builder: GSL }], ['Nashak', 'K83', '1994-12', { builder: MDL }],
    ['Prabal', 'K92', '2002-04', { builder: MDL }], ['Pralaya', 'K91', '2002-12', { builder: GSL }],
  ],
  arnala: [['Arnala', 'P68', '2025-06'], ['Androth', 'P69', '2025-10'], ['Anjadip', 'P73', '2026-02'], ['Agray', 'P36', '2026-06']],
  mahe: [['Mahe', 'P80', '2025-11'], ['Malwan', 'P81', '2026-07']],
  arihant: [
    ['Arihant', 'S2', '2016-08', { notes: 'Details are unofficial open-source estimates.' }], ['Arighaat', 'S3', '2024-08', { notes: 'Details are unofficial open-source estimates.' }],
    ['Aridhaman', 'S4', '2026-04', { notes: 'Longer Aridhaman sub-class. Details are unofficial open-source estimates.' }],
  ],
  kalvari: [
    ['Kalvari', 'S21', '2017-12', { status: 'Reported under refit' }], ['Khanderi', 'S22', '2019-09'], ['Karanj', 'S23', '2021-03'],
    ['Vela', 'S24', '2021-11'], ['Vagir', 'S25', '2023-01'], ['Vagsheer', 'S26', '2025-01'],
  ],
  sindhughosh: [
    ['Sindhuraj', 'S57', '1987-10'], ['Sindhuratna', 'S59', '1988-12'], ['Sindhukesari', 'S60', '1989-02'],
    ['Sindhukirti', 'S61', '1990-01'], ['Sindhuvijay', 'S62', '1991-03'], ['Sindhurashtra', 'S65', '2000-07'],
  ],
  shishumar: [
    ['Shishumar', 'S44', '1986-09', { builder: 'Howaldtswerke-Deutsche Werft, Kiel' }], ['Shankush', 'S45', '1986-11', { builder: 'Howaldtswerke-Deutsche Werft, Kiel' }],
    ['Shalki', 'S46', '1992-02', { builder: MDL }], ['Shankul', 'S47', '1994-05', { builder: MDL }],
  ],
  sukanya: [
    ['Sukanya', 'P50', '1989-08', { builder: 'Korea Tacoma' }], ['Subhadra', 'P51', '1990-01', { builder: 'Korea Tacoma' }], ['Suvarna', 'P52', '1991-04', { builder: 'Korea Tacoma' }],
    ['Savitri', 'P53', '1990-11', { builder: 'Hindustan Shipyard' }], ['Sharda', 'P55', '1991-10', { builder: 'Hindustan Shipyard' }], ['Sujata', 'P56', '1993-11', { builder: 'Hindustan Shipyard' }],
  ],
  saryu: [['Saryu', 'P54', '2013-01'], ['Sunayna', 'P57', '2013-10'], ['Sumedha', 'P58', '2014-03'], ['Sumitra', 'P59', '2014-09']],
  carnicobar: [
    ['Car Nicobar', 'T69', '2009-02'], ['Chetlat', 'T70', '2009-02'], ['Cora Divh', 'T71', '2009-09'], ['Cheriyam', 'T72', '2009-09'],
    ['Cankarso', 'T73', '2010-06'], ['Kondul', 'T74', '2010-06'], ['Kalpeni', 'T75', '2010-10'], ['Kabra', 'T76', '2011-06'],
    ['Koswari', 'T77', '2011-07'], ['Karuva', 'T78', '2011-08'],
  ],
  tihayu: [['Tihayu', 'T93', '2016-10'], ['Tillanchang', 'T92', '2017-03'], ['Tarasa', 'T94', '2017-09']],
  bangaram: [['Bangaram', 'T65', '2006-02'], ['Bitra', 'T66', '2006-03'], ['Batti Malv', 'T67', '2006-07'], ['Baratang', 'T68', '2006-09']],
  jalashwa: [['Jalashwa', 'L41', '2007-06', { notes: 'Ex-USS Trenton (LPD-14).' }]],
  shardul: [['Shardul', 'L16', '2007-01'], ['Kesari', 'L15', '2008'], ['Airavat', 'L24', '2009-05']],
  magar: [['Gharial', 'L23', '1997-02']],
  deepak: [['Deepak', 'A50', '2011-01'], ['Shakti', 'A57', '2011-10']],
  jyoti: [['Jyoti', 'A58', '1996-07']],
  aditya: [['Aditya', 'A59', '2000-04']],
  sandhayakNew: [['Sandhayak', 'J18', '2024-02'], ['Nirdeshak', 'J19', '2024-12'], ['Ikshak', 'J23', '2025-11'], ['Sanshodhak', 'J24', '2026-06']],
  sandhayakOld: [
    ['Investigator', 'J15', '1990-01', { builder: GRSE }], ['Jamuna', 'J16', '1991-08', { builder: GSL }], ['Sutlej', 'J17', '1993-02', { builder: GSL }],
    ['Darshak', 'J21', '2001-04', { builder: GSL }], ['Sarvekshak', 'J22', '2002-01', { builder: GSL }],
  ],
  sagardhwani: [['Sagardhwani', 'A74', '1994-07']],
  tir: [['Tir', 'A86', '1986-02']],
  barque: [['Tarangini', 'A75', '1997-11'], ['Sudarshini', 'A77', '2012-01', { wiki: 'INS_Sudarshini' }]],
  varuna: [['Varuna', '', '1981-04']],
  mhadei: [['INSV Mhadei', '', '2009-02', { wiki: 'INSV_Mhadei' }], ['INSV Tarini', '', '2017-02', { wiki: 'INSV_Tarini' }]],
};

export interface CatalogShip {
  /** stable id, so a user's edits survive catalogue updates */
  id: string;
  name: string;
  pennant: string;
  commissioned: string;
  cls: ClassSpec;
  builder: string;
  status: string;
  notes: string;
  /** Wikipedia titles to try for the picture and description, most specific first */
  wikiCandidates: string[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const CATALOG: CatalogShip[] = Object.entries(SHIPS).flatMap(([key, rows]) =>
  rows.map(([name, pennant, commissioned, extra = {}]): CatalogShip => {
    const cls = CLASSES[key];
    const bare = name.replace(/^INSV? /, '');
    const prefix = /^INSV /.test(name) ? 'INSV' : 'INS';
    return {
      id: `in-${slug(pennant || bare)}-${slug(bare)}`,
      name,
      pennant, commissioned, cls,
      builder: extra.builder ?? cls.builder,
      status: extra.status ?? 'In service',
      notes: extra.notes ?? '',
      wikiCandidates: [
        ...(extra.wiki ? [extra.wiki] : []),
        ...(pennant ? [`${prefix}_${bare.replace(/ /g, '_')}_(${pennant})`] : []),
        `${prefix}_${bare.replace(/ /g, '_')}`,
        cls.wiki,
      ],
    };
  }),
);
