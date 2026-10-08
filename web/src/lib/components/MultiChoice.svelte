<script lang="ts">
  /**
   * Several choices as chips, plus "Other…" for one that is not offered.
   * Values keep the order they were chosen in.
   */
  import Icon from './Icon.svelte';

  let {
    label,
    value = $bindable([]),
    options,
  }: { label: string; value?: string[]; options: readonly string[] } = $props();

  const id = $props.id();
  let adding = $state(false);
  let custom = $state('');

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const chosen = (option: string) => value.some((v) => same(v, option));
  // Chosen values that are not among the options still show, so they can be removed.
  const shown = $derived([...options, ...value.filter((v) => !options.some((o) => same(o, v)))]);

  function toggle(option: string) {
    value = chosen(option) ? value.filter((v) => !same(v, option)) : [...value, option];
  }

  function addCustom() {
    const text = custom.trim();
    if (text && !chosen(text)) value = [...value, text];
    custom = '';
    adding = false;
  }
</script>

<div class="multi">
  <span class="label" id="{id}-label">{label}</span>
  <div class="chips" role="group" aria-labelledby="{id}-label">
    {#each shown as option (option.toLowerCase())}
      <button type="button" aria-pressed={chosen(option)} onclick={() => toggle(option)}>
        {#if chosen(option)}<Icon name="check" size={12} />{/if}{option}
      </button>
    {/each}
    {#if adding}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        bind:value={custom}
        aria-label="Another {label.toLowerCase()}"
        placeholder="Type and press Enter"
        autofocus
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addCustom();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            adding = false;
          }
        }}
        onblur={addCustom}
      />
    {:else}
      <button type="button" class="other" onclick={() => (adding = true)}><Icon name="plus" size={12} />Other…</button>
    {/if}
  </div>
</div>

<style>
  .multi {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  .label {
    color: var(--muted);
    font-size: 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 11px;
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: none;
    color: var(--muted);
    font-size: 12.5px;
    cursor: pointer;
  }
  button:hover {
    color: var(--fg);
  }
  button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--fg);
    font-weight: 500;
  }
  .other {
    border-style: dashed;
  }
  input {
    width: 170px;
    padding: 4px 10px;
    border: 1px solid var(--accent);
    border-radius: 99px;
    background: var(--field);
    font-size: 12.5px;
    outline: none;
  }
</style>
