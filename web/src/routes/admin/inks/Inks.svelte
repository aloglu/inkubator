<script lang="ts">
  /**
   * The ink shelf: swabs grouped by color family. The detail and editor open in
   * a side panel addressed by the URL (?ink=<id>, &edit, ?new), so links and the
   * back button work.
   */
  import { colorFamily, families, familyHeading } from '../../../lib/color';
  import Button from '../../../lib/components/Button.svelte';
  import SearchField from '../../../lib/components/SearchField.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import { hueKey, swabSheen } from '../../../lib/ink';
  import { router } from '../../../lib/router.svelte';
  import { rank } from '../../../lib/search';
  import { openFills } from '../../../lib/suggestions';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Ink } from '../../../lib/types/Ink';
  import type { Pen } from '../../../lib/types/Pen';
  import InkDetail from './InkDetail.svelte';
  import InkEditor from './InkEditor.svelte';

  let { data }: { data: Collection } = $props();

  let query = $state('');

  const pens = $derived(new Map(data.pens.map((pen) => [pen.id, pen])));
  /** Pens each ink is in right now. */
  const inPens = $derived.by(() => {
    const map = new Map<string, Pen[]>();
    for (const fill of openFills(data.fills).values()) {
      const pen = pens.get(fill.pen_id);
      if (pen) map.set(fill.ink_id, [...(map.get(fill.ink_id) ?? []), pen]);
    }
    return map;
  });

  const shown = $derived(
    query.trim()
      ? new Set(
          rank(data.inks, (ink) => [ink.name, ink.brand, ink.line, colorFamily(ink.base_color)], query, Infinity).map(
            (ink) => ink.id,
          ),
        )
      : null,
  );

  const groups = $derived(
    families
      .map((family) => ({
        family,
        inks: data.inks
          .filter((ink) => colorFamily(ink.base_color) === family && (!shown || shown.has(ink.id)))
          .sort((a, b) => hueKey(a.base_color) - hueKey(b.base_color)),
      }))
      .filter((group) => group.inks.length > 0),
  );

  const selectedId = $derived(router.query.get('ink'));
  const selected = $derived(selectedId ? data.inks.find((ink) => ink.id === selectedId) : undefined);
  const editing = $derived(router.query.has('new') || (!!selected && router.query.has('edit')));

  function open(ink: Ink) {
    router.navigate(`/admin/inks?ink=${encodeURIComponent(ink.id)}${data.settings.open_items_in_edit_mode ? '&edit' : ''}`);
  }
  const close = () => router.navigate('/admin/inks');
</script>

<div class="page">
  <header class="head">
    <h2>Inks</h2>
    <div class="tools">
      <SearchField bind:value={query} label="Search inks" />
      <Button icon="plus" onclick={() => router.navigate('/admin/inks?new')}>Add ink</Button>
    </div>
  </header>

  {#each groups as group (group.family)}
    <section class="group" aria-labelledby="family-{group.family.replace(/\W+/g, '-')}">
      <h3 class="kicker" id="family-{group.family.replace(/\W+/g, '-')}">{familyHeading(group.family)}<span>{group.inks.length}</span></h3>
      <ul class="shelf">
        {#each group.inks as ink (ink.id)}
          {@const holders = inPens.get(ink.id) ?? []}
          <li>
            <button type="button" onclick={() => open(ink)} aria-current={ink.id === selectedId ? 'true' : undefined}>
              <Swab base={ink.base_color} sheen={swabSheen(ink)} size="shelf" />
              <b>{ink.name}</b>
              <small>{ink.brand}</small>
              {#if holders.length}
                <span class="in-pen">
                  <span class="dot" style:--c={holders[0]?.colors[0] ?? 'var(--muted)'}></span>
                  {holders.map((pen) => pen.model).join(', ')}
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="muted">
      {#if data.inks.length}No inks match “{query}”.{:else}No inks yet. Add your first one.{/if}
    </p>
  {/each}
</div>

{#if editing}
  <InkEditor {data} ink={router.query.has('new') ? undefined : selected} onclose={(saved) => (saved ? open(saved) : selected ? open(selected) : close())} />
{:else if selected}
  <InkDetail {data} ink={selected} onclose={close} />
{/if}

<style>
  .page {
    display: grid;
    gap: 22px;
    align-content: start;
  }
  .head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .head h2 {
    font-size: 32px;
  }
  .tools {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .group {
    display: grid;
    gap: 4px;
  }
  .group .kicker span {
    margin-left: 6px;
    color: var(--muted);
    font-weight: 400;
    letter-spacing: 0;
  }
  h3.kicker {
    font-family: var(--font-body);
    font-size: 11px;
  }
  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
    align-items: start;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .shelf button {
    display: grid;
    justify-items: center;
    gap: 1px;
    width: 100%;
    padding: 14px 8px 12px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    text-align: center;
    cursor: pointer;
  }
  .shelf button:hover,
  .shelf button[aria-current] {
    border-color: var(--line);
    background: var(--raised);
  }
  .shelf b {
    margin-top: 10px;
    font-size: 13.5px;
    font-weight: 500;
  }
  .shelf small {
    color: var(--muted);
    font-size: 11.5px;
  }
  .in-pen {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    color: var(--muted);
    font-size: 11px;
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 1px var(--line-strong);
  }
  @media (max-width: 700px) {
    .shelf {
      grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    }
  }
</style>
