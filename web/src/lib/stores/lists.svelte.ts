/**
 * Search, filters and sort for each list. Filters last while the app is open;
 * the sort order is remembered in this browser.
 */
import type { Selection } from '../filters';
import type { InkSort } from '../types/InkSort';
import type { PenSort } from '../types/PenSort';
import type { SwatchSort } from '../types/SwatchSort';

export class ListState<S extends string> {
  query = $state('');
  filters: Selection = $state({});
  #sort: S = $state() as S;
  /** True once this browser has a sort of its own for the list. */
  #chosen = false;

  constructor(
    private readonly name: string,
    fallback: S,
    allowed: readonly S[],
  ) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(this.storageKey);
    } catch {
      /* storage unavailable */
    }
    this.#chosen = allowed.includes(saved as S);
    this.#sort = this.#chosen ? (saved as S) : fallback;
  }

  /** Uses `value` unless this browser already chose a sort, e.g. the showcase's default for visitors. */
  prefer(value: S) {
    if (!this.#chosen) this.#sort = value;
  }

  private get storageKey() {
    return `inkubator.sort.${this.name}`;
  }

  get sort(): S {
    return this.#sort;
  }

  set sort(value: S) {
    this.#sort = value;
    this.#chosen = true;
    try {
      localStorage.setItem(this.storageKey, value);
    } catch {
      /* storage unavailable */
    }
  }

  toggle(facet: string, value: string) {
    const current = this.filters[facet] ?? [];
    this.filters = {
      ...this.filters,
      [facet]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    };
  }

  clear(facet?: string) {
    this.filters = facet ? { ...this.filters, [facet]: [] } : {};
  }
}

export const lists = {
  pens: new ListState<PenSort>('pens', 'newest', ['newest', 'oldest', 'brand', 'model', 'price', 'last_inked']),
  inks: new ListState<InkSort>('inks', 'hue', ['hue', 'newest', 'oldest', 'brand', 'name']),
  swatches: new ListState<SwatchSort>('swatches', 'newest', ['newest', 'oldest', 'ink', 'paper']),
};
