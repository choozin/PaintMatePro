import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getContrastColor(hexColor: string): 'black' | 'white' {
  // Remove hash if present
  const hex = hexColor.replace('#', '');

  // Parse r, g, b
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate YIQ luminance
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  // Return black for bright colors, white for dark colors
  return (yiq >= 128) ? 'black' : 'white';
}
