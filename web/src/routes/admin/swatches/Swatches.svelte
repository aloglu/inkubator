<script lang="ts">
  /**
   * Swatch tiles: the photo in a 4:3 crop, the ink, paper and nib. Inks that
   * have no swatch yet are listed underneath. The detail and editor open in a
   * side panel addressed by the URL (?swatch=<id>, &edit, ?new[&ink=<id>]).
   */
  import Button from '../../../lib/components/Button.svelte';
  import ListTools from '../../../lib/components/ListTools.svelte';
  import SwatchMedia from '../../../lib/components/SwatchMedia.svelte';
  import { router } from '../../../lib/router.svelte';
  import { familyColors, swatchFacets } from '../../../lib/facets';
  import { applyFilters, usefulFacets } from '../../../lib/filters';
  import { rank } from '../../../lib/search';
  import { sortSwatches, swatchSorts } from '../../../lib/sorting';
  import { lists } from '../../../lib/stores/lists.svelte';
  import type { ColorFamily } from '../../../lib/types/ColorFamily';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Swatch } from '../../../lib/types/Swatch';
  import SwatchDetail from './SwatchDetail.svelte';
  import SwatchEditor from './SwatchEditor.svelte';

  let { data }: { data: Collection } = $props();

  const list = lists.swatches;

  const inks = $derived(new Map(data.inks.map((ink) => [ink.id, ink])));
  const fields = (swatch: Swatch) => {
    const ink = inks.get(swatch.ink_id);
    return [ink?.name ?? '', ink?.brand ?? '', swatch.paper, swatch.nib];
  };
  const facets = $derived(usefulFacets(swatchFacets(inks), data.swatches));
  const swatches = $derived(
    list.query.trim()
      ? applyFilters(rank(data.swatches, fields, list.query, Infinity), facets, list.filters)
      : sortSwatches(applyFilters(data.swatches, facets, list.filters), list.sort, inks),
  );
  const unswatched = $derived.by(() => {
    const swatched = new Set(data.swatches.map((swatch) => swatch.ink_id));
    return data.inks.filter((ink) => !swatched.has(ink.id));
  });

  const selectedId = $derived(router.query.get('swatch'));
  const selected = $derived(selectedId ? data.swatches.find((swatch) => swatch.id === selectedId) : undefined);
  const editing = $derived(router.query.has('new') || (!!selected && router.query.has('edit')));

  const href = (swatch: Swatch, edit = data.settings.open_items_in_edit_mode) =>
    `/admin/swatches?swatch=${encodeURIComponent(swatch.id)}${edit ? '&edit' : ''}`;
  const close = () => router.navigate('/admin/swatches');
</script>

<div class="page">
  <header class="head">
    <h2>Swatches</h2>
    <ListTools
      {list}
      {facets}
      items={data.swatches}
      shown={swatches.length}
      noun="swatches"
      searchLabel="Search swatches"
      sorts={swatchSorts}
      swatch={(value) => familyColors[value as ColorFamily]}
    >
      {#snippet actions()}
        <Button icon="plus" onclick={() => router.navigate('/admin/swatches?new')}>Add swatch</Button>
      {/snippet}
    </ListTools>
  </header>

  {#if swatches.length}
    <ul class="grid">
      {#each swatches as swatch (swatch.id)}
        {@const ink = inks.get(swatch.ink_id)}
        <li>
          <a class="tile" href={href(swatch)} aria-current={swatch.id === selectedId ? 'true' : undefined}>
            <SwatchMedia {swatch} {ink} radius="0" />
            <span class="caption">
              <b>{ink?.name ?? 'Unknown ink'}</b>
              <span>{[swatch.paper, swatch.nib].filter(Boolean).join(' · ') || ink?.brand}</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted">{data.swatches.length ? 'No swatches match.' : 'No swatches yet.'}</p>
  {/if}

  {#if unswatched.length && !list.query.trim()}
    <div class="nudge">
      <span>
        <strong>{unswatched.length === 1 ? '1 ink has' : `${unswatched.length} inks have`} no swatch yet:</strong>
        {unswatched
          .slice(0, 6)
          .map((ink) => ink.name)
          .join(', ')}{unswatched.length > 6 ? ', …' : '.'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        icon="plus"
        onclick={() => router.navigate(`/admin/swatches?new&ink=${encodeURIComponent(unswatched[0]!.id)}`)}
      >
        Add a swatch
      </Button>
    </div>
  {/if}
</div>

{#if editing}
  <SwatchEditor
    {data}
    swatch={router.query.has('new') ? undefined : selected}
    inkId={router.query.get('ink') ?? undefined}
    onclose={(saved) => {
      const target = saved ?? selected;
      if (target) router.navigate(href(target, false));
      else close();
    }}
  />
{:else if selected}
  <SwatchDetail {data} swatch={selected} onclose={close} />
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
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tile {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
    color: inherit;
    text-decoration: none;
  }
  .tile:hover,
  .tile[aria-current] {
    border-color: var(--line-strong);
  }
  .caption {
    display: grid;
    gap: 1px;
    padding: 10px 14px;
  }
  .caption b {
    font-weight: 500;
  }
  .caption span {
    overflow: hidden;
    color: var(--muted);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .caption {
      padding: 8px 10px;
    }
    .caption b {
      font-size: 13px;
    }
    .caption span {
      font-size: 11px;
    }
    .nudge {
      flex-wrap: wrap;
    }
  }
  .nudge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 13px;
  }
  .nudge strong {
    color: var(--fg);
    font-weight: 600;
  }
</style>
