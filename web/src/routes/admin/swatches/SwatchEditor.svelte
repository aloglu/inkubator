<script lang="ts">
  /**
   * Add or edit a swatch. The ink is one field with "Change"; photos can be
   * uploaded, added from a link or found on inkswatch.com, and cropped to 4:3.
   */
  import { untrack } from 'svelte';
  import { findInkswatch, photoUrl } from '../../../lib/api';
  import { familyName, inkFamily } from '../../../lib/color';
  import Button from '../../../lib/components/Button.svelte';
  import CropTool from '../../../lib/components/CropTool.svelte';
  import PhotoList from '../../../lib/components/PhotoList.svelte';
  import SearchPicker from '../../../lib/components/SearchPicker.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import SuggestField from '../../../lib/components/SuggestField.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import SwatchMedia from '../../../lib/components/SwatchMedia.svelte';
  import Switch from '../../../lib/components/Switch.svelte';
  import TextField from '../../../lib/components/TextField.svelte';
  import { formatDate, inkMaker, toDateInput } from '../../../lib/format';
  import { newId } from '../../../lib/ids';
  import { summary, swabSheen } from '../../../lib/ink';
  import { suggestions } from '../../../lib/pen';
  import { rank } from '../../../lib/search';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { describeError, ui } from '../../../lib/stores/ui.svelte';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Ink } from '../../../lib/types/Ink';
  import type { Swatch } from '../../../lib/types/Swatch';

  let {
    data,
    swatch,
    inkId,
    onclose,
  }: {
    data: Collection;
    /** The swatch to edit; a new swatch when absent. */
    swatch?: Swatch;
    /** For a new swatch: the ink to start with. */
    inkId?: string;
    /** Called with the saved swatch, or nothing when cancelled. */
    onclose: (saved?: Swatch) => void;
  } = $props();

  function blank(): Swatch {
    return {
      id: newId('swatch'),
      ink_id: inkId && data.inks.some((i) => i.id === inkId) ? inkId : '',
      paper: '',
      nib: '',
      sampled_on: toDateInput(Date.now()),
      notes: '',
      notes_public: false,
      images: [],
      created_at: 0,
      updated_at: 0,
    };
  }

  const original = untrack(() => (swatch ? structuredClone($state.snapshot(swatch)) : blank()));
  let draft: Swatch = $state(structuredClone(original));
  let error = $state('');
  let picking = $state(untrack(() => !original.ink_id));
  let cropping: string | undefined = $state(
    untrack(() => (original.images.find((i) => i.primary) ?? original.images[0])?.id),
  );

  const isNew = $derived(!swatch);
  const ink = $derived(data.inks.find((i) => i.id === draft.ink_id));
  const others = $derived(data.swatches.filter((s) => s.id !== draft.id));
  const paperSuggestions = $derived(suggestions(others.map((s) => s.paper), [], 6));
  const nibSuggestions = $derived(suggestions(others.map((s) => s.nib), [], 6));
  const cropIndex = $derived(draft.images.findIndex((image) => image.id === cropping));
  const dirty = $derived(JSON.stringify($state.snapshot(draft)) !== JSON.stringify(original));

  const unswatched = $derived.by(() => {
    const swatched = new Set(others.map((s) => s.ink_id));
    return data.inks.filter((i) => !swatched.has(i.id));
  });
  const searchInks = (query: string) =>
    rank(data.inks, (i) => [i.name, i.brand, i.line, familyName(inkFamily(i))], query);

  const lookup = $derived(
    ink
      ? {
          label: 'Find on inkswatch.com',
          find: async () => (await findInkswatch(`${ink.brand} ${ink.name}`)).image_url,
        }
      : undefined,
  );

  async function cancel() {
    if (
      dirty &&
      !(await ui.confirm({
        title: 'Discard changes?',
        message: isNew ? 'This swatch has not been saved.' : 'Your changes to this swatch have not been saved.',
        confirm: 'Discard',
        danger: true,
      }))
    ) {
      return;
    }
    onclose();
  }

  async function save(event?: SubmitEvent) {
    event?.preventDefault();
    if (!ink) {
      error = 'Choose the ink this swatch shows.';
      return;
    }
    const result: Swatch = {
      ...$state.snapshot(draft),
      paper: draft.paper.trim(),
      nib: draft.nib.trim(),
      notes: draft.notes.trim(),
      sampled_on: draft.sampled_on || null,
    };
    error = '';
    try {
      await collection.run({ type: 'save_swatch', swatch: result });
      ui.notify(isNew ? `Added a swatch of ${ink.name}.` : `Saved the swatch of ${ink.name}.`);
      onclose(collection.data?.swatches.find((s) => s.id === result.id) ?? result);
    } catch (failure) {
      error = describeError(failure);
    }
  }
</script>

<Sheet open onclose={cancel} kicker="Swatch" title={isNew ? 'New swatch' : 'Edit'} wide>
  <form id="swatch-form" class="editor" onsubmit={save}>
    <aside class="preview">
      {#if cropIndex >= 0}
        <CropTool
          src={photoUrl(draft.images[cropIndex]!.path)}
          bind:image={draft.images[cropIndex]!}
          ratio={4 / 3}
          label="Tile crop (4:3)"
        />
      {/if}
      <div class="tile-preview">
        <span>Tile preview</span>
        <SwatchMedia swatch={draft} {ink} thumb={false} />
      </div>
      <PhotoList
        bind:images={draft.images}
        bind:selected={cropping}
        selectable
        section="swatches"
        name={ink ? `${ink.brand} ${ink.name}` : 'swatch'}
        ratio={4 / 3}
        {lookup}
      />
    </aside>

    <div class="form">
      <fieldset>
        <legend class="kicker">Ink</legend>
        {#if ink}
          <div class="ink">
            <Swab base={ink.base_color} sheen={swabSheen(ink)} size="sm" />
            <div class="grow">
              <p class="strong">{ink.name}</p>
              <p class="meta">{[inkMaker(ink), summary(ink, 2)].filter(Boolean).join(' · ')}</p>
            </div>
            <Button variant="ghost" size="sm" active={picking} onclick={() => (picking = !picking)}>Change</Button>
          </div>
        {/if}
        {#if picking}
          <SearchPicker
            id="swatch-ink"
            placeholder="Search inks by name, brand or color"
            suggestions={[{ label: 'No swatch yet', items: unswatched.slice(0, 5) }]}
            search={searchInks}
            key={(i: Ink) => i.id}
            selected={draft.ink_id}
            hint="Start typing to search all your inks."
            onpick={(i) => {
              draft.ink_id = i.id;
              picking = false;
            }}
            onclose={() => (picking = false)}
          >
            {#snippet item(i)}
              <Swab base={i.base_color} sheen={swabSheen(i)} size="sm" />
              <span>{i.name}</span>
              <small>{i.brand}</small>
            {/snippet}
          </SearchPicker>
        {/if}
      </fieldset>

      <fieldset>
        <legend class="kicker">Sample</legend>
        <div class="row two">
          <SuggestField label="Paper" bind:value={draft.paper} suggestions={paperSuggestions} />
          <SuggestField label="Nib" bind:value={draft.nib} suggestions={nibSuggestions} />
        </div>
        <div class="date">
          <TextField label="Date" type="date" bind:value={() => draft.sampled_on ?? '', (v) => (draft.sampled_on = v || null)} max={toDateInput(Date.now())} />
        </div>
      </fieldset>

      <fieldset>
        <legend class="kicker">Notes</legend>
        <TextField label="Notes" bind:value={draft.notes} multiline placeholder="Paper, pen, conditions…" />
        <div class="switch-row">
          <div>
            <p>Show on showcase</p>
            <p class="meta">
              {data.settings.showcase.show_notes ? 'Off keeps these notes private.' : 'Notes are hidden on the showcase in Settings.'}
            </p>
          </div>
          <Switch label="Show notes on showcase" bind:checked={draft.notes_public} />
        </div>
      </fieldset>
    </div>
  </form>

  {#snippet footer()}
    <span class:error>
      {#if error}{error}
      {:else if isNew}New swatch
      {:else}Added {formatDate(original.created_at, data.settings.defaults.date_format)}{/if}
    </span>
    <div class="buttons">
      <Button variant="ghost" onclick={cancel}>Cancel</Button>
      <Button type="submit" form="swatch-form" icon="check" disabled={collection.saving}>
        {isNew ? 'Add swatch' : 'Save swatch'}
      </Button>
    </div>
  {/snippet}
</Sheet>

<style>
  .editor {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    min-height: 100%;
  }
  .preview {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 16px;
    padding: 20px 18px;
    border-right: 1px solid var(--line);
    background: var(--bg);
  }
  .tile-preview {
    display: grid;
    gap: 6px;
    width: 100%;
    color: var(--muted);
    font-size: 11.5px;
  }
  .form {
    display: grid;
    align-content: start;
    min-width: 0;
    padding: 6px 24px 20px;
  }
  fieldset {
    display: grid;
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 14px 0;
    border: 0;
    border-bottom: 1px solid var(--line);
  }
  fieldset:last-child {
    border-bottom: 0;
  }
  legend {
    float: left;
    width: 100%;
    margin-bottom: 2px;
    padding: 0;
  }
  .ink {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .strong {
    font-size: 13px;
    font-weight: 500;
  }
  .meta {
    color: var(--muted);
    font-size: 11.5px;
  }
  .row {
    display: grid;
    gap: 12px;
  }
  .two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .date {
    width: 180px;
  }
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .error {
    color: var(--danger);
  }
  .buttons {
    display: flex;
    gap: 8px;
  }
  @media (max-width: 760px) {
    .editor {
      grid-template-columns: minmax(0, 1fr);
    }
    .preview {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .form {
      padding: 6px 16px 20px;
    }
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
