<script lang="ts">
  /** A pen's ink actions on the Desk: change its ink (in Ink a pen, which suggests inks) or flush it. */
  import { flushPen } from '../../lib/actions';
  import Icon from '../../lib/components/Icon.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import type { Ink } from '../../lib/types/Ink';
  import type { Pen } from '../../lib/types/Pen';

  let { pen, ink }: { pen: Pen; ink: Ink } = $props();

  let open = $state(false);
  let button: HTMLButtonElement | undefined = $state();
</script>

<button
  bind:this={button}
  type="button"
  class="trigger"
  aria-label="Ink actions for {pen.model}"
  title="Change ink or flush"
  aria-haspopup="menu"
  aria-expanded={open}
  disabled={collection.saving}
  onclick={() => (open = !open)}
>
  <Icon name="drop" size={16} /><Icon name="caret-down" size={11} />
</button>

<Menu anchor={button} {open} onclose={() => (open = false)} label="Ink actions for {pen.model}" width={230}>
  <button
    type="button"
    role="menuitem"
    onclick={() => {
      open = false;
      ui.openInkFlow({ penId: pen.id });
    }}
  >
    <Icon name="arrows-clockwise" size={16} /><span>Change ink…</span>
  </button>
  <button
    type="button"
    role="menuitem"
    onclick={() => {
      open = false;
      void flushPen(pen, ink.name);
    }}
  >
    <Icon name="arrows-counter-clockwise" size={16} /><span>Flush {ink.name}</span>
  </button>
</Menu>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    padding: 0 6px 0 7px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .trigger:hover,
  .trigger[aria-expanded='true'] {
    border-color: var(--line-strong);
    color: var(--fg);
  }
  .trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
