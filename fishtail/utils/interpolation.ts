
import { TurningDataPoint } from '../types';

export const interpolateData = (
  targetHeading: number,
  tableSubset: TurningDataPoint[]
): { advance: number; transfer: number; time: number } => {
  if (tableSubset.length === 0) {
    throw new Error("Target turning table is empty.");
  }

  // Sort by heading
  const sorted = [...tableSubset].sort((a, b) => a.heading - b.heading);

  // Use absolute value of heading for lookup (symmetry assumed in typical turning circle tables)
  const normalizedHeading = Math.abs(targetHeading);

  // Find surrounding points
  let low = sorted[0];
  let high = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].heading <= normalizedHeading) {
      low = sorted[i];
    }
    if (sorted[i].heading >= normalizedHeading) {
      high = sorted[i];
      break;
    }
  }

  if (low.heading === high.heading) {
    return { 
      advance: low.advance, 
      transfer: low.transfer, 
      time: low.time 
    };
  }

  const fraction = (normalizedHeading - low.heading) / (high.heading - low.heading);

  return {
    advance: low.advance + fraction * (high.advance - low.advance),
    transfer: low.transfer + fraction * (high.transfer - low.transfer),
    time: low.time + fraction * (high.time - low.time)
  };
};
