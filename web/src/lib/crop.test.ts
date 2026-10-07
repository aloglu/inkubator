import { describe, expect, it } from 'vitest';
import { clampFocus, cropWindow, turnedRatio } from './crop';

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
