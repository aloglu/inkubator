<script lang="ts" generics="T extends string">
  /** A row of mutually exclusive options. Arrow keys move between them. */
  let {
    options,
    value = $bindable(),
    label,
    equal = false,
    onchange,
  }: {
    options: readonly { value: T; label: string }[];
    value: T;
    label: string;
    /** Give every option the same width, so stacked rows line up. */
    equal?: boolean;
    onchange?: (value: T) => void;
  } = $props();

  let buttons: HTMLButtonElement[] = $state([]);

  function choose(next: T) {
    value = next;
    onchange?.(next);
  }

  function onkeydown(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option) {
      choose(option.value);
      buttons[next]?.focus();
    }
  }
</script>

<div class="seg" class:equal role="radiogroup" aria-label={label}>
  {#each options as option, index (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      tabindex={option.value === value ? 0 : -1}
      class:on={option.value === value}
      bind:this={buttons[index]}
      onclick={() => choose(option.value)}
      onkeydown={(event) => onkeydown(event, index)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--field);
    max-width: 100%;
    justify-self: start;
  }
  button {
    padding: 6px 11px;
    font-size: 12.5px;
    color: var(--muted);
    border: 0;
    border-right: 1px solid var(--line);
    background: none;
    cursor: pointer;
    white-space: nowrap;
  }
  button:last-child {
    border-right: 0;
  }
  .equal button {
    width: 78px;
    text-align: center;
    padding-inline: 4px;
  }
  .on {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
</style>
