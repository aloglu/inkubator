<script lang="ts">
  /** One side of a sentence-style form ("[pen] → [ink]"). Opens a SearchPicker. */
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    label,
    value,
    placeholder,
    open = false,
    controls,
    media,
    onclick,
  }: {
    label: string;
    /** The chosen item's name; the placeholder shows when empty. */
    value?: string;
    placeholder: string;
    open?: boolean;
    /** Id of the picker this button opens. */
    controls?: string;
    media?: Snippet;
    onclick: () => void;
  } = $props();
</script>

<button type="button" class="slot" class:open aria-expanded={open} aria-controls={controls} {onclick}>
  {@render media?.()}
  <span class="text">
    <span class="label">{label}</span>
    <span class="value" class:empty={!value}>{value || placeholder}</span>
  </span>
  <Icon name="caret-down" size={14} />
</button>

<style>
  .slot {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--field);
    text-align: left;
    cursor: pointer;
  }
  .slot.open {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .slot > :global(svg:last-child) {
    color: var(--muted);
    flex: none;
  }
  .text {
    display: grid;
    flex: 1;
    min-width: 0;
  }
  .label {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .value {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .value.empty {
    color: var(--muted);
    font-weight: 400;
  }
</style>
