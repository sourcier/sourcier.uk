export interface CoverFocalPoint {
  x: number;
  y: number;
}

/**
 * Derives a CSS `object-position` value from a cover image's focal point.
 * Falls back to a centered position when no focal point is set, so existing
 * covers without one keep their previous (centered) crop.
 */
export function coverObjectPosition(focalPoint?: CoverFocalPoint): string {
  if (!focalPoint) return "50% 50%";
  const x = Math.round(focalPoint.x * 100);
  const y = Math.round(focalPoint.y * 100);
  return `${x}% ${y}%`;
}
