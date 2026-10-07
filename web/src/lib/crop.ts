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
