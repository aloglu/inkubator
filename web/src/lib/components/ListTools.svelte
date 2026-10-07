<script lang="ts" generics="T, S extends string">
  /**
   * The tools above a list: search, a filter panel of facets, sort, and the
   * active filters as removable chips with a result count.
   */
  import type { Snippet } from 'svelte';
  import { activeCount, chips, options, type Facet } from '../filters';
  import type { ListState } from '../stores/lists.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import Menu from './Menu.svelte';
  import Popover from './Popover.svelte';
  import SearchField from './SearchField.svelte';

  let {
    list,
    facets,
    items,
    shown,
    noun,
    searchLabel,
    sorts,
    /** Color for a value of a `colors` facet. */
    swatch,
    actions,
  }: {
    list: ListState<S>;
    facets: Facet<T>[];
    /** Every item, before filtering, for the option counts. */
    items: readonly T[];
    /** How many items are showing. */
    shown: number;
    /** Plural, e.g. "pens". */
    noun: string;
    searchLabel: string;
    sorts: readonly { value: S; label: string }[];
    swatch?: (value: string) => string;
    actions?: Snippet;
  } = $props();

  let filterButton: HTMLButtonElement | undefined = $state();
  let sortButton: HTMLButtonElement | undefined = $state();
  let filtering = $state(false);
  let sorting = $state(false);

  const active = $derived(chips(facets, list.filters));
  const count = $derived(activeCount(list.filters));
  const sortLabel = $derived(sorts.find((s) => s.value === list.sort)?.label ?? '');
  const narrowed = $derived(count > 0 || list.query.trim() !== '');
</script>

<div class="tools">
  <SearchField bind:value={list.query} label={searchLabel} />
  {#if facets.length}
    <Button
      bind:element={filterButton}
      variant="ghost"
      icon="funnel-simple"
      active={filtering || count > 0}
      aria-haspopup="dialog"
      aria-expanded={filtering}
      onclick={() => (filtering = !filtering)}
    >
      Filter{#if count}<span class="badge">{count}</span>{/if}
    </Button>
  {/if}
  <Button
    bind:element={sortButton}
    variant="ghost"
    icon="sort-ascending"
    trailingIcon="caret-down"
    active={sorting}
    aria-haspopup="menu"
    aria-expanded={sorting}
    aria-label="Sort: {sortLabel}"
    onclick={() => (sorting = !sorting)}
  >
    {sortLabel}
  </Button>
  {@render actions?.()}
</div>

{#if narrowed}
  <div class="applied">
    {#each active as chip (chip.key)}
      <span class="chip">
        {chip.label}: <b>{chip.values}</b>
        <button type="button" aria-label="Remove {chip.label} filter" onclick={() => list.clear(chip.key)}>
          <Icon name="x" size={12} />
        </button>
      </span>
    {/each}
    {#if count}<button type="button" class="link" onclick={() => list.clear()}>Clear all</button>{/if}
    <span class="count">Showing {shown} of {items.length} {noun}</span>
  </div>
{/if}

<Menu anchor={sortButton} open={sorting} onclose={() => (sorting = false)} label="Sort {noun}" width={200}>
  <div class="kicker">Sort by</div>
  {#each sorts as option (option.value)}
    <button
      type="button"
      role="menuitemradio"
      aria-checked={list.sort === option.value}
      onclick={() => {
        list.sort = option.value;
        sorting = false;
      }}
    >
      <span class="tick">{#if list.sort === option.value}<Icon name="check" size={14} />{/if}</span>
      {option.label}
    </button>
  {/each}
</Menu>

<Popover
  anchor={filterButton}
  open={filtering}
  onclose={() => (filtering = false)}
  width={400}
  role="dialog"
  aria-label="Filter {noun}"
  onopen={(panel) => panel.querySelector<HTMLElement>('button')?.focus()}
>
  <div class="panel">
    <header>
      <b>Filter {noun}</b>
      <button type="button" class="link" onclick={() => list.clear()} disabled={!count}>Reset</button>
    </header>
    {#each facets as facet (facet.key)}
      {@const selected = list.filters[facet.key] ?? []}
      <section>
        <h4 class="kicker">
          {facet.label}
          {#if selected.length}<span>{selected.length} selected</span>{/if}
        </h4>
        <div class="options {facet.style}" role="group" aria-label={facet.label}>
          {#each options(facet, items) as option (option.value)}
            <button
              type="button"
              aria-pressed={selected.includes(option.value)}
              onclick={() => list.toggle(facet.key, option.value)}
            >
              {#if facet.style === 'colors' && swatch}<i style:--c={swatch(option.value)}></i>{/if}
              {#if facet.style === 'list'}
                <span class="box">{#if selected.includes(option.value)}<Icon name="check" size={11} />{/if}</span>
              {/if}
              <span class="label">{option.label}</span>
              <small>{option.count}</small>
            </button>
          {/each}
        </div>
      </section>
    {/each}
    <footer>
      <span>Filters stay on until you clear them.</span>
      <Button size="sm" onclick={() => (filtering = false)}>Show {shown} {noun}</Button>
    </footer>
  </div>
</Popover>

<style>
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  @media (max-width: 600px) {
    .tools {
      width: 100%;
    }
    .tools > :global(.search) {
      flex: 1 0 100%;
      width: auto;
    }
  }
  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    margin-left: 2px;
    padding: 0 5px;
    border-radius: 99px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 11px;
    font-weight: 600;
  }
  .applied {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    font-size: 12.5px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px 3px 10px;
    border-radius: 99px;
    background: var(--accent-soft);
  }
  .chip b {
    font-weight: 600;
  }
  .chip button {
    display: grid;
    place-items: center;
    padding: 2px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .chip button:hover {
    color: var(--fg);
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 12.5px;
    text-decoration: underline;
    cursor: pointer;
  }
  .link:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .count {
    margin-left: auto;
    color: var(--muted);
  }
  .tick {
    display: grid;
    width: 14px;
    color: var(--accent);
  }
  .panel header,
  .panel footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
  }
  .panel header {
    border-bottom: 1px solid var(--line);
  }
  .panel header b {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 400;
  }
  .panel footer {
    color: var(--muted);
    font-size: 12px;
  }
  section {
    display: grid;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }
  h4.kicker {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-body);
  }
  h4.kicker span {
    color: var(--accent);
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .options button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: none;
    color: var(--muted);
    font-size: 12.5px;
    cursor: pointer;
  }
  .options button:hover {
    color: var(--fg);
  }
  .options button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
  }
  .options small {
    color: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .options.colors button {
    padding-left: 4px;
  }
  .options i {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--c);
  }
  .options.list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }
  .options.list button {
    padding: 0;
    border: 0;
    border-radius: 0;
    color: var(--fg);
    font-size: 13px;
    text-align: left;
  }
  .options.list button[aria-pressed='true'] {
    background: none;
  }
  .options.list .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .box {
    display: grid;
    flex: none;
    place-items: center;
    width: 15px;
    height: 15px;
    border: 1.5px solid var(--line-strong);
    border-radius: 4px;
    color: var(--accent-ink);
  }
  [aria-pressed='true'] .box {
    border-color: var(--accent);
    background: var(--accent);
  }
</style>
