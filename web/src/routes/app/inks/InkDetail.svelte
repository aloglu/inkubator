<script lang="ts">
  /** One ink: properties, where it is now, its swatches and the pens it has been in. */
  import { photoUrl } from '../../../lib/api';
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import PenMedia from '../../../lib/components/PenMedia.svelte';
  import PhotoFrame from '../../../lib/components/PhotoFrame.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import SwatchMedia from '../../../lib/components/SwatchMedia.svelte';
  import { daysBetween, formatDate, inkMaker, penName, plural } from '../../../lib/format';
  import { properties, summary, swabSheen } from '../../../lib/ink';
  import { canOpen, itemHref, newHref } from '../../../lib/items.svelte';
  import { router } from '../../../lib/router.svelte';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { ui } from '../../../lib/stores/ui.svelte';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Ink } from '../../../lib/types/Ink';

  let { data, ink, onclose }: { data: Collection; ink: Ink; onclose: () => void } = $props();

  const dateFormat = $derived(data.settings.defaults.date_format);
  const pens = $derived(new Map(data.pens.map((pen) => [pen.id, pen])));
  const fills = $derived(data.fills.filter((fill) => fill.ink_id === ink.id));
  const current = $derived(
    fills.filter((fill) => fill.emptied_at === null).flatMap((fill) => {
      const pen = pens.get(fill.pen_id);
      return pen ? [{ fill, pen }] : [];
    }),
  );
  const earlier = $derived(
    fills
      .filter((fill) => fill.emptied_at !== null)
      .sort((a, b) => (b.emptied_at ?? 0) - (a.emptied_at ?? 0))
      .flatMap((fill) => {
        const pen = pens.get(fill.pen_id);
        return pen ? [{ fill, pen }] : [];
      }),
  );
  const swatches = $derived(data.swatches.filter((swatch) => swatch.ink_id === ink.id));
  const photo = $derived(ink.images.find((image) => image.primary) ?? ink.images[0]);
  const owner = $derived(collection.canEdit);
  // Visitors see only what is filled in (and no price unless prices are shown).
  const rows = $derived(
    properties(ink, data.settings.defaults.currency).filter(
      (row) => owner || (row.value !== null && (row.label !== 'Price' || data.settings.showcase.show_prices)),
    ),
  );

  async function remove() {
    if (current.length) return;
    // The panel closes as soon as the ink leaves the collection; keep what the notice needs.
    const { id, name } = ink;
    const lost = [
      swatches.length ? plural(swatches.length, 'swatch', 'swatches') : null,
      earlier.length ? `${plural(earlier.length, 'past fill')}` : null,
    ].filter(Boolean);
    if (
      data.settings.confirm_destructive_actions &&
      !(await ui.confirm({
        title: `Delete ${name}?`,
        message: lost.length
          ? `Its ${lost.join(' and ')} will be deleted with it. This cannot be undone.`
          : 'This cannot be undone.',
        confirm: 'Delete ink',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await collection.run({ type: 'delete_ink', id });
      ui.notify(`Deleted ${name}.`);
      onclose();
    } catch (error) {
      ui.fail(error);
    }
  }
</script>

<Sheet icon="drop" open {onclose} title="Ink">
  {#snippet actions()}
    {#if owner}
    <Button
      variant="ghost"
      icon="trash"
      aria-label={current.length ? 'Delete (flush the pen first)' : 'Delete'}
      title={current.length ? 'Flush the pen before deleting this ink.' : 'Delete'}
      disabled={current.length > 0 || collection.saving}
      onclick={remove}
    />
    <Button icon="pencil-simple" onclick={() => router.navigate(itemHref('ink', ink.id, { edit: true }))}>
      Edit
    </Button>
    {/if}
  {/snippet}

  <div class="hero">
    <Swab base={ink.base_color} sheen={swabSheen(ink)} size="lg" />
    <div class="title">
      <p class="eyebrow">{inkMaker(ink)}</p>
      <h2>{ink.name}</h2>
      {#if summary(ink)}<p class="meta">{summary(ink)}</p>{/if}
    </div>
    {#if photo}
      <div class="bottle">
        <PhotoFrame src={photoUrl(photo.path, true)} image={photo} ratio={1} mode="fit" alt="{ink.name} bottle" />
      </div>
    {/if}
  </div>

  <div class="columns">
    <section class="block">
      <h4 class="kicker">Properties</h4>
      <dl>
        {#each rows as row (row.label)}
          <div>
            <dt>{row.label}</dt>
            <dd class:none={row.value === null || row.value === 'None'}>{row.value ?? '—'}</dd>
          </div>
        {/each}
      </dl>
      {#if ink.notes}
        <h4 class="kicker spaced">
          Notes
          {#if owner}
            <span class="visibility">
              <Icon name={ink.notes_public ? 'globe' : 'lock-simple'} size={12} />
              {ink.notes_public ? 'Shown to visitors' : 'Private'}
            </span>
          {/if}
        </h4>
        <p class="notes">{ink.notes}</p>
      {/if}
    </section>

    <section class="block">
      <h4 class="kicker">In use</h4>
      {#each current as { fill, pen } (fill.id)}
        <div class="card">
          <span class="pen-thumb"><PenMedia {pen} radius="5px" /></span>
          <div class="grow">
            {#if canOpen('pen')}
              <a class="strong" href={itemHref('pen', pen.id, { edit: false })}>{penName(pen)}</a>
            {:else}
              <p class="strong">{penName(pen)}</p>
            {/if}
            <p class="meta">
              Since {formatDate(fill.inked_at, dateFormat)} · {plural(daysBetween(fill.inked_at, Date.now()), 'day')}
            </p>
          </div>
        </div>
      {:else}
        <div class="card">
          <Icon name="drop" size={18} />
          <p class="grow strong">Not in a pen</p>
          {#if owner}<Button size="sm" icon="drop" onclick={() => ui.openInkFlow({ inkId: ink.id })}>Ink a pen</Button>{/if}
        </div>
      {/each}

      <h4 class="kicker spaced">Swatches</h4>
      <div class="thumbs">
        {#each swatches as swatch (swatch.id)}
          <a class="thumb" href={itemHref('swatch', swatch.id, { edit: false })}>
            <SwatchMedia {swatch} {ink} />
            <span>{[swatch.paper, swatch.nib].filter(Boolean).join(' · ') || 'Swatch'}</span>
          </a>
        {/each}
        {#if owner}
          <a class="add" href={newHref('swatch', ink.id)}>
            <Icon name="plus" size={16} />{swatches.length ? 'Add' : 'Add a swatch'}
          </a>
        {:else if !swatches.length}
          <p class="notes">No swatches yet.</p>
        {/if}
      </div>

      <h4 class="kicker spaced">Earlier pens</h4>
      {#if earlier.length}
        <ul class="history">
          {#each earlier as { fill, pen } (fill.id)}
            <li>
              <span class="dot" style:--c={pen.colors[0] ?? 'var(--muted)'}></span>
              <span>{penName(pen)}</span>
              <small>
                {formatDate(fill.inked_at, dateFormat, { short: true })} – {formatDate(fill.emptied_at ?? 0, dateFormat, {
                  short: true,
                })}
              </small>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="notes">No earlier pens recorded.</p>
      {/if}
    </section>
  </div>

  {#snippet footer()}
    <span>Added {formatDate(ink.created_at, dateFormat)}</span>
  {/snippet}
</Sheet>

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 26px;
    padding: 26px 28px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .title {
    flex: 1;
    min-width: 0;
  }
  .eyebrow {
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .hero h2 {
    font-size: 30px;
  }
  .meta {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .bottle {
    flex: none;
    width: 120px;
  }
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 28px;
    padding: 22px 28px;
  }
  .block {
    display: grid;
    gap: 10px;
    align-content: start;
  }
  h4.kicker {
    font-family: var(--font-body);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .spaced {
    margin-top: 12px;
  }
  .visibility {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  dl {
    display: grid;
    margin: 0;
  }
  dl div {
    display: grid;
    grid-template-columns: 130px minmax(0, 1fr);
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
  .notes {
    color: var(--muted);
    font-size: 13.5px;
    white-space: pre-line;
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
  .card > :global(svg) {
    color: var(--muted);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .strong {
    font-weight: 500;
  }
  .pen-thumb {
    flex: none;
    width: 72px;
  }
  .thumbs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .thumb {
    display: grid;
    align-content: start;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
  }
  .thumb:hover span {
    color: var(--fg);
  }
  .add {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    aspect-ratio: 4 / 3;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 12px;
    text-decoration: none;
  }
  .add:hover {
    border-color: var(--accent);
    color: var(--fg);
  }
  .history {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .history li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
  }
  .history small {
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 1px var(--line-strong);
  }
  @media (max-width: 700px) {
    .hero {
      padding: 20px 16px;
      gap: 16px;
    }
    .bottle {
      display: none;
    }
    .columns {
      grid-template-columns: minmax(0, 1fr);
      padding: 18px 16px;
    }
  }
</style>
