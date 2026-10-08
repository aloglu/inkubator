/** Small builders for unit tests. */
import type { Fill } from './types/Fill';
import type { Ink } from './types/Ink';
import type { Pen } from './types/Pen';

export const DAY = 24 * 60 * 60 * 1000;

export function pen(id: string, model = id): Pen {
  return {
    id,
    brand: 'Brand',
    model,
    color_name: '',
    colors: ['#333333'],
    nib_size: 'F',
    nib_material: '',
    body_material: '',
    filling_systems: [],
    price: null,
    purchased_on: null,
    purchased_from: '',
    notes: '',
    notes_public: false,
    images: [],
    created_at: 0,
    updated_at: 0,
  };
}

export function ink(id: string, name = id, base_color = '#1f3a5f'): Ink {
  return {
    id,
    brand: 'Maker',
    line: '',
    name,
    kind: 'bottle',
    volume_ml: null,
    amount: 1,
    price: null,
    base_color,
    sheen_color: null,
    color_family: null,
    shimmer: 'none',
    sheen: 'none',
    shading: 'none',
    water_resistance: 'none',
    flow: 'average',
    lubrication: 'none',
    dry_time_seconds: null,
    base_types: [],
    paper: [],
    notes: '',
    notes_public: false,
    images: [],
    created_at: 0,
    updated_at: 0,
  };
}

let fills = 0;
/** A fill from day `from` to day `to` (null: still in the pen). */
export function fill(pen_id: string, ink_id: string, from: number, to: number | null): Fill {
  return { id: `fill-${++fills}`, pen_id, ink_id, inked_at: from * DAY, emptied_at: to === null ? null : to * DAY, note: '' };
}
