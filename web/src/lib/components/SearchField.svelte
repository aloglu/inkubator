<script lang="ts">
  /** A compact search box for list headers. */
  import Icon from './Icon.svelte';

  let { value = $bindable(''), label }: { value?: string; label: string } = $props();
</script>

<label class="search">
  <Icon name="magnifying-glass" size={15} />
  <input type="text" bind:value placeholder={label} aria-label={label} spellcheck="false" autocomplete="off" />
  {#if value}
    <button type="button" aria-label="Clear search" onclick={() => (value = '')}><Icon name="x" size={13} /></button>
  {/if}
</label>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 220px;
    max-width: 100%;
    padding: 0 6px 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    color: var(--muted);
  }
  .search:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  input {
    flex: 1;
    min-width: 0;
    padding: 6px 0;
    border: 0;
    background: none;
    font-size: 13px;
    color: var(--fg);
    outline: none;
  }
  button {
    display: grid;
    place-items: center;
    padding: 3px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
</style>
