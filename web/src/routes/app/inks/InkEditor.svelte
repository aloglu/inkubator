<script lang="ts">
  /**
   * Add or edit an ink. Properties are equal-width step scales split into "On
   * paper" and "In the pen"; base type and paper behaviour are toggle chips.
   */
  import { untrack } from 'svelte';
  import { colorFamily, familyName, families } from '../../../lib/color';
  import Button from '../../../lib/components/Button.svelte';
  import ChipToggles from '../../../lib/components/ChipToggles.svelte';
  import ColorInput from '../../../lib/components/ColorInput.svelte';
  import PhotoList from '../../../lib/components/PhotoList.svelte';
  import Segmented from '../../../lib/components/Segmented.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import Switch from '../../../lib/components/Switch.svelte';
  import TextField from '../../../lib/components/TextField.svelte';
  import { formatDate } from '../../../lib/format';
  import { newId } from '../../../lib/ids';
  import {
    baseTypes,
    flows,
    kinds,
    levels,
    paperBehaviors,
    sheens,
    shimmers,
    swabSheen,
    waterResistances,
  } from '../../../lib/ink';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { describeError, ui } from '../../../lib/stores/ui.svelte';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Ink } from '../../../lib/types/Ink';

  let {
    data,
    ink,
    onclose,
  }: {
    data: Collection;
    /** The ink to edit; a new ink when absent. */
    ink?: Ink;
    /** Called with the saved ink, or nothing when cancelled. */
    onclose: (saved?: Ink) => void;
  } = $props();

  function blank(): Ink {
    return {
      id: newId('ink'),
      brand: '',
      line: '',
      name: '',
      kind: data.settings.defaults.ink_kind,
      volume_ml: null,
      amount: 1,
      price: null,
      base_color: '#2f4f7f',
      sheen_color: null,
      color_family: null,
      shimmer: 'none',
      sheen: 'none',
      shading: 'none',
      water_resistance: 'none',
      flow: 'average',
      lubrication: 'none',
      dry_time_seconds: null,
      base_types: ['dye'],
      paper: [],
      notes: '',
      notes_public: false,
      images: [],
      created_at: 0,
      updated_at: 0,
    };
  }

  const text = (value: number | null) => (value === null ? '' : String(value));

  // The form works on a copy; numbers are edited as text and checked on save.
  const original = untrack(() => (ink ? structuredClone($state.snapshot(ink)) : blank()));
  let draft: Ink = $state(structuredClone(original));
  let volume = $state(text(original.volume_ml));
  let amount = $state(String(original.amount));
  let price = $state(text(original.price));
  let dryTime = $state(text(original.dry_time_seconds));
  let error = $state('');

  const isNew = $derived(!ink);
  const currency = $derived(data.settings.defaults.currency);
  const brands = $derived([...new Set(data.inks.map((i) => i.brand).filter(Boolean))].sort());
  const lines = $derived(
    [...new Set(data.inks.filter((i) => !draft.brand || i.brand === draft.brand).map((i) => i.line).filter(Boolean))].sort(),
  );
  const inPens = $derived(data.fills.filter((f) => f.ink_id === draft.id && f.emptied_at === null).length);
  const swatchCount = $derived(data.swatches.filter((s) => s.ink_id === draft.id).length);

  /** Parses an optional number; `undefined` means the text is not a valid number. */
  function parse(value: string, { integer = false } = {}): number | null | undefined {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) return null;
    const number = Number(trimmed);
    if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) return undefined;
    return number;
  }

  function build(): Ink | string {
    const volumeMl = parse(volume);
    const count = parse(amount, { integer: true });
    const cost = parse(price);
    const seconds = parse(dryTime, { integer: true });
    if (!draft.name.trim()) return 'Give the ink a name.';
    if (volumeMl === undefined || volumeMl === 0) return 'Volume must be a positive number of millilitres.';
    if (count === undefined || count === null) return 'Amount must be a whole number.';
    if (cost === undefined) return 'Price must be a number.';
    if (seconds === undefined) return 'Dry time must be a whole number of seconds.';
    return {
      ...$state.snapshot(draft),
      brand: draft.brand.trim(),
      line: draft.line.trim(),
      name: draft.name.trim(),
      notes: draft.notes.trim(),
      volume_ml: volumeMl,
      amount: count,
      price: cost,
      dry_time_seconds: seconds,
    };
  }

  const dirty = $derived(
    JSON.stringify($state.snapshot(draft)) !== JSON.stringify(original) ||
      volume !== text(original.volume_ml) ||
      amount !== String(original.amount) ||
      price !== text(original.price) ||
      dryTime !== text(original.dry_time_seconds),
  );

  async function cancel() {
    if (
      dirty &&
      !(await ui.confirm({
        title: 'Discard changes?',
        message: isNew ? 'This ink has not been saved.' : `Your changes to ${original.name} have not been saved.`,
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
      await collection.run({ type: 'save_ink', ink: result });
      ui.notify(isNew ? `Added ${result.name}.` : `Saved ${result.name}.`);
      onclose(collection.data?.inks.find((i) => i.id === result.id) ?? result);
    } catch (failure) {
      error = describeError(failure);
    }
  }
</script>

<Sheet icon="drop" open onclose={cancel} title={isNew ? 'New Ink' : 'Edit'}
  name={isNew ? undefined : [original.brand, original.name].filter(Boolean).join(' ')}
  wide
>
  <form id="ink-form" class="editor" onsubmit={save}>
    <aside class="preview">
      <Swab base={draft.base_color} sheen={swabSheen(draft)} size="lg" />
      <div class="photos">
        <p class="kicker">Photos</p>
        <PhotoList bind:images={draft.images} section="inks" name={draft.name} ratio={1} label="Add a bottle photo" />
      </div>
    </aside>

    <div class="form">
      <fieldset>
        <legend class="kicker">Ink</legend>
        <div class="row three">
          <TextField label="Brand" bind:value={draft.brand} list="ink-brands" autocomplete="off" />
          <TextField label="Name" bind:value={draft.name} required autocomplete="off" />
          <TextField label="Line" bind:value={draft.line} list="ink-lines" autocomplete="off" />
        </div>
        <datalist id="ink-brands">{#each brands as brand (brand)}<option value={brand}></option>{/each}</datalist>
        <datalist id="ink-lines">{#each lines as line (line)}<option value={line}></option>{/each}</datalist>
      </fieldset>

      <fieldset>
        <legend class="kicker">Color</legend>
        <div class="scale">
          <span>Base color</span>
          <ColorInput label="Base color" bind:value={draft.base_color} />
        </div>
        <div class="scale">
          <span>Sheen color</span>
          <ColorInput label="Sheen color" bind:value={draft.sheen_color} fallback="#b0423a" />
        </div>
        {#if draft.sheen_color !== null && draft.sheen === 'none'}
          <p class="hint">The sheen color shows on the swab once Sheen (under On paper) is above None.</p>
        {/if}
        <div class="scale">
          <span>Shelf group</span>
          <select class="family" bind:value={draft.color_family} aria-label="Shelf group">
            <option value={null}>Automatic ({familyName(colorFamily(draft.base_color))})</option>
            {#each families as family (family)}<option value={family}>{familyName(family)}</option>{/each}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend class="kicker">Bottle</legend>
        <div class="row three">
          <TextField label="Volume" bind:value={volume} suffix="ml" inputmode="decimal" />
          <TextField label="Amount" bind:value={amount} inputmode="numeric" />
          <TextField label="Price" bind:value={price} suffix={currency} inputmode="decimal" />
        </div>
        <div class="scale">
          <span>Type</span>
          <Segmented label="Type" bind:value={draft.kind} options={kinds} equal />
        </div>
      </fieldset>

      <fieldset>
        <legend class="kicker">On paper</legend>
        <div class="scale"><span>Shimmer</span><Segmented label="Shimmer" bind:value={draft.shimmer} options={shimmers} equal /></div>
        <div class="scale"><span>Sheen</span><Segmented label="Sheen" bind:value={draft.sheen} options={sheens} equal /></div>
        <div class="scale"><span>Shading</span><Segmented label="Shading" bind:value={draft.shading} options={levels} equal /></div>
        <div class="scale">
          <span>Water resistance</span>
          <Segmented label="Water resistance" bind:value={draft.water_resistance} options={waterResistances} equal />
        </div>
        <div class="scale"><span>Paper</span><ChipToggles label="Paper behaviour" bind:value={draft.paper} options={paperBehaviors} /></div>
      </fieldset>

      <fieldset>
        <legend class="kicker">In the pen</legend>
        <div class="scale"><span>Flow</span><Segmented label="Flow" bind:value={draft.flow} options={flows} equal /></div>
        <div class="scale">
          <span>Lubrication</span><Segmented label="Lubrication" bind:value={draft.lubrication} options={levels} equal />
        </div>
        <div class="scale">
          <span>Dry time</span>
          <div class="short"><TextField label="Dry time in seconds" bind:value={dryTime} suffix="s" inputmode="numeric" /></div>
        </div>
        <div class="scale"><span>Base</span><ChipToggles label="Base" bind:value={draft.base_types} options={baseTypes} /></div>
      </fieldset>

      <fieldset>
        <legend class="kicker">Notes</legend>
        <TextField label="Notes" bind:value={draft.notes} multiline hideLabel placeholder="How it behaves, where it came from…" />
        <div class="scale">
          <span>Show to visitors</span>
          <Switch label="Show notes to visitors" bind:checked={draft.notes_public} />
        </div>
        <p class="hint">{data.settings.showcase.show_notes ? 'Off keeps these notes private.' : 'Notes are hidden from visitors in Settings.'}</p>
      </fieldset>
    </div>
  </form>

  {#snippet footer()}
    <span class:error>
      {#if error}{error}
      {:else if isNew}New ink
      {:else}{inPens ? `In ${inPens} ${inPens === 1 ? 'pen' : 'pens'}` : 'Not in a pen'} · {swatchCount}
        {swatchCount === 1 ? 'swatch' : 'swatches'} · Added {formatDate(original.created_at, data.settings.defaults.date_format)}{/if}
    </span>
    <div class="buttons">
      <Button variant="ghost" onclick={cancel}>Cancel</Button>
      <Button type="submit" form="ink-form" icon="check" disabled={collection.saving}>{isNew ? 'Add ink' : 'Save ink'}</Button>
    </div>
  {/snippet}
</Sheet>

<style>
  .editor {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    min-height: 100%;
  }
  .preview {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 14px;
    padding: 24px 20px;
    border-right: 1px solid var(--line);
    background: var(--bg);
    text-align: center;
  }
  .photos {
    display: grid;
    gap: 8px;
    width: 100%;
    text-align: left;
  }
  .family {
    justify-self: start;
    max-width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-size: 13px;
  }
  .hint {
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
  .row {
    display: grid;
    gap: 12px;
  }
  .three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .scale {
    display: grid;
    grid-template-columns: 124px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .short {
    width: 140px;
  }
  .short :global(label) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
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
    .three {
      grid-template-columns: minmax(0, 1fr);
    }
    .scale {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }
</style>
