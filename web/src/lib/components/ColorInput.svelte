<script lang="ts" generics="T extends string | null">
  /**
   * A color as a round swatch to pick from, next to its `#rrggbb` code, which
   * can also be typed. With `fallback`, the color may be empty (`null`): an
   * empty circle and "None", where clicking the circle or typing a code adds
   * one and × removes it again.
   */
  import Icon from './Icon.svelte';

  let { value = $bindable(), label, fallback }: { value: T; label: string; fallback?: string } = $props();

  // The typed code follows the picker, and is only taken over when it is a full color.
  let text = $state(value ?? '');
  $effect(() => {
    text = value ?? '';
  });
</script>

<span class="color">
  {#if value === null}
    <button type="button" class="empty" aria-label="Add {label.toLowerCase()}" onclick={() => (value = fallback as T)}>
      <Icon name="plus" size={13} />
    </button>
  {:else}
    <input type="color" bind:value aria-label={label} />
  {/if}
  <input
    type="text"
    class="code"
    value={text}
    placeholder="None"
    aria-label="{label} code"
    maxlength="7"
    spellcheck="false"
    autocomplete="off"
    oninput={(event) => {
      text = event.currentTarget.value.trim();
      const code = text.startsWith('#') ? text : `#${text}`;
      if (/^#[0-9a-f]{6}$/i.test(code)) value = code.toLowerCase() as T;
    }}
    onblur={() => (text = value ?? '')}
  />
  {#if fallback !== undefined && value !== null}
    <button type="button" class="clear" aria-label="Remove {label.toLowerCase()}" onclick={() => (value = null as T)}>
      <Icon name="x" size={13} />
    </button>
  {/if}
</span>

<style>
  .color {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  input[type='color'] {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }
  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  input[type='color']::-webkit-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  input[type='color']::-moz-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  .empty {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px dashed var(--line-strong);
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .empty:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .clear {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .clear:hover {
    background: var(--line);
    color: var(--fg);
  }
  .empty:focus-visible,
  .clear:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .code {
    width: 92px;
    padding: 5px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-family: ui-monospace, monospace;
    font-size: 12.5px;
  }
  .code:focus-visible {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
</style>
