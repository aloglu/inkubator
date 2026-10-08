<script lang="ts">
  /**
   * A pen's ink actions on the Desk: change its ink (in Ink a pen), flush it,
   * or open Suggestions: inks not in a pen for a while, to switch to at once.
   * Suggestions only appear when some ink is free to suggest.
   */
  import { flushPen, notifyWithUndo } from '../../lib/actions';
  import Icon from '../../lib/components/Icon.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import Swab from '../../lib/components/Swab.svelte';
  import { swabSheen } from '../../lib/ink';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import { restingInks } from '../../lib/suggestions';
  import type { Ink } from '../../lib/types/Ink';
  import type { Pen } from '../../lib/types/Pen';

  let { pen, ink }: { pen: Pen; ink: Ink } = $props();

  let open = $state(false);
  let suggesting = $state(false);
  let button: HTMLButtonElement | undefined = $state();

  const suggestions = $derived(open && collection.data ? restingInks(collection.data, Date.now()).slice(0, 3) : []);

  function close() {
    open = false;
    suggesting = false;
  }

  async function switchTo(next: Ink) {
    close();
    try {
      await collection.run({ type: 'ink_pen', pen_id: pen.id, ink_id: next.id, at: null, note: '' });
      notifyWithUndo(`Re-inked ${pen.model} with ${next.name}.`, pen.id);
    } catch (error) {
      ui.fail(error);
    }
  }
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
  onclick={() => (open ? close() : (open = true))}
>
  <Icon name="drop" size={16} /><Icon name="caret-down" size={11} />
</button>

<Menu anchor={button} {open} onclose={close} label="Ink actions for {pen.model}" width={250}>
  <button
    type="button"
    role="menuitem"
    onclick={() => {
      close();
      ui.openInkFlow({ penId: pen.id });
    }}
  >
    <Icon name="arrows-clockwise" size={16} /><span>Change ink…</span>
  </button>
  <button
    type="button"
    role="menuitem"
    onclick={() => {
      close();
      void flushPen(pen, ink.name);
    }}
  >
    <Icon name="arrows-counter-clockwise" size={16} /><span>Flush {ink.name}</span>
  </button>
  {#if suggestions.length}
    <hr />
    <button type="button" role="menuitem" aria-expanded={suggesting} onclick={() => (suggesting = !suggesting)}>
      <Icon name="star" size={16} /><span>Suggestions</span>
      <span class="caret" class:turned={suggesting}><Icon name="caret-down" size={12} /></span>
    </button>
    {#if suggesting}
      <div class="note">Not in a pen for a while</div>
      {#each suggestions as next (next.id)}
        <button type="button" role="menuitem" onclick={() => switchTo(next)}>
          <Swab base={next.base_color} sheen={swabSheen(next)} size="sm" />
          <span>{next.name}</span>
          <small>{next.brand}</small>
        </button>
      {/each}
    {/if}
  {/if}
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
  .caret {
    display: grid;
    margin-left: auto;
    color: var(--muted);
    transition: transform 0.15s;
  }
  .caret.turned {
    transform: rotate(180deg);
  }
  .trigger:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
