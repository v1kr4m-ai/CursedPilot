
import { CalculationResult } from '../types';

/**
 * NAVAL MANEUVER ENGINE - FISHTAIL LOGIC (STRICT ADHERENCE)
 * 1. Plot Advance along current ship's head.
 * 2. Plot Transfer perpendicular (90 deg) to the advance line.
 * 3. Update ship's head AFTER the turn (Adv+Trans) is complete.
 * 4. Guide Distance based on speed-time physics over the total duration.
 */
export const calculateManeuverLocally = (
  angles: number[],
  legData: Array<{ advance: number; transfer: number; time: number }>,
  guideSpeed: number
): CalculationResult => {
  let currentX = 0;
  let currentY = 0;
  let currentHeading = 0; // Degrees (000 is North / +Y)
  let totalTime = 0;
  
  const trackPoints: Array<{ x: number; y: number; heading: number; advance: number; transfer: number; time: number; turnAngle?: number }> = [
    { x: 0, y: 0, heading: 0, advance: 0, transfer: 0, time: 0, turnAngle: 0 }
  ];

  const cornerPoints: Array<{ x: number; y: number; label?: string; type: 'advance' | 'transfer' | 'start'; headingAtStep?: number }> = [
    { x: 0, y: 0, type: 'start', headingAtStep: 0 }
  ];

  for (let i = 0; i < angles.length; i++) {
    const deltaTheta = angles[i];
    const { advance, transfer, time } = legData[i];
    
    // Ship's head used for this leg is the heading from the PREVIOUS turn (starts at 000)
    const hRad = (currentHeading * Math.PI) / 180;
    
    // STEP 1: ADVANCE
    // Plotted in the direction of the current ship's head
    const fx = Math.sin(hRad);
    const fy = Math.cos(hRad);
    
    const advX = currentX + (advance * fx);
    const advY = currentY + (advance * fy);
    
    cornerPoints.push({ 
      x: advX, 
      y: advY, 
      type: 'advance', 
      label: `Adv ${i + 1}: ${Math.round(advance)}y`,
      headingAtStep: currentHeading
    });

    // STEP 2: TRANSFER
    // Plotted 90 degrees perpendicular to the line of advance
    // Starboard turn (deltaTheta > 0): Transfer +90 deg from current head
    // Port turn (deltaTheta < 0): Transfer -90 deg from current head
    const sideFactor = deltaTheta >= 0 ? 1 : -1;
    const transRad = ((currentHeading + (sideFactor * 90)) * Math.PI) / 180;
    
    const nx = Math.sin(transRad);
    const ny = Math.cos(transRad);
    
    const trX = advX + (transfer * nx);
    const trY = advY + (transfer * ny);
    
    // Update heading ONLY AFTER this turn segment is finished
    let newHeading = (currentHeading + deltaTheta) % 360;
    if (newHeading < 0) newHeading += 360;

    cornerPoints.push({ 
      x: trX, 
      y: trY, 
      type: 'transfer', 
      label: `Tr ${i + 1}: ${Math.round(transfer)}y`,
      headingAtStep: newHeading
    });

    // Update global state for next turn leg
    currentX = trX;
    currentY = trY;
    currentHeading = newHeading;
    totalTime += time;
    
    trackPoints.push({
      x: currentX,
      y: currentY,
      heading: currentHeading,
      advance,
      transfer,
      time,
      turnAngle: deltaTheta
    });
  }

  // GUIDE SHIP PHYSICS
  // Guide moves at constant speed on base course (000) for the total maneuver time
  // 1 knot = 2025 yards per hour (standard tactical precision)
  const guideDistance = (guideSpeed * 2025 / 3600) * totalTime;
  
  // DROP DISTANCE: Difference in Y-axis between Guide and Own Ship Final
  const dropDistance = guideDistance - currentY;
  
  // LATERAL SEPARATION: Magnitude of X-axis displacement from start
  const lateralSeparation = Math.abs(currentX);

  return {
    final_position: { x: currentX, y: currentY },
    guide_distance: guideDistance,
    drop_distance: dropDistance,
    lateral_separation: lateralSeparation,
    track_points: trackPoints,
    corner_points: cornerPoints,
    total_time: totalTime
  };
};
