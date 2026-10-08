import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, clampFocus, cropWindow, resizeFromCorner, turnedRatio } from './crop';

describe('cropWindow', () => {
  it('spans the full height of a wide photo and part of its width', () => {
    const w = cropWindow(16 / 9, 3, 1);
    expect(w.height).toBe(1);
    expect(w.width).toBeCloseTo(16 / 9 / 3);
  });

  it('spans the full width of a tall photo, and shrinks with zoom', () => {
    expect(cropWindow(16 / 9, 3 / 4, 1)).toEqual({ width: 1, height: (3 / 4) / (16 / 9) });
    expect(cropWindow(16 / 9, 3 / 4, 2).width).toBe(0.5);
  });
});

describe('clampFocus', () => {
  it('keeps the window on the photo', () => {
    expect(clampFocus({ x: 0, y: 0.5 }, { width: 0.4, height: 1 })).toEqual({ x: 0.2, y: 0.5 });
    expect(clampFocus({ x: 0.9, y: 0.95 }, { width: 0.4, height: 0.5 })).toEqual({ x: 0.8, y: 0.75 });
  });
});

describe('turnedRatio', () => {
  it('swaps sides for quarter turns', () => {
    expect(turnedRatio(1200, 1600, 0)).toBe(0.75);
    expect(turnedRatio(1200, 1600, 90)).toBeCloseTo(4 / 3);
    expect(turnedRatio(1200, 1600, 180)).toBe(0.75);
  });
});

describe('resizeFromCorner', () => {
  // A 16:9 frame on a 16:9 photo: the full window is the whole photo.
  const full = { width: 1, height: 1 };

  it('keeps the opposite corner in place while the window shrinks', () => {
    const result = resizeFromCorner({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 0.5 }, full);
    expect(result.zoom).toBeCloseTo(2);
    expect(result.focus.x).toBeCloseTo(0.25);
    expect(result.focus.y).toBeCloseTo(0.25);
  });

  it('follows whichever way the pointer moved further, keeping the shape', () => {
    const result = resizeFromCorner({ x: 1, y: 1 }, { x: -1, y: -1 }, { x: 0.8, y: 0.4 }, full);
    expect(result.zoom).toBeCloseTo(1 / 0.6);
  });

  it('never grows past the photo or zooms in beyond the limit', () => {
    const anchor = { x: 0.6, y: 0.6 };
    const grown = resizeFromCorner(anchor, { x: 1, y: 1 }, { x: 2, y: 2 }, { width: 0.5, height: 0.5 });
    expect(grown.zoom).toBeCloseTo(0.5 / 0.4);
    expect(grown.focus.x + 0.5 / grown.zoom / 2).toBeCloseTo(1);
    const tiny = resizeFromCorner({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }, full);
    expect(tiny.zoom).toBe(MAX_ZOOM);
  });
});
