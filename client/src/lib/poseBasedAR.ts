import * as THREE from 'three';

/**
 * Calculate ray-plane intersection for pose-based AR
 */
export function rayPlaneIntersection(
  ray: THREE.Ray,
  plane: THREE.Plane
): THREE.Vector3 | null {
  const target = new THREE.Vector3();
  const intersect = ray.intersectPlane(plane, target);
  return intersect;
}

/**
 * Create a floor plane from ceiling height and gravity-aligned space
 * Assumes user is standing and looking roughly parallel to the floor
 */
export function createFloorPlane(ceilingHeightFeet: number, viewerY: number): THREE.Plane {
  // Convert ceiling height from feet to meters
  const ceilingHeightMeters = ceilingHeightFeet * 0.3048;
  
  // Floor is below viewer by (ceiling height - viewer's eye height)
  // Assume average eye height of 1.6m when standing
  const assumedEyeHeight = 1.6;
  const floorY = viewerY - assumedEyeHeight;
  
  // Create horizontal plane at floor level (normal pointing up)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
  
  return plane;
}

/**
 * Get camera ray from screen tap position
 */
export function getCameraRay(
  camera: THREE.Camera,
  tapX: number,
  tapY: number,
  viewportWidth: number,
  viewportHeight: number
): THREE.Ray {
  // Convert screen coordinates to normalized device coordinates (-1 to 1)
  const x = (tapX / viewportWidth) * 2 - 1;
  const y = -(tapY / viewportHeight) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  
  return raycaster.ray;
}

/**
 * Calibrate floor plane from first tap
 */
export function calibrateFloorPlaneFromTap(
  camera: THREE.Camera,
  tapPosition: THREE.Vector3,
  ceilingHeightFeet: number
): THREE.Plane {
  // Use the tap position's Y coordinate as the floor level
  const floorY = tapPosition.y;
  
  // Create horizontal plane at that level
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
  
  return plane;
}
