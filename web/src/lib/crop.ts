/**
 * Crop geometry shared by the crop tool and PhotoFrame's cover mode. All
 * values are fractions of the rotated photo: (0, 0) top left, (1, 1) bottom right.
 */

/** Width and height of the visible window for a frame of `ratio` (w/h). */
export function cropWindow(ratio: number, photoRatio: number, zoom: number): { width: number; height: number } {
  return {
    width: Math.min(1, ratio / photoRatio) / zoom,
    height: Math.min(1, photoRatio / ratio) / zoom,
  };
}

/** Keeps the window's centre where the whole window stays on the photo. */
export function clampFocus(
  focus: { x: number; y: number },
  window: { width: number; height: number },
): { x: number; y: number } {
  const clamp = (value: number, size: number) => Math.min(1 - size / 2, Math.max(size / 2, value));
  return { x: clamp(focus.x, window.width), y: clamp(focus.y, window.height) };
}

/** Photo width / height after turning it by `rotation` degrees. */
export function turnedRatio(width: number, height: number, rotation: number): number {
  return rotation === 90 || rotation === 270 ? height / width : width / height;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * Resizes the window by one corner while the opposite corner (`anchor`) stays
 * put, keeping the frame's shape. `corner` is the dragged corner's direction
 * from the anchor (±1 each way); `full` is the window at zoom 1. The window
 * never grows past the photo's edges.
 */
export function resizeFromCorner(
  anchor: { x: number; y: number },
  corner: { x: 1 | -1; y: 1 | -1 },
  pointer: { x: number; y: number },
  full: { width: number; height: number },
): { zoom: number; focus: { x: number; y: number } } {
  const across = Math.max(0, (pointer.x - anchor.x) * corner.x);
  const down = Math.max(0, (pointer.y - anchor.y) * corner.y);
  const roomX = corner.x > 0 ? 1 - anchor.x : anchor.x;
  const roomY = corner.y > 0 ? 1 - anchor.y : anchor.y;
  const smallest = Math.max(MIN_ZOOM, full.width / roomX, full.height / roomY);
  const wanted = 1 / Math.max(across / full.width, down / full.height, 1e-6);
  const zoom = Math.min(MAX_ZOOM, Math.max(smallest, wanted));
  return {
    zoom,
    focus: {
      x: anchor.x + (corner.x * full.width) / zoom / 2,
      y: anchor.y + (corner.y * full.height) / zoom / 2,
    },
  };
}
