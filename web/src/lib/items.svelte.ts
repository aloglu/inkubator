/**
 * Addresses of pens', inks' and swatches' panels. A panel opens over whatever
 * page is showing (?pen=<id>, ?ink=<id>, ?swatch=<id>, &edit, ?new=<kind>), so
 * following a link from one item to another never leaves the page.
 */
import { router } from './router.svelte';
import { collection } from './stores/collection.svelte';

export type ItemKind = 'pen' | 'ink' | 'swatch';

/** Whether this viewer may open that kind of item: always when signed in, else as the Visitors settings allow. */
export function canOpen(kind: ItemKind): boolean {
  const showcase = collection.data?.settings.showcase;
  const shown = { pen: showcase?.show_pens, ink: showcase?.show_inks, swatch: showcase?.show_swatches }[kind];
  return collection.canEdit || !!shown;
}

type Item = { kind: ItemKind; id: string };
const kinds: readonly ItemKind[] = ['pen', 'ink', 'swatch'];
/** Panels followed from one to the next keep the way back, at most this many steps. */
const TRAIL_LIMIT = 8;

/** The item whose panel is open now, if any. */
function current(): Item | null {
  for (const kind of kinds) {
    const id = router.query.get(kind);
    if (id) return { kind, id };
  }
  return null;
}

/** The panels before this one, oldest first (`&back=pen:<id>,ink:<id>`). */
function trail(): Item[] {
  return (router.query.get('back') ?? '')
    .split(',')
    .map((step) => {
      const at = step.indexOf(':');
      const kind = step.slice(0, at) as ItemKind;
      return kinds.includes(kind) ? { kind, id: step.slice(at + 1) } : null;
    })
    .filter((item): item is Item => item !== null && item.id !== '');
}

function address(item: Item, steps: Item[], editing = false): string {
  const back = steps.map((step) => `${step.kind}:${step.id}`).join(',');
  return `${router.path}?${item.kind}=${encodeURIComponent(item.id)}${editing ? '&edit' : ''}${back ? `&back=${encodeURIComponent(back)}` : ''}`;
}

/**
 * An item's panel on the current page; opens the editor when asked, or when
 * "Open items in edit mode" is on. Followed from another item's panel, the
 * way back to that panel comes along; going to an item already on the way
 * back cuts the way back there, so following links in a circle never piles up.
 */
export function itemHref(kind: ItemKind, id: string, { edit }: { edit?: boolean } = {}): string {
  const editing = edit ?? (collection.canEdit && !!collection.data?.settings.open_items_in_edit_mode);
  const target = { kind, id };
  const from = current();
  let steps: Item[] = [];
  if (from && from.kind === kind && from.id === id) steps = trail();
  else if (from) steps = [...trail(), from];
  const seen = steps.findIndex((step) => step.kind === kind && step.id === id);
  if (seen >= 0) steps = steps.slice(0, seen);
  return address(target, steps.slice(-TRAIL_LIMIT), editing);
}

function itemName(item: Item): string | null {
  const data = collection.data;
  if (!data) return null;
  if (item.kind === 'pen') {
    const pen = data.pens.find((p) => p.id === item.id);
    return pen ? [pen.brand, pen.model].filter(Boolean).join(' ') : null;
  }
  const inkId = item.kind === 'ink' ? item.id : data.swatches.find((s) => s.id === item.id)?.ink_id;
  const ink = data.inks.find((i) => i.id === inkId);
  if (!ink) return null;
  return item.kind === 'ink' ? ink.name : `${ink.name} swatch`;
}

/** The way back to the panel this one was opened from, if any. */
export function panelBack(): { href: string; label: string } | null {
  const steps = trail();
  const last = steps.at(-1);
  const label = last && itemName(last);
  return last && label ? { href: address(last, steps.slice(0, -1)), label } : null;
}

/** The editor for a new item on the current page; a new swatch can start with an ink (`forInk`). */
export function newHref(kind: ItemKind, forInk?: string): string {
  return `${router.path}?new=${kind}${forInk ? `&for=${encodeURIComponent(forInk)}` : ''}`;
}

/** Closes any panel, staying on the page. */
export function closePanel() {
  router.navigate(router.path);
}
