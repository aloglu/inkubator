<script lang="ts">
  /**
   * Add or edit an ink. Properties are equal-width step scales split into "On
   * paper" and "In the pen"; base type and paper behaviour are toggle chips.
   */
  import { untrack } from 'svelte';
  import Button from '../../../lib/components/Button.svelte';
  import ChipToggles from '../../../lib/components/ChipToggles.svelte';
  import PhotoList from '../../../lib/components/PhotoList.svelte';
  import Segmented from '../../../lib/components/Segmented.svelte';
  import Sheet from '../../../lib/components/Sheet.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import Switch from '../../../lib/components/Switch.svelte';
  import TextField from '../../../lib/components/TextField.svelte';
  import { formatDate, inkMaker } from '../../../lib/format';
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

<Sheet open onclose={cancel} kicker="Ink" title={isNew ? 'New ink' : 'Edit'} wide>
  <form id="ink-form" class="editor" onsubmit={save}>
    <aside class="preview">
      <Swab base={draft.base_color} sheen={swabSheen(draft)} size="lg" />
      <div>
        <p class="preview-name">{draft.name || 'New ink'}</p>
        <p class="meta">{inkMaker(draft)}</p>
      </div>
      <div class="colors">
        <label>
          <input type="color" bind:value={draft.base_color} aria-label="Base color" />
          Base
        </label>
        {#if draft.sheen_color !== null}
          <label>
            <input type="color" bind:value={draft.sheen_color} aria-label="Sheen color" />
            Sheen
          </label>
          <button type="button" class="link" onclick={() => (draft.sheen_color = null)}>Remove sheen color</button>
        {:else}
          <button type="button" class="link" onclick={() => (draft.sheen_color = '#b0423a')}>Add sheen color</button>
        {/if}
      </div>
      {#if draft.sheen_color !== null && draft.sheen === 'none'}
        <p class="hint">The sheen color shows once Sheen is set above None.</p>
      {/if}
      <PhotoList bind:images={draft.images} section="inks" name={draft.name} ratio={1} label="Add a bottle photo" />
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
        <legend class="kicker">Bottle</legend>
        <div class="scale">
          <span>Type</span>
          <Segmented label="Type" bind:value={draft.kind} options={kinds} equal />
        </div>
        <div class="row three">
          <TextField label="Volume" bind:value={volume} suffix="ml" inputmode="decimal" />
          <TextField label="Amount" bind:value={amount} inputmode="numeric" />
          <TextField label="Price" bind:value={price} suffix={currency} inputmode="decimal" />
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
        <TextField label="Notes" bind:value={draft.notes} multiline placeholder="How it behaves, where it came from…" />
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
  .colors {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 10px 14px;
  }
  .colors label {
    display: grid;
    justify-items: center;
    gap: 4px;
    color: var(--muted);
    font-size: 11px;
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
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
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
    .three {
      grid-template-columns: minmax(0, 1fr);
    }
    .scale {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }
</style>
