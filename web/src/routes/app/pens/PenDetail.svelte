<script lang="ts">
  /** One pen: the whole photo, details, what it holds now and what it held before. */
  import { flushPen } from '../../../lib/actions';
  import { photoUrl } from '../../../lib/api';
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import PenDrawing from '../../../lib/components/PenDrawing.svelte';
  import PhotoFrame from '../../../lib/components/PhotoFrame.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import { daysBetween, formatDate, plural } from '../../../lib/format';
  import { money, swabSheen } from '../../../lib/ink';
  import { router } from '../../../lib/router.svelte';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { ui } from '../../../lib/stores/ui.svelte';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Pen } from '../../../lib/types/Pen';
  import ReinkMenu from '../ReinkMenu.svelte';

  let { data, pen, onclose }: { data: Collection; pen: Pen; onclose: () => void } = $props();

  const dateFormat = $derived(data.settings.defaults.date_format);
  const inks = $derived(new Map(data.inks.map((ink) => [ink.id, ink])));
  const fills = $derived(data.fills.filter((fill) => fill.pen_id === pen.id));
  const fill = $derived(fills.find((f) => f.emptied_at === null));
  const ink = $derived(fill ? inks.get(fill.ink_id) : undefined);
  const earlier = $derived(
    fills
      .filter((f) => f.emptied_at !== null)
      .sort((a, b) => (b.emptied_at ?? 0) - (a.emptied_at ?? 0))
      .flatMap((f) => {
        const past = inks.get(f.ink_id);
        return past ? [{ fill: f, ink: past }] : [];
      }),
  );

  // Which photo is shown large; the main one unless another is picked.
  let shownId: string | null = $state(null);
  const photo = $derived(
    pen.images.find((image) => image.id === shownId) ?? pen.images.find((image) => image.primary) ?? pen.images[0],
  );

  /** `YYYY-MM-DD` or `YYYY-MM`, shown in the chosen date style. */
  function purchased(value: string | null): string | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month) return value;
    const ms = new Date(year, month - 1, day ?? 1, 12).getTime();
    return day
      ? formatDate(ms, dateFormat)
      : new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  const owner = $derived(collection.canEdit);
  // Visitors see only what is filled in; the owner also sees what is missing.
  const allRows = $derived([
    { label: 'Nib', value: pen.nib_size || null },
    { label: 'Nib material', value: pen.nib_material || null },
    { label: 'Filling', value: pen.filling_systems.join(', ') || null },
    { label: 'Body', value: pen.body_material || null },
    { label: 'Finish', value: pen.color_name || null },
    { label: 'Price', value: money(pen.price, data.settings.defaults.currency) },
    { label: 'Bought', value: purchased(pen.purchased_on) },
    { label: 'From', value: pen.purchased_from || null },
  ]);
  const rows = $derived(owner ? allRows : allRows.filter((row) => row.value !== null));

  async function remove() {
    const { id, model } = pen;
    if (
      data.settings.confirm_destructive_actions &&
      !(await ui.confirm({
        title: `Delete ${model}?`,
        message: fills.length
          ? `Its ink history (${plural(fills.length, 'fill')}) will be deleted with it. This cannot be undone.`
          : 'This cannot be undone.',
        confirm: 'Delete pen',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await collection.run({ type: 'delete_pen', id });
      ui.notify(`Deleted ${model}.`);
      onclose();
    } catch (error) {
      ui.fail(error);
    }
  }
</script>

<Sheet icon="pen-nib" open {onclose} title="Pen">
  {#snippet actions()}
    {#if owner}
      <Button variant="ghost" size="sm" icon="trash" aria-label="Delete" title="Delete" disabled={collection.saving} onclick={remove} />
      <Button size="sm" icon="pencil-simple" onclick={() => router.navigate(`/pens?pen=${encodeURIComponent(pen.id)}&edit`)}>
        Edit
      </Button>
    {/if}
  {/snippet}

  <div class="hero" class:has-photo={!!photo}>
    {#if photo}
      <div class="photo">
        <PhotoFrame src={photoUrl(photo.path)} image={photo} ratio={3 / 2} mode="fit" alt="{pen.brand} {pen.model}" />
      </div>
    {:else}
      <PenDrawing colors={pen.colors} width={240} />
    {/if}
    <div class="title">
      <div>
        <p class="eyebrow">{pen.brand}</p>
        <h2>{pen.model}</h2>
        {#if pen.color_name}<p class="meta">{pen.color_name}</p>{/if}
      </div>
      {#if pen.images.length > 1}
        <div class="strip" role="group" aria-label="Photos">
          {#each pen.images as image (image.id)}
            <button
              type="button"
              aria-pressed={image.id === photo?.id}
              aria-label={image.primary ? 'Main photo' : 'Photo'}
              onclick={() => (shownId = image.id)}
            >
              <img src={photoUrl(image.path, true)} alt="" style:transform="rotate({image.rotation}deg)" />
              {#if image.primary}<span class="star"><Icon name="star" size={11} /></span>{/if}
            </button>
          {/each}
        </div>
      {/if}
      {#if photo && owner}<p class="meta small">The whole photo is shown here; cards use the crop set in the editor.</p>{/if}
    </div>
  </div>

  <div class="columns">
    <section class="block">
      <h4 class="kicker">Details</h4>
      <dl>
        {#each rows as row (row.label)}
          <div><dt>{row.label}</dt><dd class:none={row.value === null}>{row.value ?? '—'}</dd></div>
        {/each}
      </dl>
      {#if pen.notes}
        <h4 class="kicker spaced">
          Notes
          {#if owner}<span class="visibility">
            <Icon name={pen.notes_public ? 'globe' : 'lock-simple'} size={12} />
            {pen.notes_public ? 'Shown on showcase' : 'Private'}
          </span>{/if}
        </h4>
        <p class="notes">{pen.notes}</p>
      {/if}
    </section>

    <section class="block">
      <h4 class="kicker">{fill ? 'Inked with' : 'Status'}</h4>
      {#if fill && ink}
        <div class="card">
          <div class="row">
            <Swab base={ink.base_color} sheen={swabSheen(ink)} />
            <div class="grow">
              <a class="strong" href="/inks?ink={encodeURIComponent(ink.id)}">{ink.name}</a>
              <p class="meta">
                Since {formatDate(fill.inked_at, dateFormat)} · {plural(daysBetween(fill.inked_at, Date.now()), 'day')}
              </p>
            </div>
          </div>
          {#if fill.note}<p class="meta">{fill.note}</p>{/if}
          {#if owner}
          <div class="row actions">
            <ReinkMenu {pen} current={ink} />
            <Button
              variant="ghost"
              size="sm"
              icon="arrows-counter-clockwise"
              disabled={collection.saving}
              onclick={() => flushPen(pen, ink.name)}
            >
              Flush
            </Button>
          </div>
          {/if}
        </div>
      {:else}
        <div class="card row">
          <Icon name="moon" size={18} />
          <p class="grow strong">Resting</p>
          {#if owner}<Button size="sm" icon="drop" onclick={() => ui.openInkFlow({ penId: pen.id })}>Ink this pen</Button>{/if}
        </div>
      {/if}

      <h4 class="kicker spaced">Earlier inks</h4>
      {#if earlier.length}
        <ul class="history">
          {#each earlier as { fill: past, ink: pastInk } (past.id)}
            <li>
              <Swab base={pastInk.base_color} sheen={swabSheen(pastInk)} size="xs" />
              <a href="/inks?ink={encodeURIComponent(pastInk.id)}">{pastInk.name}</a>
              <small>
                {formatDate(past.inked_at, dateFormat, { short: true })} – {formatDate(past.emptied_at ?? 0, dateFormat, {
                  short: true,
                })} · {plural(daysBetween(past.inked_at, past.emptied_at ?? 0), 'day')}
              </small>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="notes">No earlier inks recorded.</p>
      {/if}
    </section>
  </div>

  {#snippet footer()}
    <span>Added {formatDate(pen.created_at, dateFormat)}</span>
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
  .hero.has-photo {
    align-items: stretch;
  }
  .photo {
    flex: none;
    width: 360px;
  }
  .title {
    display: grid;
    align-content: space-between;
    gap: 14px;
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
  .small {
    font-size: 11.5px;
  }
  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .strip button {
    position: relative;
    display: grid;
    place-items: center;
    width: 60px;
    height: 45px;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    cursor: pointer;
  }
  .strip button[aria-pressed='true'] {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .strip img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .star {
    position: absolute;
    top: 2px;
    left: 3px;
    color: #fff;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--font-body);
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
    grid-template-columns: 120px minmax(0, 1fr);
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
    display: grid;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--raised);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .card.row > :global(svg) {
    color: var(--muted);
  }
  .actions {
    gap: 6px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .strong {
    color: inherit;
    font-weight: 500;
    text-decoration: none;
  }
  a.strong:hover,
  .history a:hover {
    text-decoration: underline;
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
  .history a {
    color: inherit;
    text-decoration: none;
  }
  .history small {
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 760px) {
    .hero {
      flex-direction: column;
      align-items: stretch;
      padding: 18px 16px;
    }
    .photo {
      width: 100%;
    }
    .columns {
      grid-template-columns: minmax(0, 1fr);
      padding: 18px 16px;
    }
  }
</style>
