<script lang="ts">
  /** One swatch: the full photo, the ink it shows, paper, nib and date. */
  import { photoUrl } from '../../../lib/api';
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import PhotoFrame from '../../../lib/components/PhotoFrame.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import SwatchMedia from '../../../lib/components/SwatchMedia.svelte';
  import { formatDate, fromDateInput, inkMaker } from '../../../lib/format';
  import { summary, swabSheen } from '../../../lib/ink';
  import { router } from '../../../lib/router.svelte';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { ui } from '../../../lib/stores/ui.svelte';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Swatch } from '../../../lib/types/Swatch';

  let { data, swatch, onclose }: { data: Collection; swatch: Swatch; onclose: () => void } = $props();

  const dateFormat = $derived(data.settings.defaults.date_format);
  const ink = $derived(data.inks.find((i) => i.id === swatch.ink_id));
  const photo = $derived(swatch.images.find((i) => i.primary) ?? swatch.images[0]);
  const sampled = $derived(swatch.sampled_on ? fromDateInput(swatch.sampled_on) : null);
  const owner = $derived(collection.canEdit);
  const rows = $derived(
    [
      { label: 'Paper', value: swatch.paper || null },
      { label: 'Nib', value: swatch.nib || null },
      { label: 'Date', value: sampled === null ? null : formatDate(sampled, dateFormat) },
    ].filter((row) => owner || row.value !== null),
  );

  async function remove() {
    const name = ink?.name ?? 'this ink';
    if (
      data.settings.confirm_destructive_actions &&
      !(await ui.confirm({
        title: 'Delete this swatch?',
        message: `The swatch of ${name} will be deleted. The ink stays. This cannot be undone.`,
        confirm: 'Delete swatch',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await collection.run({ type: 'delete_swatch', id: swatch.id });
      ui.notify(`Deleted the swatch of ${name}.`);
      onclose();
    } catch (error) {
      ui.fail(error);
    }
  }
</script>

<Sheet icon="palette" open {onclose} kicker="Swatch" wide>
  {#snippet actions()}
    {#if owner}
    <Button variant="ghost" size="sm" icon="trash" aria-label="Delete" title="Delete" disabled={collection.saving} onclick={remove} />
    <Button
      size="sm"
      icon="pencil-simple"
      onclick={() => router.navigate(`/swatches?swatch=${encodeURIComponent(swatch.id)}&edit`)}
    >
      Edit
    </Button>
    {/if}
  {/snippet}

  <div class="layout">
    <div class="media">
      {#if photo}
        <PhotoFrame src={photoUrl(photo.path)} image={photo} ratio={4 / 3} mode="fit" alt={ink ? `Swatch of ${ink.name}` : 'Swatch'} />
      {:else}
        <SwatchMedia {swatch} {ink} radius="var(--radius)" />
      {/if}
    </div>
    <div class="block">
      {#if ink}
        <div class="card">
          <Swab base={ink.base_color} sheen={swabSheen(ink)} size="sm" />
          <div class="grow">
            <p class="strong">{ink.name}</p>
            <p class="meta">{[inkMaker(ink), summary(ink, 2)].filter(Boolean).join(' · ')}</p>
          </div>
          <a class="open" href="/inks?ink={encodeURIComponent(ink.id)}">Open ink</a>
        </div>
      {/if}
      <dl>
        {#each rows as row (row.label)}
          <div><dt>{row.label}</dt><dd class:none={row.value === null}>{row.value ?? '—'}</dd></div>
        {/each}
      </dl>
      {#if swatch.notes}
        <h4 class="kicker">
          Notes
          {#if owner}
            <span class="visibility">
              <Icon name={swatch.notes_public ? 'globe' : 'lock-simple'} size={12} />
              {swatch.notes_public ? 'Shown on showcase' : 'Private'}
            </span>
          {/if}
        </h4>
        <p class="notes">{swatch.notes}</p>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <span>Added {formatDate(swatch.created_at, dateFormat)}</span>
  {/snippet}
</Sheet>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 26px;
    padding: 22px 28px;
  }
  .block {
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--raised);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .strong {
    font-weight: 500;
  }
  .meta {
    color: var(--muted);
    font-size: 12px;
  }
  .open {
    flex: none;
    padding: 4px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    color: inherit;
    font-size: 12.5px;
    text-decoration: none;
  }
  .open:hover {
    border-color: var(--accent);
  }
  dl {
    display: grid;
    margin: 0;
  }
  dl div {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr);
    gap: 10px;
    padding-block: 8px;
    border-bottom: 1px solid var(--line);
    font-size: 13.5px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  dd.none {
    color: var(--muted);
  }
  h4.kicker {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    font-family: var(--font-body);
  }
  .visibility {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  .notes {
    color: var(--muted);
    font-size: 13.5px;
    white-space: pre-line;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      padding: 18px 16px;
    }
  }
</style>
