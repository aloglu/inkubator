<script lang="ts">
  /**
   * Development-only page listing the shared components, at /_components.
   * Uses the real collection where it helps (pickers, photos) and samples otherwise.
   */
  import { photoUrl } from '../../lib/api';
  import Button from '../../lib/components/Button.svelte';
  import Dialog from '../../lib/components/Dialog.svelte';
  import PenDrawing from '../../lib/components/PenDrawing.svelte';
  import PhotoFrame from '../../lib/components/PhotoFrame.svelte';
  import SearchPicker from '../../lib/components/SearchPicker.svelte';
  import Segmented from '../../lib/components/Segmented.svelte';
  import Sheet from '../../lib/components/Sheet.svelte';
  import SlotButton from '../../lib/components/SlotButton.svelte';
  import Swab from '../../lib/components/Swab.svelte';
  import { swabSheen } from '../../lib/ink';
  import Switch from '../../lib/components/Switch.svelte';
  import TextField from '../../lib/components/TextField.svelte';
  import { collection } from '../../lib/stores/collection.svelte';
  import type { Ink } from '../../lib/types/Ink';
  import type { Pen } from '../../lib/types/Pen';

  const sampleInks = [
    { base: '#1f3a5f', sheen: '#b0423a', name: 'Blue with red sheen' },
    { base: '#7a1f2b', sheen: null, name: 'Burgundy' },
    { base: '#2f6b4f', sheen: '#c9a43a', name: 'Green with gold sheen' },
    { base: '#d9a400', sheen: null, name: 'Yellow' },
    { base: '#3b3b3b', sheen: null, name: 'Black' },
  ];
  const sizes = ['xs', 'sm', 'md', 'lg', 'shelf'] as const;

  const inks = $derived(collection.data?.inks ?? []);
  const pens = $derived(collection.data?.pens ?? []);

  let view = $state<'cards' | 'shelf' | 'list'>('cards');
  let theme = $state<'system' | 'light' | 'dark'>(
    (document.documentElement.dataset.theme as 'light' | 'dark' | undefined) ?? 'system',
  );
  let enabled = $state(true);
  let text = $state('');
  let price = $state('');
  let notes = $state('');
  let sheetOpen = $state(false);
  let dialogOpen = $state(false);
  let picking: 'pen' | 'ink' | null = $state(null);
  let chosenPen: Pen | null = $state(null);
  let chosenInk: Ink | null = $state(null);
  let fitMode = $state<'cover' | 'fit'>('cover');

  $effect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  });

  const inkLabel = (ink: Ink) => [ink.brand, ink.line, ink.name].filter(Boolean).join(' ');
  const penLabel = (pen: Pen) => `${pen.brand} ${pen.model}`;
  const rank = <T,>(items: T[], label: (item: T) => string, query: string) =>
    items.filter((item) => label(item).toLowerCase().includes(query.toLowerCase())).slice(0, 8);

  const photoPens = $derived(pens.filter((pen) => pen.images.length > 0).slice(0, 3));
  const photoSwatch = $derived(collection.data?.swatches.find((swatch) => swatch.images.length > 0));
</script>

<div class="gallery">
  <header>
    <h2>Components</h2>
    <Segmented
      label="Theme"
      bind:value={theme}
      options={[
        { value: 'system', label: 'System' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ]}
    />
  </header>

  <section>
    <span class="kicker">Buttons</span>
    <div class="row">
      <Button icon="drop">Ink a pen</Button>
      <Button variant="ghost" icon="pencil-simple">Edit</Button>
      <Button variant="ghost" trailingIcon="caret-down" active>Re-ink</Button>
      <Button variant="danger" icon="trash">Delete</Button>
      <Button size="sm" icon="plus">Add</Button>
      <Button variant="ghost" icon="x" aria-label="Close" />
      <Button disabled>Disabled</Button>
    </div>
  </section>

  <section>
    <span class="kicker">Swabs</span>
    {#each sampleInks as ink (ink.name)}
      <div class="row">
        {#each sizes as size (size)}<Swab base={ink.base} sheen={ink.sheen} {size} label={ink.name} />{/each}
      </div>
    {/each}
  </section>

  <section>
    <span class="kicker">Pen drawings</span>
    <div class="row">
      <PenDrawing colors={['#1d4d3a']} />
      <PenDrawing colors={['#8a1c24', '#c9a43a']} />
      <PenDrawing colors={['#e8e2d0']} width={110} />
      <PenDrawing colors={[]} width={80} />
    </div>
  </section>

  <section>
    <span class="kicker">Controls</span>
    <div class="row">
      <Segmented
        label="View"
        bind:value={view}
        options={[
          { value: 'cards', label: 'Cards' },
          { value: 'shelf', label: 'Shelf' },
          { value: 'list', label: 'List' },
        ]}
      />
      <Switch label="Show notes" bind:checked={enabled} />
      <span class="muted">{view}, {enabled ? 'on' : 'off'}</span>
    </div>
    <div class="fields">
      <TextField label="Name" bind:value={text} placeholder="Blue Black" />
      <TextField label="Price" bind:value={price} prefix="€" inputmode="decimal" />
      <TextField label="Volume" value="50" suffix="ml" />
      <TextField label="Notes" bind:value={notes} multiline />
    </div>
  </section>

  <section>
    <span class="kicker">Photo frames ({photoPens.length ? 'from your collection' : 'no photos found'})</span>
    <Segmented
      label="Photo mode"
      bind:value={fitMode}
      options={[
        { value: 'cover', label: 'Cover' },
        { value: 'fit', label: 'Fit' },
      ]}
    />
    <div class="photos">
      {#each photoPens as pen (pen.id)}
        {@const image = pen.images.find((i) => i.primary) ?? pen.images[0]!}
        <figure>
          <PhotoFrame src={photoUrl(image.path)} {image} ratio={16 / 9} mode={fitMode} alt={penLabel(pen)}>
            {#snippet fallback()}<PenDrawing colors={pen.colors} />{/snippet}
          </PhotoFrame>
          <figcaption>{penLabel(pen)}, focus {image.focus_x.toFixed(2)}/{image.focus_y.toFixed(2)}, zoom {image.zoom}</figcaption>
        </figure>
      {/each}
      {#if photoPens[0]}
        {@const pen = photoPens[0]}
        {@const image = { ...(pen.images.find((i) => i.primary) ?? pen.images[0]!), rotation: 90 }}
        <figure>
          <PhotoFrame src={photoUrl(image.path)} {image} ratio={16 / 9} mode={fitMode} alt={penLabel(pen)} />
          <figcaption>{penLabel(pen)}, turned 90°</figcaption>
        </figure>
      {/if}
      {#if photoSwatch}
        <figure>
          <PhotoFrame src={photoUrl(photoSwatch.images[0]!.path)} image={photoSwatch.images[0]!} ratio={4 / 3} mode={fitMode} />
          <figcaption>Swatch, 4:3</figcaption>
        </figure>
      {/if}
      <figure>
        <PhotoFrame src="/api/photos/missing.webp" image={{ rotation: 0, focus_x: 0.5, focus_y: 0.5, zoom: 1 }} ratio={16 / 9}>
          {#snippet fallback()}<PenDrawing colors={['#2f6b4f']} />{/snippet}
        </PhotoFrame>
        <figcaption>Missing photo falls back to the drawing</figcaption>
      </figure>
    </div>
  </section>

  <section>
    <span class="kicker">Panels</span>
    <div class="row">
      <Button variant="ghost" onclick={() => (sheetOpen = true)}>Open side panel</Button>
      <Button variant="ghost" onclick={() => (dialogOpen = true)}>Open ink dialog</Button>
    </div>
  </section>
</div>

<Sheet open={sheetOpen} onclose={() => (sheetOpen = false)} kicker="Ink" title="Side panel">
  {#snippet actions()}<Button size="sm" icon="pencil-simple">Edit</Button>{/snippet}
  <div class="sheet-body">
    <p>Press Esc, click outside or use the close button.</p>
    {#each Array(30) as _, i (i)}<p class="muted">Scrolling content line {i + 1}</p>{/each}
  </div>
  {#snippet footer()}<span>Added Mar 2025</span>{/snippet}
</Sheet>

<Dialog open={dialogOpen} onclose={() => ((dialogOpen = false), (picking = null))} title="Ink a pen">
  <div class="sentence">
    <SlotButton
      label="Pen"
      placeholder="Choose a pen"
      value={chosenPen ? penLabel(chosenPen) : ''}
      open={picking === 'pen'}
      controls="pick-pen-list"
      onclick={() => (picking = picking === 'pen' ? null : 'pen')}
    >
      {#snippet media()}
        {#if chosenPen}<PenDrawing colors={chosenPen.colors} width={56} />{:else}<span class="empty-slot"></span>{/if}
      {/snippet}
    </SlotButton>
    <span class="muted">→</span>
    <SlotButton
      label="Ink"
      placeholder="Choose an ink"
      value={chosenInk?.name ?? ''}
      open={picking === 'ink'}
      controls="pick-ink-list"
      onclick={() => (picking = picking === 'ink' ? null : 'ink')}
    >
      {#snippet media()}
        {#if chosenInk}<Swab base={chosenInk.base_color} sheen={swabSheen(chosenInk)} size="sm" />{:else}<span class="empty-dot"></span>{/if}
      {/snippet}
    </SlotButton>
  </div>
  {#if picking === 'pen'}
    <SearchPicker
      id="pick-pen"
      placeholder="Search pens by name, brand or nib"
      suggestions={[{ label: 'Sample suggestions', items: pens.slice(0, 4) }]}
      search={(q) => rank(pens, (p) => `${penLabel(p)} ${p.nib_size}`, q)}
      key={(pen) => pen.id}
      selected={chosenPen?.id}
      hint="Start typing to search all your pens."
      onpick={(pen) => ((chosenPen = pen), (picking = null))}
      onclose={() => (picking = null)}
    >
      {#snippet item(pen)}
        <PenDrawing colors={pen.colors} width={44} /><span>{penLabel(pen)}</span><small>{pen.nib_size}</small>
      {/snippet}
    </SearchPicker>
  {:else if picking === 'ink'}
    <SearchPicker
      id="pick-ink"
      placeholder="Search inks by name, brand or color"
      suggestions={[{ label: 'Sample suggestions', items: inks.slice(0, 4) }]}
      search={(q) => rank(inks, inkLabel, q)}
      key={(ink) => ink.id}
      selected={chosenInk?.id}
      hint="Start typing to search all your inks."
      onpick={(ink) => ((chosenInk = ink), (picking = null))}
      onclose={() => (picking = null)}
    >
      {#snippet item(ink)}
        <Swab base={ink.base_color} sheen={swabSheen(ink)} size="sm" /><span>{ink.name}</span><small>{ink.brand}</small>
      {/snippet}
    </SearchPicker>
  {/if}
  {#snippet footer()}
    <span>{chosenPen && chosenInk ? 'Nothing is saved from this page.' : ''}</span>
    <div class="row">
      <Button variant="ghost" onclick={() => (dialogOpen = false)}>Cancel</Button>
      <Button icon="drop" disabled={!chosenPen || !chosenInk}>
        {chosenPen && chosenInk ? `Ink ${chosenPen.model} with ${chosenInk.name}` : 'Ink pen'}
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .gallery {
    display: grid;
    gap: 28px;
    max-width: 1100px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 16px;
    flex-wrap: wrap;
  }
  section {
    display: grid;
    gap: 12px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  figure {
    margin: 0;
    display: grid;
    gap: 6px;
  }
  figcaption {
    font-size: 12px;
    color: var(--muted);
  }
  .sheet-body {
    padding: 22px 24px;
    display: grid;
    gap: 8px;
  }
  .sentence {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }
  .empty-slot {
    width: 56px;
    height: 34px;
    flex: none;
    border: 1px dashed var(--line-strong);
    border-radius: 5px;
  }
  .empty-dot {
    width: 30px;
    height: 24px;
    flex: none;
    border: 1px dashed var(--line-strong);
    border-radius: 50%;
  }
</style>
