/**
 * AR measurement utilities and rounding logic
 */

export type RoundingPreference = 'precise' | '2inch' | '6inch' | '1foot';
export type RoundingDirection = 'up' | 'down';

/**
 * Applies rounding to a measurement in feet
 */
export function applyRounding(
  value: number,
  preference: RoundingPreference,
  direction: RoundingDirection
): number {
  if (preference === 'precise') {
    return Math.round(value * 10) / 10; // Round to 0.1 ft
  }

  // Convert preference to feet
  const roundingIncrements: Record<Exclude<RoundingPreference, 'precise'>, number> = {
    '2inch': 2 / 12, // 0.1667 ft
    '6inch': 6 / 12, // 0.5 ft
    '1foot': 1,
  };

  const increment = roundingIncrements[preference];
  
  if (direction === 'up') {
    return Math.ceil(value / increment) * increment;
  } else {
    return Math.floor(value / increment) * increment;
  }
}

/**
 * Calculates distance between two 3D points in meters
 */
export function calculateDistance(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Converts meters to feet
 */
export function metersToFeet(meters: number): number {
  return meters * 3.28084;
}

/**
 * Converts feet to meters
 */
export function feetToMeters(feet: number): number {
  return feet / 3.28084;
}
