
import { Ship } from './types';

export const INITIAL_SHIPS: Ship[] = [
  {
    id: '1',
    name: 'HMS Vanguard',
    type: 'Destroyer',
    particulars: {
      lengthOverall: 152.4,
      breadthOverall: 21.2,
      displacement: 8500,
      stemToStandard: 45.5,
      stemToBridge: 38.2,
      stemToRas: 60.1,
      stemToFueling: 75.4
    },
    turningDataSets: [
      {
        wheelAngle: 15,
        testSpeed: 12,
        turnSide: 'Port',
        initialHead: 180,
        data: [
          { 
            id: 't1', 
            turnAmount: 15, 
            bearingMob: 15, 
            angle: 15, 
            rangeCables: 2.33, 
            rangeYards: 466, 
            transfer: 120, 
            advance: 450, 
            distToNewCourse: 0,
            time: '01:45', 
            speed: 12 
          }
        ]
      }
    ],
    accelDecelData: [{ id: 'a1', date: '2023-10-01', description: 'Sea trials acceleration test', value: '0-20kts in 120s' }],
    fishtails: [{ id: 'f1', date: '2023-10-02', description: 'Maneuverability exercise', value: 'Success' }],
    emLogCalibration: [{ id: 'e1', date: '2023-11-15', description: 'Annual Calibration', value: '+0.2kts offset' }],
    compassSwing: [{ id: 'c1', date: '2024-01-20', description: 'Degaussing check', value: 'Residual deviation < 1 deg' }]
  },
  {
    id: '2',
    name: 'SS Oceanic Explorer',
    type: 'Research Vessel',
    particulars: {
      lengthOverall: 95.0,
      breadthOverall: 18.5,
      displacement: 4200,
      stemToStandard: 28.0,
      stemToBridge: 25.5,
      stemToRas: 35.0,
      stemToFueling: 40.0
    },
    turningDataSets: [],
    accelDecelData: [],
    fishtails: [],
    emLogCalibration: [],
    compassSwing: []
  }
];
