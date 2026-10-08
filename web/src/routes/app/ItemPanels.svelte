<script lang="ts">
  /**
   * The pen, ink and swatch panels, for every page: details, editors and new
   * items, as the address asks (see lib/items). Saving an edit returns to the
   * item's details; a new swatch started from an ink returns to that ink.
   */
  import { canOpen, closePanel, itemHref } from '../../lib/items.svelte';
  import { router } from '../../lib/router.svelte';
  import { collection } from '../../lib/stores/collection.svelte';
  import type { Collection } from '../../lib/types/Collection';
  import InkDetail from './inks/InkDetail.svelte';
  import InkEditor from './inks/InkEditor.svelte';
  import PenDetail from './pens/PenDetail.svelte';
  import PenEditor from './pens/PenEditor.svelte';
  import SwatchDetail from './swatches/SwatchDetail.svelte';
  import SwatchEditor from './swatches/SwatchEditor.svelte';

  let { data }: { data: Collection } = $props();

  const query = $derived(router.query);
  const adding = $derived(collection.canEdit ? query.get('new') : null);
  const editing = $derived(collection.canEdit && query.has('edit'));
  const forInk = $derived(query.get('for') ?? undefined);

  const pen = $derived.by(() => {
    const id = query.get('pen');
    return id && canOpen('pen') ? data.pens.find((p) => p.id === id) : undefined;
  });
  const ink = $derived.by(() => {
    const id = query.get('ink');
    return id && canOpen('ink') ? data.inks.find((i) => i.id === id) : undefined;
  });
  const swatch = $derived.by(() => {
    const id = query.get('swatch');
    return id && canOpen('swatch') ? data.swatches.find((s) => s.id === id) : undefined;
  });

  const back = (kind: 'pen' | 'ink' | 'swatch', id: string) => router.navigate(itemHref(kind, id, { edit: false }));
</script>

{#if adding === 'pen'}
  <PenEditor {data} onclose={closePanel} />
{:else if adding === 'ink'}
  <InkEditor {data} onclose={closePanel} />
{:else if adding === 'swatch'}
  <SwatchEditor {data} inkId={forInk} onclose={() => (forInk ? back('ink', forInk) : closePanel())} />
{:else if pen}
  {#if editing}
    <PenEditor {data} {pen} onclose={() => back('pen', pen.id)} />
  {:else}
    <PenDetail {data} {pen} onclose={closePanel} />
  {/if}
{:else if ink}
  {#if editing}
    <InkEditor {data} {ink} onclose={() => back('ink', ink.id)} />
  {:else}
    <InkDetail {data} {ink} onclose={closePanel} />
  {/if}
{:else if swatch}
  {#if editing}
    <SwatchEditor {data} {swatch} onclose={() => back('swatch', swatch.id)} />
  {:else}
    <SwatchDetail {data} {swatch} onclose={closePanel} />
  {/if}
{/if}
