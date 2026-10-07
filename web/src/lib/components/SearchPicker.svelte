<script lang="ts" generics="T">
  /**
   * Search box with a few suggestion groups, for choosing one item from a
   * collection of any size. Empty query shows the suggestions; typing shows the
   * best matches from `search`. ARIA combobox with a grouped listbox.
   */
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  type Group = { label: string; items: T[] };

  let {
    id,
    placeholder,
    suggestions,
    search,
    key,
    item,
    selected,
    hint,
    empty = 'Nothing matches.',
    onpick,
    onclose,
  }: {
    id: string;
    placeholder: string;
    suggestions: Group[];
    /** Best matches for a non-empty query, already ranked and limited. */
    search: (query: string) => T[];
    key: (item: T) => string;
    /** Renders one option's contents. */
    item: Snippet<[T]>;
    selected?: string;
    hint?: string;
    empty?: string;
    onpick: (item: T) => void;
    onclose: () => void;
  } = $props();

  let query = $state('');
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();

  const groups: Group[] = $derived(
    query.trim()
      ? [{ label: '', items: search(query.trim()) }]
      : suggestions.filter((group) => group.items.length > 0),
  );
  const flat = $derived(groups.flatMap((group) => group.items));
  const optionId = (index: number) => `${id}-option-${index}`;

  $effect(() => {
    input?.focus();
  });

  // Reset the highlight when the results change.
  $effect(() => {
    void flat;
    active = 0;
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flat.length) active = (active + 1) % flat.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flat.length) active = (active - 1 + flat.length) % flat.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = flat[active];
      if (chosen !== undefined) onpick(chosen);
    } else if (event.key === 'Escape') {
      // Close the picker, not the dialog around it.
      event.preventDefault();
      event.stopPropagation();
      onclose();
    }
  }

  $effect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  });
</script>

<div class="combo">
  <label class="query">
    <Icon name="magnifying-glass" size={15} />
    <input
      bind:this={input}
      bind:value={query}
      {onkeydown}
      type="text"
      role="combobox"
      aria-label={placeholder}
      aria-expanded="true"
      aria-controls="{id}-list"
      aria-autocomplete="list"
      aria-activedescendant={flat.length ? optionId(active) : undefined}
      autocomplete="off"
      spellcheck="false"
      {placeholder}
    />
  </label>
  <div class="list" id="{id}-list" role="listbox" aria-label={placeholder}>
    {#each groups as group, g (g)}
      {@const offset = groups.slice(0, g).reduce((n, other) => n + other.items.length, 0)}
      <div class="group" role="group" aria-labelledby={group.label ? `${id}-group-${g}` : undefined}>
        {#if group.label}<div class="kicker" id="{id}-group-{g}">{group.label}</div>{/if}
        {#each group.items as option, i (key(option))}
          <div
            id={optionId(offset + i)}
            class="option"
            class:active={offset + i === active}
            class:selected={selected === key(option)}
            role="option"
            tabindex="-1"
            aria-selected={selected === key(option)}
            onpointermove={() => (active = offset + i)}
            onclick={() => onpick(option)}
            onkeydown={() => {}}
          >
            {@render item(option)}
          </div>
        {/each}
      </div>
    {/each}
    {#if flat.length === 0}<div class="hint">{query.trim() ? empty : 'No suggestions yet.'}</div>{/if}
  </div>
  {#if hint && !query.trim()}<div class="hint">{hint}</div>{/if}
</div>

<style>
  .combo {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--raised);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  }
  .query {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 10px 0;
    border: 0;
    background: none;
    font-size: 13px;
    color: var(--fg);
    outline: none;
  }
  .list {
    max-height: 320px;
    overflow-y: auto;
  }
  .group {
    display: grid;
    gap: 1px;
    padding: 4px 6px 8px;
    border-bottom: 1px solid var(--line);
  }
  .group .kicker {
    padding: 8px 8px 4px;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }
  .option.active,
  .option.selected {
    background: var(--accent-soft);
  }
  .option :global(small) {
    margin-left: auto;
    color: var(--muted);
    font-size: 11.5px;
    white-space: nowrap;
  }
  .hint {
    padding: 9px 14px;
    font-size: 12px;
    color: var(--muted);
  }
</style>
