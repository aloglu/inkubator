/**
 * List filters. A facet sorts items by one or more string values (an ink's
 * brand, a pen's nib size…). Within a facet any selected value matches; across
 * facets every facet must match.
 */

export type Facet<T> = {
  key: string;
  label: string;
  /** chips: short values; list: names with counts; colors: color families. */
  style: 'chips' | 'list' | 'colors';
  values: (item: T) => string[];
  /** Display text for a value; the value itself by default. */
  name?: (value: string) => string;
  /** Fixed option order; otherwise most common first, then alphabetical. */
  order?: readonly string[];
};

export type Option = { value: string; label: string; count: number };

/** Selected values by facet key. */
export type Selection = Record<string, string[]>;

/** The options a facet offers for these items, with how many items have each. */
export function options<T>(facet: Facet<T>, items: readonly T[]): Option[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const value of new Set(facet.values(item))) {
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const list = [...counts].map(([value, count]) => ({ value, label: facet.name?.(value) ?? value, count }));
  if (facet.order) {
    const rank = (value: string) => {
      const index = facet.order!.indexOf(value);
      return index < 0 ? Infinity : index;
    };
    return list.sort((a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label));
  }
  return list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Facets worth showing: those that tell at least two kinds of item apart. */
export function usefulFacets<T>(facets: readonly Facet<T>[], items: readonly T[]): Facet<T>[] {
  return facets.filter((facet) => options(facet, items).length > 1);
}

export function matches<T>(item: T, facets: readonly Facet<T>[], selection: Selection): boolean {
  return facets.every((facet) => {
    const selected = selection[facet.key];
    if (!selected?.length) return true;
    return facet.values(item).some((value) => selected.includes(value));
  });
}

export function applyFilters<T>(items: readonly T[], facets: readonly Facet<T>[], selection: Selection): T[] {
  return items.filter((item) => matches(item, facets, selection));
}

/** Active filters as chips, e.g. { key: 'brand', text: 'Brand: Pilot, Lamy' }. */
export function chips<T>(facets: readonly Facet<T>[], selection: Selection): { key: string; label: string; values: string }[] {
  return facets.flatMap((facet) => {
    const selected = selection[facet.key];
    if (!selected?.length) return [];
    return [{ key: facet.key, label: facet.label, values: selected.map((v) => facet.name?.(v) ?? v).join(', ') }];
  });
}

export const activeCount = (selection: Selection) => Object.values(selection).filter((values) => values.length).length;
