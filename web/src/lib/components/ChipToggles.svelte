<script lang="ts" generics="T extends string">
  /** Several on/off choices shown as chips, e.g. an ink's base types. */
  let {
    options,
    value = $bindable([]),
    label,
  }: { options: readonly { value: T; label: string }[]; value?: T[]; label: string } = $props();

  function toggle(option: T) {
    // Keep the options' order so saved lists are stable.
    const next = new Set(value);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    value = options.map((o) => o.value).filter((v) => next.has(v));
  }
</script>

<div class="chips" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button type="button" aria-pressed={value.includes(option.value)} onclick={() => toggle(option.value)}>
      {option.label}
    </button>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    padding: 4px 10px;
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
    color: var(--accent);
    font-weight: 500;
  }
</style>
