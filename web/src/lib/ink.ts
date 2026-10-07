/** Words for ink properties, in the order the plan sets for details and filters. */
import { hsl } from './color';
import type { BaseType } from './types/BaseType';
import type { Flow } from './types/Flow';
import type { Ink } from './types/Ink';
import type { InkKind } from './types/InkKind';
import type { Level } from './types/Level';
import type { PaperBehavior } from './types/PaperBehavior';
import type { Sheen } from './types/Sheen';
import type { Shimmer } from './types/Shimmer';
import type { WaterResistance } from './types/WaterResistance';

type Options<T extends string> = readonly { value: T; label: string }[];

export const kinds: Options<InkKind> = [
  { value: 'bottle', label: 'Bottle' },
  { value: 'sample', label: 'Sample' },
  { value: 'cartridge', label: 'Cartridge' },
  { value: 'other', label: 'Other' },
];

export const shimmers: Options<Shimmer> = [
  { value: 'none', label: 'None' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'multiple', label: 'Multiple' },
  { value: 'other', label: 'Other' },
];

export const sheens: Options<Sheen> = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'monster', label: 'Monster' },
];

export const levels: Options<Level> = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const flows: Options<Flow> = [
  { value: 'very_dry', label: 'Very dry' },
  { value: 'dry', label: 'Dry' },
  { value: 'average', label: 'Average' },
  { value: 'wet', label: 'Wet' },
  { value: 'very_wet', label: 'Very wet' },
];

export const waterResistances: Options<WaterResistance> = [
  { value: 'none', label: 'None' },
  { value: 'water_resistant', label: 'Water resistant' },
  { value: 'waterproof', label: 'Waterproof' },
  { value: 'archival', label: 'Archival' },
];

export const baseTypes: Options<BaseType> = [
  { value: 'dye', label: 'Dye' },
  { value: 'pigment', label: 'Pigment' },
  { value: 'iron_gall', label: 'Iron gall' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'scented', label: 'Scented' },
];

export const paperBehaviors: Options<PaperBehavior> = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'average', label: 'Average' },
  { value: 'feathering', label: 'Feathering' },
  { value: 'bleeding', label: 'Bleeding' },
  { value: 'show_through', label: 'Show-through' },
];

export function label<T extends string>(options: Options<T>, value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** The sheen color to draw, only when the ink is marked as sheening. */
export const swabSheen = (ink: Pick<Ink, 'sheen' | 'sheen_color'>) => (ink.sheen === 'none' ? null : ink.sheen_color);

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export const volume = (ink: Pick<Ink, 'volume_ml'>) => (ink.volume_ml === null ? null : `${number(ink.volume_ml)} ml`);

export function dryTime(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 90) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function money(amount: number | null, currency: string): string | null {
  if (amount === null) return null;
  try {
    return amount.toLocaleString(undefined, { style: 'currency', currency });
  } catch {
    return `${number(amount)} ${currency}`;
  }
}

/**
 * A short line of what stands out about an ink, e.g. "50 ml · Gold shimmer ·
 * High sheen · Waterproof". Average and absent properties are left out.
 */
export function summary(ink: Ink, max = 4): string {
  const parts = [
    volume(ink),
    ink.shimmer === 'none' ? null : `${label(shimmers, ink.shimmer)} shimmer`,
    ink.sheen === 'none' ? null : `${label(sheens, ink.sheen)} sheen`,
    ink.shading === 'none' ? null : `${label(levels, ink.shading)} shading`,
    ink.water_resistance === 'none' ? null : label(waterResistances, ink.water_resistance),
    ink.flow === 'average' ? null : `${label(flows, ink.flow)} flow`,
  ];
  return parts
    .filter((part): part is string => part !== null)
    .slice(0, max)
    .join(' · ');
}

/** Detail rows in the planned order: volume, shimmer, sheen, shading, water resistance, flow, dry time, then the rest. */
export function properties(ink: Ink, currency: string): { label: string; value: string | null }[] {
  const list = (values: string[]) => (values.length ? values.join(', ') : null);
  return [
    { label: 'Volume', value: volume(ink) },
    { label: 'Shimmer', value: label(shimmers, ink.shimmer) },
    { label: 'Sheen', value: label(sheens, ink.sheen) },
    { label: 'Shading', value: label(levels, ink.shading) },
    { label: 'Water resistance', value: label(waterResistances, ink.water_resistance) },
    { label: 'Flow', value: label(flows, ink.flow) },
    { label: 'Dry time', value: dryTime(ink.dry_time_seconds) },
    { label: 'Lubrication', value: label(levels, ink.lubrication) },
    { label: 'Base', value: list(ink.base_types.map((value) => label(baseTypes, value))) },
    { label: 'On paper', value: list(ink.paper.map((value) => label(paperBehaviors, value))) },
    { label: 'Type', value: `${label(kinds, ink.kind)}${ink.amount > 1 ? ` × ${ink.amount}` : ''}` },
    { label: 'Price', value: money(ink.price, currency) },
  ];
}

/** Sort key for hue order inside a color family; reds that wrap past 360° stay together. */
export function hueKey(hex: string): number {
  const { h, l } = hsl(hex);
  return ((h + 15) % 360) + (1 - l);
}
