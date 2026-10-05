
export interface ShipParticulars {
  lengthOverall: number;
  breadthOverall: number;
  displacement: number;
  stemToStandard: number;
  stemToBridge: number;
  stemToRas: number;
  stemToFueling: number;
}

export interface TurningDataRow {
  id: string;
  turnAmount: number;
  bearingMob: number;
  angle: number;
  rangeCables: number;
  rangeYards: number;
  transfer: number;
  advance: number;
  distToNewCourse: number;
  time: string;
  speed: number | string;
}

export interface TurningDataSet {
  wheelAngle: number;
  testSpeed: number;
  turnSide: 'Port' | 'Starboard';
  data: TurningDataRow[];
  initialHead?: number;
}

export interface SimpleRecord {
  id: string;
  date: string;
  description: string;
  value?: string;
  /** Raw form entries, kept so the record can be edited. Absent on records made before editing existed. */
  fields?: Record<string, string>;
}

/** A particular or detail the user added beyond the built-in ones: their own heading and value. */
export interface CustomField {
  id: string;
  /** 'particulars' are measurements shown with the ship's particulars (with a unit); 'details' are text shown with her details */
  group: 'particulars' | 'details';
  label: string;
  value: string;
  unit?: string;
}

/** Descriptive details. All free text so they can be edited; blank means unknown. */
export interface ShipInfo {
  shipClass: string;
  pennant: string;
  builder: string;
  /** "YYYY-MM" or "YYYY" when pre-filled; the user may type anything */
  commissioned: string;
  status: string;
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
  notes: string;
  /** comma-separated Wikipedia article titles to try for the picture and description */
  wiki: string;
}

export interface Ship {
  id: string;
  name: string;
  type: string;
  particulars: ShipParticulars;
  turningDataSets: TurningDataSet[];
  accelDecelData: SimpleRecord[];
  fishtails: SimpleRecord[];
  emLogCalibration: SimpleRecord[];
  compassSwing: SimpleRecord[];
  info?: ShipInfo;
  /** extra particulars and details the user has added */
  custom?: CustomField[];
  /** the user's own photo (small JPEG data URL), shown in preference to the online picture */
  photo?: string;
  /** set for ships that came from the built-in Indian Navy catalogue */
  catalog?: boolean;
}

export type AppView = 'home' | 'select' | 'add' | 'details' | 'particulars_form' | 'turning_data_form' | 'record_form' | 'fishtail_calc' | 'ship_info_form';
