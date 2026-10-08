/** Activity entries and their changes, in words. */
import { familyName } from './color';
import { formatDate, fromDateInput } from './format';
import {
  baseTypes,
  dryTime,
  flows,
  kinds,
  label,
  levels,
  money,
  paperBehaviors,
  sheens,
  shimmers,
  waterResistances,
} from './ink';
import type { ActivityEntry } from './types/ActivityEntry';
import type { Change } from './types/Change';
import type { ColorFamily } from './types/ColorFamily';
import type { DateFormat } from './types/DateFormat';
import type { JsonValue } from './types/serde_json/JsonValue';
import type { Subject } from './types/Subject';

/** A value as shown: text, or a color drawn as a dot. */
export type Shown = { text: string } | { color: string };

export type ChangeLine = { label: string; before?: Shown; after?: Shown };

export type Context = {
  currency: string;
  dateFormat: DateFormat;
  /** Ink names by id, for swatches moved to another ink. */
  inkName: (id: string) => string | undefined;
};

const fieldNames: Record<Subject, Record<string, string>> = {
  pen: {
    brand: 'Brand',
    model: 'Model',
    color_name: 'Finish',
    colors: 'Body colors',
    nib_size: 'Nib size',
    nib_material: 'Nib material',
    body_material: 'Body material',
    filling_systems: 'Filling',
    price: 'Price',
    purchased_on: 'Bought',
    purchased_from: 'Bought from',
    notes: 'Notes',
    notes_public: 'Notes shown to visitors',
    images: 'Photos',
  },
  ink: {
    brand: 'Brand',
    line: 'Line',
    name: 'Name',
    kind: 'Type',
    volume_ml: 'Volume',
    amount: 'Amount',
    price: 'Price',
    base_color: 'Color',
    sheen_color: 'Sheen color',
    color_family: 'Shelf group',
    shimmer: 'Shimmer',
    sheen: 'Sheen',
    shading: 'Shading',
    water_resistance: 'Water resistance',
    flow: 'Flow',
    lubrication: 'Lubrication',
    dry_time_seconds: 'Dry time',
    base_types: 'Base',
    paper: 'On paper',
    notes: 'Notes',
    notes_public: 'Notes shown to visitors',
    images: 'Photos',
  },
  swatch: {
    ink_id: 'Ink',
    paper: 'Paper',
    nib: 'Nib',
    sampled_on: 'Date',
    notes: 'Notes',
    notes_public: 'Notes shown to visitors',
    images: 'Photos',
  },
};

export function fieldName(subject: Subject, field: string): string {
  return fieldNames[subject][field] ?? field.replaceAll('_', ' ');
}

const none: Shown = { text: 'None' };

/** One stored value in the words the interface uses elsewhere. */
export function showValue(subject: Subject, field: string, value: JsonValue, ctx: Context): Shown {
  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) return none;
  const one = <T extends string>(options: readonly { value: T; label: string }[]) => ({ text: label(options, value as T) });
  const many = <T extends string>(options: readonly { value: T; label: string }[]) => ({
    text: (value as T[]).map((v) => label(options, v)).join(', '),
  });
  switch (field) {
    case 'price':
      return { text: money(value as number, ctx.currency) ?? '' };
    case 'volume_ml':
      return { text: `${value} ml` };
    case 'dry_time_seconds':
      return { text: dryTime(value as number) ?? '' };
    case 'base_color':
    case 'sheen_color':
      return { color: String(value) };
    case 'colors':
    case 'filling_systems':
      return { text: (value as string[]).join(', ') };
    case 'color_family':
      return { text: familyName(value as ColorFamily) };
    case 'kind':
      return one(kinds);
    case 'shimmer':
      return one(shimmers);
    case 'sheen':
      return one(sheens);
    case 'shading':
    case 'lubrication':
      return one(levels);
    case 'water_resistance':
      return one(waterResistances);
    case 'flow':
      return one(flows);
    case 'base_types':
      return many(baseTypes);
    case 'paper':
      return subject === 'ink' ? many(paperBehaviors) : { text: String(value) };
    case 'notes_public':
      return { text: value ? 'Shown' : 'Private' };
    case 'ink_id':
      return { text: ctx.inkName(String(value)) ?? 'a deleted ink' };
    case 'sampled_on':
    case 'purchased_on': {
      const text = String(value);
      const ms = fromDateInput(text.length === 7 ? `${text}-01` : text);
      if (ms === null) return { text };
      return {
        text:
          text.length === 7
            ? new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
            : formatDate(ms, ctx.dateFormat),
      };
    }
    default:
      return { text: typeof value === 'string' ? value : JSON.stringify(value) };
  }
}

export function changeLine(subject: Subject, change: Change, ctx: Context): ChangeLine {
  const line: ChangeLine = { label: fieldName(subject, change.field) };
  if (change.values) {
    line.before = showValue(subject, change.field, change.values[0], ctx);
    line.after = showValue(subject, change.field, change.values[1], ctx);
  }
  return line;
}

/** The verb that leads an entry's sentence, e.g. "Inked" or "Added a swatch". */
export function verb(entry: Pick<ActivityEntry, 'subject' | 'action'>): string {
  if (entry.subject === 'swatch') {
    return { created: 'Added a swatch', updated: 'Edited a swatch', deleted: 'Deleted a swatch' }[
      entry.action as 'created' | 'updated' | 'deleted'
    ] ?? 'Changed a swatch';
  }
  return {
    created: 'Added',
    updated: 'Edited',
    deleted: 'Deleted',
    inked: 'Inked',
    reinked: 'Re-inked',
    flushed: 'Flushed',
  }[entry.action];
}
