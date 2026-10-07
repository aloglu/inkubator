<script lang="ts">
  /** A text field with one-tap suggestions underneath. Any value can be typed. */
  import TextField from './TextField.svelte';

  let {
    label,
    value = $bindable(''),
    suggestions,
    placeholder,
  }: { label: string; value?: string; suggestions: readonly string[]; placeholder?: string } = $props();

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
</script>

<div class="suggest">
  <TextField {label} bind:value {placeholder} autocomplete="off" />
  {#if suggestions.length}
    <div class="chips" role="group" aria-label="Suggestions for {label}">
      {#each suggestions as suggestion (suggestion)}
        <button type="button" aria-pressed={same(value, suggestion)} onclick={() => (value = suggestion)}>{suggestion}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .suggest {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  button {
    padding: 2px 9px;
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: none;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  button:hover {
    color: var(--fg);
  }
  button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 500;
  }
</style>
