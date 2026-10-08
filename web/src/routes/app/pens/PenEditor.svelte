<script lang="ts">
  /**
   * Add or edit a pen. The preview column holds the crop tool for the chosen
   * photo, a live card preview and the photos; everything else is in the form.
   */
  import { untrack } from 'svelte';
  import { photoUrl } from '../../../lib/api';
  import Button from '../../../lib/components/Button.svelte';
  import CropTool from '../../../lib/components/CropTool.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import PenDrawing from '../../../lib/components/PenDrawing.svelte';
  import PhotoFrame from '../../../lib/components/PhotoFrame.svelte';
  import MultiChoice from '../../../lib/components/MultiChoice.svelte';
  import PhotoList from '../../../lib/components/PhotoList.svelte';
  import PurchaseDate from '../../../lib/components/PurchaseDate.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import SuggestField from '../../../lib/components/SuggestField.svelte';
  import Switch from '../../../lib/components/Switch.svelte';
  import TextField from '../../../lib/components/TextField.svelte';
  import { formatDate } from '../../../lib/format';
  import { newId } from '../../../lib/ids';
  import { fillingSystems, isPurchaseDate, nibMaterials, nibSizes, suggestions } from '../../../lib/pen';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { describeError, ui } from '../../../lib/stores/ui.svelte';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Pen } from '../../../lib/types/Pen';

  const MAX_COLORS = 4;

  let {
    data,
    pen,
    onclose,
  }: {
    data: Collection;
    /** The pen to edit; a new pen when absent. */
    pen?: Pen;
    /** Called with the saved pen, or nothing when cancelled. */
    onclose: (saved?: Pen) => void;
  } = $props();

  function blank(): Pen {
    return {
      id: newId('pen'),
      brand: '',
      model: '',
      color_name: '',
      colors: ['#2f3b4a'],
      nib_size: data.settings.defaults.nib_size,
      nib_material: data.settings.defaults.nib_material,
      body_material: '',
      filling_systems: [],
      price: null,
      purchased_on: null,
      purchased_from: '',
      notes: '',
      notes_public: false,
      images: [],
      created_at: 0,
      updated_at: 0,
    };
  }

  const original = untrack(() => (pen ? structuredClone($state.snapshot(pen)) : blank()));
  let draft: Pen = $state(structuredClone(original));
  let price = $state(original.price === null ? '' : String(original.price));
  let bought = $state(original.purchased_on ?? '');
  let error = $state('');
  /** The photo shown in the crop tool, if any. */
  let adjusting: string | undefined = $state();

  const isNew = $derived(!pen);
  const others = $derived(data.pens.filter((p) => p.id !== draft.id));
  const sizeSuggestions = $derived(suggestions(others.map((p) => p.nib_size), nibSizes));
  const materialSuggestions = $derived(suggestions(others.map((p) => p.nib_material), nibMaterials, 6));
  const fillingOptions = $derived(suggestions(others.flatMap((p) => p.filling_systems), fillingSystems, 10));
  const brands = $derived([...new Set(others.map((p) => p.brand).filter(Boolean))].sort());
  const bodies = $derived([...new Set(others.map((p) => p.body_material).filter(Boolean))].sort());
  const adjustIndex = $derived(draft.images.findIndex((image) => image.id === adjusting));
  const cardImage = $derived(draft.images.find((i) => i.primary) ?? draft.images[0]);

  const dirty = $derived(
    JSON.stringify($state.snapshot(draft)) !== JSON.stringify(original) ||
      price !== (original.price === null ? '' : String(original.price)) ||
      bought !== (original.purchased_on ?? ''),
  );

  function build(): Pen | string {
    const trimmedPrice = price.trim().replace(',', '.');
    const cost = trimmedPrice ? Number(trimmedPrice) : null;
    const date = bought.trim();
    if (!draft.brand.trim() && !draft.model.trim()) return 'Give the pen a brand or a model.';
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return 'Price must be a number.';
    if (date && !isPurchaseDate(date)) return 'Choose the date you bought it, or leave it empty.';
    return {
      ...$state.snapshot(draft),
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      color_name: draft.color_name.trim(),
      nib_size: draft.nib_size.trim(),
      nib_material: draft.nib_material.trim(),
      body_material: draft.body_material.trim(),
      filling_systems: draft.filling_systems.map((s) => s.trim()).filter(Boolean),
      purchased_from: draft.purchased_from.trim(),
      notes: draft.notes.trim(),
      price: cost,
      purchased_on: date || null,
    };
  }

  async function cancel() {
    if (
      dirty &&
      !(await ui.confirm({
        title: 'Discard changes?',
        message: isNew ? 'This pen has not been saved.' : `Your changes to ${original.model || original.brand} have not been saved.`,
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
    const result = build();
    if (typeof result === 'string') {
      error = result;
      return;
    }
    error = '';
    try {
      await collection.run({ type: 'save_pen', pen: result });
      ui.notify(isNew ? `Added ${result.model || result.brand}.` : `Saved ${result.model || result.brand}.`);
      onclose(collection.data?.pens.find((p) => p.id === result.id) ?? result);
    } catch (failure) {
      error = describeError(failure);
    }
  }
</script>

<Sheet icon="pen-nib" open onclose={cancel} title={isNew ? 'New pen' : 'Edit pen'} wide>
  <form id="pen-form" class="editor" onsubmit={save}>
    <aside class="preview">
      {#if adjustIndex >= 0}
        <div class="adjust">
          <CropTool
            src={photoUrl(draft.images[adjustIndex]!.path)}
            bind:image={draft.images[adjustIndex]!}
            ratio={16 / 9}
            label="Card crop (16:9)"
          />
          <Button size="sm" icon="check" onclick={() => (adjusting = undefined)}>Done</Button>
        </div>
      {:else if cardImage}
        <div class="card-preview">
          <PhotoFrame src={photoUrl(cardImage.path)} image={cardImage} ratio={16 / 9} radius="var(--radius-sm)" />
          <Button variant="ghost" size="sm" icon="pencil-simple" onclick={() => (adjusting = cardImage.id)}>Adjust photo</Button>
        </div>
      {:else}
        <PenDrawing colors={draft.colors} width={190} />
      {/if}
      <div class="name">
        <p class="preview-name">{draft.model || 'New pen'}</p>
        <p class="meta">{[draft.brand, draft.color_name].filter(Boolean).join(' · ')}</p>
      </div>
      <PhotoList
        bind:images={draft.images}
        {adjusting}
        onadjust={(id) => (adjusting = id)}
        section="pens"
        name={[draft.brand, draft.model].filter(Boolean).join(' ')}
        ratio={4 / 3}
      />
    </aside>

    <div class="form">
      <fieldset>
        <legend class="kicker">Pen</legend>
        <div class="row three">
          <TextField label="Brand" bind:value={draft.brand} list="pen-brands" autocomplete="off" />
          <TextField label="Model" bind:value={draft.model} autocomplete="off" />
          <TextField label="Body material" bind:value={draft.body_material} list="pen-bodies" autocomplete="off" />
        </div>
        <datalist id="pen-brands">{#each brands as brand (brand)}<option value={brand}></option>{/each}</datalist>
        <datalist id="pen-bodies">{#each bodies as body (body)}<option value={body}></option>{/each}</datalist>
      </fieldset>

      <fieldset>
        <legend class="kicker">Color</legend>
        <TextField label="Finish" bind:value={draft.color_name} placeholder="e.g. Green Stripe, Demonstrator" autocomplete="off" />
        <div class="scale">
          <span>Body colors</span>
          <div class="swatches">
            {#each draft.colors as _, index (index)}
              <span class="color">
                <input type="color" bind:value={draft.colors[index]} aria-label="Body color {index + 1}" />
                {#if draft.colors.length > 1}
                  <button
                    type="button"
                    aria-label="Remove color {index + 1}"
                    onclick={() => (draft.colors = draft.colors.filter((__, i) => i !== index))}
                  >
                    <Icon name="x" size={10} />
                  </button>
                {/if}
              </span>
            {/each}
            {#if draft.colors.length < MAX_COLORS}
              <button
                type="button"
                class="add-color"
                aria-label="Add a color"
                onclick={() => (draft.colors = [...draft.colors, draft.colors.at(-1) ?? '#2f3b4a'])}
              >
                <Icon name="plus" size={12} />
              </button>
            {/if}
          </div>
        </div>
        <p class="hint">Up to four. They draw the pen when it has no photo, and its dot in lists.</p>
      </fieldset>

      <fieldset>
        <legend class="kicker">Nib</legend>
        <div class="row two">
          <SuggestField label="Size" bind:value={draft.nib_size} suggestions={sizeSuggestions} />
          <SuggestField label="Material" bind:value={draft.nib_material} suggestions={materialSuggestions} />
        </div>
      </fieldset>

      <fieldset>
        <legend class="kicker">Filling</legend>
        <MultiChoice label="Filling system" bind:value={draft.filling_systems} options={fillingOptions} />
      </fieldset>

      <fieldset>
        <legend class="kicker">Purchase</legend>
        <div class="row three">
          <TextField label="Price" bind:value={price} suffix={data.settings.defaults.currency} inputmode="decimal" />
          <PurchaseDate label="Bought" bind:value={bought} />
          <TextField label="From" bind:value={draft.purchased_from} placeholder="Shop or person" autocomplete="off" />
        </div>
      </fieldset>

      <fieldset>
        <legend class="kicker">Notes</legend>
        <TextField label="Notes" bind:value={draft.notes} multiline hideLabel placeholder="Anything worth remembering" />
        <div class="scale">
          <span>Show to visitors</span>
          <div class="visibility">
            <Switch label="Show notes to visitors" bind:checked={draft.notes_public} />
            <span class="hint">{data.settings.showcase.show_notes ? 'Off keeps these notes private.' : 'Notes are hidden from visitors in Settings.'}</span>
          </div>
        </div>
      </fieldset>
    </div>
  </form>

  {#snippet footer()}
    <span class:error>
      {#if error}{error}
      {:else if isNew}New pen
      {:else}Added {formatDate(original.created_at, data.settings.defaults.date_format)}{/if}
    </span>
    <div class="buttons">
      <Button variant="ghost" onclick={cancel}>Cancel</Button>
      <Button type="submit" form="pen-form" icon="check" disabled={collection.saving}>{isNew ? 'Add pen' : 'Save pen'}</Button>
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
    text-align: center;
  }
  .card-preview,
  .adjust {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: 100%;
  }
  .name {
    display: grid;
    gap: 2px;
  }
  .preview-name {
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .meta {
    color: var(--muted);
    font-size: 12px;
  }
  .scale {
    display: grid;
    grid-template-columns: 124px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .hint {
    color: var(--muted);
    font-size: 11.5px;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 5px;
  }
  .color {
    position: relative;
  }
  .color button {
    position: absolute;
    top: -5px;
    right: -6px;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: var(--raised);
    color: var(--muted);
    cursor: pointer;
  }
  input[type='color'] {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }
  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  input[type='color']::-webkit-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  input[type='color']::-moz-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  .add-color {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px dashed var(--line-strong);
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: pointer;
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
  .row {
    display: grid;
    gap: 12px;
  }
  .two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .visibility {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
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
    .two,
    .three {
      grid-template-columns: minmax(0, 1fr);
    }
    .scale {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }
</style>
