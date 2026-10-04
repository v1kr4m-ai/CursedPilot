
export enum ManeuverType {
  HALF = 'half_fishtail',
  FULL = 'full_fishtail',
  DISTORTED = 'distorted_fishtail'
}

export enum SideOfTurn {
  STARBOARD = 'starboard',
  PORT = 'port'
}

export const STATION_PRESETS = [
  { name: 'Ahead (000°)', bearing: 0 },
  { name: 'Bow STBD (045°)', bearing: 45 },
  { name: 'Abeam STBD (090°)', bearing: 90 },
  { name: 'Quarter STBD (135°)', bearing: 135 },
  { name: 'Astern (180°)', bearing: 180 },
  { name: 'Quarter Port (225°)', bearing: 225 },
  { name: 'Abeam Port (270°)', bearing: 270 },
  { name: 'Bow Port (315°)', bearing: 315 },
  { name: 'Custom Bearing', bearing: -1 }
];

export interface TurningDataPoint {
  id: string;
  tableName: string;
  heading: number; // degrees
  advance: number; // yards
  transfer: number; // yards
  time: number;    // seconds
  ownSpeed: number; // knots
  rudder: string;   // rudder angle
  side: SideOfTurn; // Port/Starboard
}

export interface CalculationResult {
  final_position: { x: number; y: number };
  guide_distance: number;
  drop_distance: number;
  lateral_separation: number;
  track_points: Array<{ 
    x: number; 
    y: number; 
    heading: number; 
    advance: number; 
    transfer: number;
    time: number; 
    turnAngle?: number;
  }>;
  // Added headingAtStep to corner_points items to match the output of the maneuver engine and support visualization
  corner_points: Array<{ 
    x: number; 
    y: number; 
    label?: string; 
    type: 'advance' | 'transfer' | 'start';
    headingAtStep?: number;
  }>;
  total_time: number;
}
