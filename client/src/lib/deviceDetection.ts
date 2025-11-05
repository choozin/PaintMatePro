/**
 * Device detection utilities for AR feature compatibility
 */

/**
 * Detects if the current device is running iOS
 * Checks both iPhone/iPad and iPod devices
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  
  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPad on iOS 13+
  );
}

/**
 * Detects if the current device is running Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return /android/i.test(navigator.userAgent);
}

/**
 * Checks if WebXR is supported in the current browser
 * WebXR is required for AR camera scanning on Android
 */
export async function isWebXRSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('xr' in navigator)) {
    return false;
  }

  try {
    const xr = (navigator as any).xr;
    if (xr && typeof xr.isSessionSupported === 'function') {
      return await xr.isSessionSupported('immersive-ar');
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if AR scanning is available on the current device
 * Currently only supported on Android with WebXR
 */
export async function isARScanningAvailable(): Promise<boolean> {
  if (isIOS()) {
    return false; // iOS support coming with LiDAR upgrade
  }

  if (!isAndroid()) {
    return false;
  }

  return await isWebXRSupported();
}
