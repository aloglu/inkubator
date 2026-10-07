import { describe, expect, it } from 'vitest';
import { dryTime, hueKey, properties, summary, swabSheen } from './ink';
import { ink } from './test-data';

describe('summary', () => {
  it('lists what stands out, leaving out average and absent properties', () => {
    const plain = { ...ink('a'), volume_ml: 50 };
    expect(summary(plain)).toBe('50 ml');
    const loud = { ...plain, shimmer: 'gold' as const, sheen: 'monster' as const, water_resistance: 'waterproof' as const, flow: 'wet' as const };
    expect(summary(loud)).toBe('50 ml · Gold shimmer · Monster sheen · Waterproof');
    expect(summary(loud, 6)).toBe('50 ml · Gold shimmer · Monster sheen · Waterproof · Wet flow');
  });
});

describe('properties', () => {
  it('keeps the planned order', () => {
    expect(properties(ink('a'), 'USD').map((row) => row.label)).toEqual([
      'Volume', 'Shimmer', 'Sheen', 'Shading', 'Water resistance', 'Flow', 'Dry time',
      'Lubrication', 'Base', 'On paper', 'Type', 'Price',
    ]);
  });

  it('shows the amount only when there is more than one', () => {
    const type = (amount: number) => properties({ ...ink('a'), amount }, 'USD').find((row) => row.label === 'Type')?.value;
    expect(type(1)).toBe('Bottle');
    expect(type(2)).toBe('Bottle × 2');
  });
});

describe('swabSheen', () => {
  it('draws the sheen color only for inks marked as sheening', () => {
    expect(swabSheen({ sheen: 'none', sheen_color: '#ff0000' })).toBeNull();
    expect(swabSheen({ sheen: 'low', sheen_color: '#ff0000' })).toBe('#ff0000');
    expect(swabSheen({ sheen: 'high', sheen_color: null })).toBeNull();
  });
});

describe('dryTime', () => {
  it('reads naturally', () => {
    expect(dryTime(null)).toBeNull();
    expect(dryTime(30)).toBe('30 s');
    expect(dryTime(140)).toBe('2 min 20 s');
    expect(dryTime(120)).toBe('2 min');
  });
});

describe('hueKey', () => {
  it('keeps reds on both sides of 0° together', () => {
    const deepRed = hueKey('#8a1020'); // just below 360°
    const orangeRed = hueKey('#b03010'); // just above 0°
    const yellow = hueKey('#d9a400');
    expect(Math.abs(deepRed - orangeRed)).toBeLessThan(40);
    expect(yellow).toBeGreaterThan(orangeRed);
  });
});
