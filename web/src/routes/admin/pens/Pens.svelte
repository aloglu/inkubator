<script lang="ts">
  /**
   * Pen cards: photo (or drawing) in a 16:9 frame, name and nib, and what the
   * pen holds. The detail and editor open in a side panel addressed by the URL
   * (?pen=<id>, &edit, ?new).
   */
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import PenMedia from '../../../lib/components/PenMedia.svelte';
  import SearchField from '../../../lib/components/SearchField.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import { daysBetween, plural } from '../../../lib/format';
  import { swabSheen } from '../../../lib/ink';
  import { router } from '../../../lib/router.svelte';
  import { rank } from '../../../lib/search';
  import { openFills } from '../../../lib/suggestions';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Pen } from '../../../lib/types/Pen';
  import PenDetail from './PenDetail.svelte';
  import PenEditor from './PenEditor.svelte';

  let { data }: { data: Collection } = $props();

  let query = $state('');

  const inks = $derived(new Map(data.inks.map((ink) => [ink.id, ink])));
  const open = $derived(openFills(data.fills));

  const fields = (pen: Pen) => [pen.model, pen.brand, pen.color_name, pen.nib_size, pen.nib_material, pen.filling_system];
  const pens = $derived(
    query.trim() ? rank(data.pens, fields, query, Infinity) : [...data.pens].sort((a, b) => b.created_at - a.created_at),
  );

  const selectedId = $derived(router.query.get('pen'));
  const selected = $derived(selectedId ? data.pens.find((pen) => pen.id === selectedId) : undefined);
  const editing = $derived(router.query.has('new') || (!!selected && router.query.has('edit')));

  const href = (pen: Pen, edit = data.settings.open_items_in_edit_mode) =>
    `/admin/pens?pen=${encodeURIComponent(pen.id)}${edit ? '&edit' : ''}`;
  const close = () => router.navigate('/admin/pens');
</script>

<div class="page">
  <header class="head">
    <h2>Pens</h2>
    <div class="tools">
      <SearchField bind:value={query} label="Search pens" />
      <Button icon="plus" onclick={() => router.navigate('/admin/pens?new')}>Add pen</Button>
    </div>
  </header>

  {#if pens.length}
    <ul class="grid">
      {#each pens as pen (pen.id)}
        {@const fill = open.get(pen.id)}
        {@const ink = fill ? inks.get(fill.ink_id) : undefined}
        <li>
          <a class="card" href={href(pen)} aria-current={pen.id === selectedId ? 'true' : undefined}>
            <PenMedia {pen} radius="0" />
            <div class="body">
              <p class="eyebrow">{pen.brand}</p>
              <h3>{pen.model}</h3>
              <p class="meta">{[pen.nib_size, pen.nib_material, pen.filling_system].filter(Boolean).join(' · ')}</p>
            </div>
            <div class="foot">
              {#if fill && ink}
                <Swab base={ink.base_color} sheen={swabSheen(ink)} size="xs" />
                <span class="ink">{ink.name}</span>
                <span class="days">{plural(daysBetween(fill.inked_at, Date.now()), 'day')}</span>
              {:else}
                <Icon name="moon" size={14} />
                <span>Resting</span>
              {/if}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">{data.pens.length ? `No pens match “${query}”.` : 'No pens yet. Add your first one.'}</p>
  {/if}
</div>

{#if editing}
  <PenEditor
    {data}
    pen={router.query.has('new') ? undefined : selected}
    onclose={(saved) => {
      const target = saved ?? selected;
      if (target) router.navigate(href(target, false));
      else close();
    }}
  />
{:else if selected}
  <PenDetail {data} pen={selected} onclose={close} />
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
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
    color: inherit;
    text-decoration: none;
  }
  .card:hover,
  .card[aria-current] {
    border-color: var(--line-strong);
  }
  .body {
    display: grid;
    gap: 2px;
    align-content: start;
    padding: 14px 16px;
  }
  .eyebrow {
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  h3 {
    font-size: 21px;
  }
  .meta {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 12.5px;
  }
  .ink {
    min-width: 0;
    overflow: hidden;
    color: var(--fg);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .days {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
