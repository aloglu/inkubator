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

/** An item's panel on the current page; opens the editor when asked, or when "Open items in edit mode" is on. */
export function itemHref(kind: ItemKind, id: string, { edit }: { edit?: boolean } = {}): string {
  const editing = edit ?? (collection.canEdit && !!collection.data?.settings.open_items_in_edit_mode);
  return `${router.path}?${kind}=${encodeURIComponent(id)}${editing ? '&edit' : ''}`;
}

/** The editor for a new item on the current page; a new swatch can start with an ink (`forInk`). */
export function newHref(kind: ItemKind, forInk?: string): string {
  return `${router.path}?new=${kind}${forInk ? `&for=${encodeURIComponent(forInk)}` : ''}`;
}

/** Closes any panel, staying on the page. */
export function closePanel() {
  router.navigate(router.path);
}
