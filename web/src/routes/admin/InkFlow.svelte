<script lang="ts">
  /**
   * Ink a pen: a sentence, [pen] → [ink]. Each side opens a search picker with a
   * few suggestions. Inking a pen that holds another ink records a re-ink.
   */
  import { familyName, inkFamily } from '../../lib/color';
  import Button from '../../lib/components/Button.svelte';
  import Dialog from '../../lib/components/Dialog.svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import PenMedia from '../../lib/components/PenMedia.svelte';
  import SearchPicker from '../../lib/components/SearchPicker.svelte';
  import SlotButton from '../../lib/components/SlotButton.svelte';
  import Swab from '../../lib/components/Swab.svelte';
  import { swabSheen } from '../../lib/ink';
  import TextField from '../../lib/components/TextField.svelte';
  import { formatDate, fromDateInput, inkMaker, penName, toDateInput } from '../../lib/format';
  import { rank } from '../../lib/search';
  import { collection } from '../../lib/stores/collection.svelte';
  import { describeError, ui } from '../../lib/stores/ui.svelte';
  import { earlierInks, openFills, restingInks, restingPens } from '../../lib/suggestions';
  import type { Ink } from '../../lib/types/Ink';
  import type { Pen } from '../../lib/types/Pen';

  let penId: string | null = $state(null);
  let inkId: string | null = $state(null);
  let picking: 'pen' | 'ink' | null = $state(null);
  let date = $state('');
  let note = $state('');
  let noteOpen = $state(false);
  /** Shown in the dialog itself: notices would sit behind it. */
  let error = $state('');

  const data = $derived(collection.data);
  const pen = $derived(data?.pens.find((p) => p.id === penId) ?? null);
  const ink = $derived(data?.inks.find((i) => i.id === inkId) ?? null);
  const inks = $derived(new Map(data?.inks.map((i) => [i.id, i]) ?? []));
  const open = $derived(data ? openFills(data.fills) : new Map());
  const currentInk = $derived(pen ? inks.get(open.get(pen.id)?.ink_id ?? '') : undefined);
  const today = $derived(toDateInput(Date.now()));
  const dateFormat = $derived(data?.settings.defaults.date_format ?? 'system');

  // Start fresh each time the dialog opens, with whatever side was prefilled.
  $effect(() => {
    const request = ui.inkFlow;
    if (!request) return;
    penId = request.penId;
    inkId = request.inkId;
    picking = request.penId ? (request.inkId ? null : 'ink') : 'pen';
    date = toDateInput(Date.now());
    note = '';
    noteOpen = false;
    error = '';
  });

  // A new choice makes an earlier error irrelevant.
  $effect(() => {
    void [penId, inkId, date];
    error = '';
  });

  const penSuggestions = $derived(
    data ? [{ label: 'Resting, most recently used', items: restingPens(data, Date.now()).slice(0, 4) }] : [],
  );

  const inkSuggestions = $derived.by(() => {
    if (!data) return [];
    const earlier = pen ? earlierInks(data, pen.id).slice(0, 3) : [];
    const shown = new Set(earlier.map((entry) => entry.ink.id));
    return [
      ...(pen && earlier.length ? [{ label: `Last in ${pen.model}`, items: earlier.map((entry) => entry.ink) }] : []),
      { label: 'Not in a pen for a while', items: restingInks(data, Date.now(), shown).slice(0, 3) },
    ];
  });

  /** When an earlier ink last left this pen, for the suggestion's subtitle. */
  const lastInPen = $derived(
    new Map(pen && data ? earlierInks(data, pen.id).map((entry) => [entry.ink.id, entry.fill.emptied_at ?? 0]) : []),
  );

  const searchPens = (query: string) =>
    rank(data?.pens ?? [], (p) => [p.model, p.brand, p.nib_size, p.color_name], query);
  const searchInks = (query: string) =>
    rank(data?.inks ?? [], (i) => [i.name, i.brand, i.line, familyName(inkFamily(i))], query);

  const sameInk = $derived(!!pen && !!ink && currentInk?.id === ink.id);
  const ready = $derived(!!pen && !!ink && !sameInk && !!fromDateInput(date) && date <= today);

  function close() {
    picking = null;
    ui.closeInkFlow();
  }

  async function submit() {
    if (!pen || !ink || !ready) return;
    try {
      await collection.run({
        type: 'ink_pen',
        pen_id: pen.id,
        ink_id: ink.id,
        at: date === today ? null : fromDateInput(date),
        note: note.trim(),
      });
      ui.notify(`Inked ${pen.model} with ${ink.name}.`);
      close();
    } catch (failure) {
      error = describeError(failure);
    }
  }
</script>

<Dialog open={ui.inkFlow !== null} onclose={close} title="Ink a pen" fullscreenOnPhone>
  <div class="sentence">
    <SlotButton
      label="Pen"
      placeholder="Choose a pen"
      value={pen ? penName(pen) : ''}
      open={picking === 'pen'}
      controls="ink-flow-pen-list"
      onclick={() => (picking = picking === 'pen' ? null : 'pen')}
    >
      {#snippet media()}
        {#if pen}<span class="pen-thumb"><PenMedia {pen} radius="5px" /></span>{:else}<span class="empty-pen"></span>{/if}
      {/snippet}
    </SlotButton>
    <span class="arrow"><Icon name="arrow-right" size={16} /></span>
    <SlotButton
      label="Ink"
      placeholder="Choose an ink"
      value={ink?.name ?? ''}
      open={picking === 'ink'}
      controls="ink-flow-ink-list"
      onclick={() => (picking = picking === 'ink' ? null : 'ink')}
    >
      {#snippet media()}
        {#if ink}<Swab base={ink.base_color} sheen={swabSheen(ink)} size="sm" />{:else}<span class="empty-ink"></span>{/if}
      {/snippet}
    </SlotButton>
  </div>

  {#if picking === 'pen'}
    <SearchPicker
      id="ink-flow-pen"
      placeholder="Search pens by name, brand or nib"
      suggestions={penSuggestions}
      search={searchPens}
      key={(p: Pen) => p.id}
      selected={pen?.id}
      hint="Start typing to search all your pens. Inked pens appear too, and are flushed first."
      onpick={(p) => {
        penId = p.id;
        picking = ink ? null : 'ink';
      }}
      onclose={() => (picking = null)}
    >
      {#snippet item(p)}
        {@const holding = inks.get(open.get(p.id)?.ink_id ?? '')}
        <span class="pen-thumb small"><PenMedia pen={p} radius="4px" /></span>
        <span>{penName(p)}</span>
        {#if holding}<Swab base={holding.base_color} sheen={swabSheen(holding)} size="xs" label="Inked with {holding.name}" />{/if}
        <small>{p.nib_size}</small>
      {/snippet}
    </SearchPicker>
  {:else if picking === 'ink'}
    <SearchPicker
      id="ink-flow-ink"
      placeholder="Search inks by name, brand or color"
      suggestions={inkSuggestions}
      search={searchInks}
      key={(i: Ink) => i.id}
      selected={ink?.id}
      hint="Start typing to search all your inks."
      onpick={(i) => {
        inkId = i.id;
        picking = pen ? null : 'pen';
      }}
      onclose={() => (picking = null)}
    >
      {#snippet item(i)}
        {@const until = lastInPen.get(i.id)}
        <Swab base={i.base_color} sheen={swabSheen(i)} size="sm" />
        <span>{i.name}</span>
        <small>{until ? `until ${formatDate(until, dateFormat, { short: true })}` : inkMaker(i)}</small>
      {/snippet}
    </SearchPicker>
  {:else}
    <div class="more">
      <label class="date">
        <Icon name="calendar-blank" size={15} />
        <span class="visually-hidden">Date</span>
        <input type="date" bind:value={date} max={today} required />
      </label>
      {#if !noteOpen}
        <button type="button" class="link" onclick={() => (noteOpen = true)}><Icon name="plus" size={14} />Add a note</button>
      {/if}
    </div>
    {#if noteOpen}
      <!-- svelte-ignore a11y_autofocus -->
      <TextField label="Note" bind:value={note} placeholder="e.g. a sample from a friend" autofocus />
    {/if}
  {/if}

  {#snippet footer()}
    <span class:error>
      {#if error}{error}
      {:else if sameInk}{pen?.model} already holds {ink?.name}.
      {:else if currentInk}Records a flush of {currentInk.name} first.
      {:else if pen}{pen.model} is resting.{/if}
    </span>
    <div class="buttons">
      <Button variant="ghost" onclick={close}>Cancel</Button>
      <Button icon="drop" disabled={!ready || collection.saving} onclick={submit}>
        {pen && ink ? `Ink ${pen.model} with ${ink.name}` : 'Ink pen'}
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .sentence {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }
  .arrow {
    display: grid;
    color: var(--muted);
  }
  .pen-thumb {
    flex: none;
    width: 56px;
  }
  .pen-thumb.small {
    width: 44px;
  }
  .error {
    color: var(--danger);
  }
  .empty-pen {
    flex: none;
    width: 56px;
    height: 34px;
    border: 1px dashed var(--line-strong);
    border-radius: 5px;
  }
  .empty-ink {
    flex: none;
    width: 30px;
    height: 24px;
    border: 1px dashed var(--line-strong);
    border-radius: 50%;
  }
  .more {
    display: flex;
    align-items: center;
    gap: 18px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .date {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .date input {
    padding: 3px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-size: 12.5px;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 12.5px;
    cursor: pointer;
  }
  .link:hover {
    color: var(--fg);
  }
  .buttons {
    display: flex;
    gap: 8px;
  }
  @media (max-width: 600px) {
    .sentence {
      grid-template-columns: minmax(0, 1fr);
      justify-items: stretch;
    }
    .arrow {
      justify-self: center;
      transform: rotate(90deg);
    }
    .buttons {
      flex: 1;
      justify-content: flex-end;
    }
  }
</style>
