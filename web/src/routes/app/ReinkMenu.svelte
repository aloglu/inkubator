<script lang="ts">
  /**
   * Re-ink: switch a pen to a different ink. Leads with the pen's recent earlier
   * inks, then inks not in a pen for a while, then the full Ink a pen dialog.
   * With `withFlush` it is the pen's one ink menu, ending with Flush.
   */
  import { flushPen, notifyWithUndo } from '../../lib/actions';
  import Button from '../../lib/components/Button.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import Menu from '../../lib/components/Menu.svelte';
  import Swab from '../../lib/components/Swab.svelte';
  import { swabSheen } from '../../lib/ink';
  import { formatDate } from '../../lib/format';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import { earlierInks, restingInks } from '../../lib/suggestions';
  import type { Ink } from '../../lib/types/Ink';
  import type { Pen } from '../../lib/types/Pen';

  let {
    pen,
    current,
    label = 'Re-ink',
    withFlush = false,
  }: { pen: Pen; current: Ink; label?: string; withFlush?: boolean } = $props();

  let open = $state(false);
  let button: HTMLButtonElement | undefined = $state();

  const data = $derived(collection.data);
  const dateFormat = $derived(data?.settings.defaults.date_format ?? 'system');
  const earlier = $derived(open && data ? earlierInks(data, pen.id).slice(0, 3) : []);
  const resting = $derived(
    open && data ? restingInks(data, Date.now(), new Set(earlier.map((entry) => entry.ink.id))).slice(0, 2) : [],
  );

  async function switchTo(ink: Ink) {
    open = false;
    try {
      await collection.run({ type: 'ink_pen', pen_id: pen.id, ink_id: ink.id, at: null, note: '' });
      notifyWithUndo(`Re-inked ${pen.model} with ${ink.name}.`, pen.id);
    } catch (error) {
      ui.fail(error);
    }
  }
</script>

<Button
  bind:element={button}
  variant="ghost"
  size="sm"
  icon="arrows-clockwise"
  trailingIcon="caret-down"
  active={open}
  aria-haspopup="menu"
  aria-expanded={open}
  disabled={collection.saving}
  onclick={() => (open = !open)}
>
  <span class="button-label">{label}</span>
</Button>

<Menu anchor={button} {open} onclose={() => (open = false)} label="Switch {pen.model} to">
  <div class="kicker">Switch {pen.model} to</div>
  {#each earlier as { ink, fill }, index (ink.id)}
    <button type="button" role="menuitem" onclick={() => switchTo(ink)}>
      <Swab base={ink.base_color} sheen={swabSheen(ink)} size="sm" />
      <span>{ink.name}</span>
      <small>{index === 0 ? 'Last ink · ' : ''}until {formatDate(fill.emptied_at ?? 0, dateFormat, { short: true })}</small>
    </button>
  {:else}
    <div class="note">No earlier inks recorded.</div>
  {/each}
  {#if resting.length}
    <div class="kicker">Not in a pen for a while</div>
    {#each resting as ink (ink.id)}
      <button type="button" role="menuitem" onclick={() => switchTo(ink)}>
        <Swab base={ink.base_color} sheen={swabSheen(ink)} size="sm" />
        <span>{ink.name}</span>
        <small>{ink.brand}</small>
      </button>
    {/each}
  {/if}
  <hr />
  <button
    type="button"
    role="menuitem"
    onclick={() => {
      open = false;
      ui.openInkFlow({ penId: pen.id });
    }}
  >
    <Icon name="magnifying-glass" size={16} /><span>Choose another ink…</span>
  </button>
  <div class="note">{current.name} is flushed first.</div>
  {#if withFlush}
    <hr />
    <button
      type="button"
      role="menuitem"
      onclick={() => {
        open = false;
        void flushPen(pen, current.name);
      }}
    >
      <Icon name="arrows-counter-clockwise" size={16} /><span>Flush {current.name}</span>
      <small>Empty the pen</small>
    </button>
  {/if}
</Menu>
