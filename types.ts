
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
}

export type AppView = 'home' | 'select' | 'add' | 'details' | 'particulars_form' | 'turning_data_form' | 'record_form';
