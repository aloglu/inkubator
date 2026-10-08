<script lang="ts">
  /** The Desk: every inked pen, with what's in it and for how long. */
  import Button from '../../lib/components/Button.svelte';
  import Swab from '../../lib/components/Swab.svelte';
  import { swabSheen } from '../../lib/ink';
  import { daysBetween, formatDate, formatLongDay, plural } from '../../lib/format';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import type { Collection } from '../../lib/types/Collection';
  import { verb } from '../../lib/activity';
  import Icon from '../../lib/components/Icon.svelte';
  import type { ActivityEntry } from '../../lib/types/ActivityEntry';
  import type { Pen } from '../../lib/types/Pen';
  import { canOpen, itemHref } from '../../lib/items.svelte';
  import InkMenu from './InkMenu.svelte';

  const WEEK = 7 * 24 * 60 * 60 * 1000;

  let { data }: { data: Collection } = $props();

  // Re-read the clock when the window regains focus, so day counts stay right
  // when the Desk is left open overnight.
  let now = $state(Date.now());
  $effect(() => {
    const refresh = () => (now = Date.now());
    addEventListener('focus', refresh);
    return () => removeEventListener('focus', refresh);
  });

  const dateFormat = $derived(data.settings.defaults.date_format);

  // The latest few events; visitors see them only when the Visitors settings allow it.
  const recent = $derived(
    collection.canEdit || data.settings.showcase.show_recent_activity
      ? [...data.activity].sort((a, b) => b.at - a.at).slice(0, 5)
      : [],
  );
  function recentText(entry: ActivityEntry): string {
    const subject =
      entry.subject === 'pen'
        ? (() => {
            const pen = pens.get(entry.subject_id);
            return pen ? [pen.brand, pen.model].filter(Boolean).join(' ') : 'a pen';
          })()
        : (inks.get(entry.ink_id ?? entry.subject_id)?.name ?? 'an ink');
    const ink = entry.ink_id && entry.subject === 'pen' ? inks.get(entry.ink_id)?.name : undefined;
    const object = entry.subject === 'swatch' ? `of ${subject}` : subject;
    return [verb(entry), object, ink && (entry.action === 'inked' || entry.action === 'reinked') ? `with ${ink}` : '']
      .filter(Boolean)
      .join(' ');
  }
  // Names open the pen's or ink's details over the Desk, when this viewer may see them.
  const pensOpen = $derived(canOpen('pen'));
  const inksOpen = $derived(canOpen('ink'));
  const penName = (pen: Pen) => [pen.brand, pen.model].filter(Boolean).join(' ');

  const inks = $derived(new Map(data.inks.map((ink) => [ink.id, ink])));
  const pens = $derived(new Map(data.pens.map((pen) => [pen.id, pen])));

  /** Inked pens, most recently inked first. */
  const rows = $derived(
    data.fills
      .filter((fill) => fill.emptied_at === null)
      .sort((a, b) => b.inked_at - a.inked_at)
      .flatMap((fill) => {
        const pen = pens.get(fill.pen_id);
        const ink = inks.get(fill.ink_id);
        return pen && ink ? [{ fill, pen, ink, days: daysBetween(fill.inked_at, now) }] : [];
      }),
  );

  const ledger = $derived.by(() => {
    const swatched = new Set(data.swatches.map((swatch) => swatch.ink_id));
    const since = now - WEEK;
    const inkedAt = new Set(data.fills.map((fill) => `${fill.pen_id}@${fill.inked_at}`));
    // A re-ink empties one fill and starts the next at the same moment; count it once.
    const changes =
      data.fills.filter((fill) => fill.inked_at >= since).length +
      data.fills.filter(
        (fill) =>
          fill.emptied_at !== null && fill.emptied_at >= since && !inkedAt.has(`${fill.pen_id}@${fill.emptied_at}`),
      ).length;
    return {
      inked: rows.length,
      pens: data.pens.length,
      average: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.days, 0) / rows.length) : null,
      swatched: data.inks.filter((ink) => swatched.has(ink.id)).length,
      inks: data.inks.length,
      changes,
    };
  });

</script>

<div class="page">
  <header class="head">
    <div>
      <h2>Desk</h2>
      <p class="sub">{formatLongDay(now, dateFormat)}</p>
    </div>
    {#if collection.canEdit}
      <Button icon="drop" onclick={() => ui.openInkFlow()}>Ink a pen</Button>
    {/if}
  </header>

  <dl class="ledger">
    <div><dt class="visually-hidden">Inked pens</dt><dd><strong>{ledger.inked}</strong> of {ledger.pens} pens inked</dd></div>
    {#if ledger.average !== null}
      <div><dt class="visually-hidden">Average fill</dt><dd><strong>{ledger.average}</strong> day average fill</dd></div>
    {/if}
    <div><dt class="visually-hidden">Swatched inks</dt><dd><strong>{ledger.swatched}</strong> of {ledger.inks} inks swatched</dd></div>
    <div>
      <dt class="visually-hidden">Ink changes in the last 7 days</dt>
      <dd><strong>{ledger.changes}</strong> {ledger.changes === 1 ? 'change' : 'changes'} this week</dd>
    </div>
  </dl>

  <section class="inked" aria-labelledby="inked-title">
    <h3 id="inked-title" class="section-title">Inked pens</h3>
    {#if rows.length}
      <ul class="rows">
        {#each rows as { fill, pen, ink, days } (fill.id)}
          {@const nib = [pen.nib_size, pen.nib_material].filter(Boolean).join(' · ')}
          <li class="row">
            <Swab base={ink.base_color} sheen={swabSheen(ink)} />
            <div class="what">
              <h3>
                {#if inksOpen}<a class="plain" href={itemHref('ink', ink.id)}>{ink.name}</a>{:else}{ink.name}{/if}
              </h3>
              <p class="meta">
                in
                {#if pensOpen}<a class="plain pen" href={itemHref('pen', pen.id)}>{penName(pen)}</a>{:else}<span class="pen">{penName(pen)}</span>{/if}{#if nib}<span class="nib">{` · ${nib}`}</span>{/if}
              </p>
            </div>
            <div class="time">
              {#if days === 0}
                <strong>Today</strong>
                <span>inked {formatDate(fill.inked_at, dateFormat, { short: true })}</span>
              {:else}
                <strong>{plural(days, 'day')}</strong>
                <span>in the pen since {formatDate(fill.inked_at, dateFormat, { short: true })}</span>
              {/if}
            </div>
            {#if collection.canEdit}<InkMenu {pen} {ink} />{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <div class="empty">
        <p>No pens are inked right now.</p>
        {#if !collection.canEdit}
          <p class="muted">Check back later.</p>
        {:else if data.pens.length && data.inks.length}
          <Button icon="drop" onclick={() => ui.openInkFlow()}>Ink a pen</Button>
        {:else}
          <p class="muted">Add a pen and an ink to get started.</p>
        {/if}
      </div>
    {/if}
  </section>
  {#if recent.length}
    <section class="recent" aria-labelledby="recent-title">
      <h3 id="recent-title" class="section-title">Recent activity</h3>
      <ul>
        {#each recent as entry (entry.id)}
          {@const ink = entry.ink_id ? inks.get(entry.ink_id) : undefined}
          <li>
            <span class="dot">
              {#if ink}<Swab base={ink.base_color} sheen={swabSheen(ink)} size="xs" />{:else}<Icon name="pencil-simple" size={13} />{/if}
            </span>
            <span class="text">{recentText(entry)}</span>
            <time>{formatDate(entry.at, dateFormat, { short: true })}</time>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>


<style>
  .page {
    display: grid;
    gap: 22px;
    align-content: start;
    container: desk / inline-size;
  }
  .head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .head h2 {
    font-size: 32px;
  }
  .sub {
    margin-top: 4px;
    color: var(--muted);
    font-size: 13px;
  }
  .ledger {
    display: flex;
    flex-wrap: wrap;
    margin: 0;
    border-block: 1px solid var(--line);
    color: var(--muted);
    font-size: 13px;
  }
  .ledger > div {
    padding: 10px 18px;
    border-right: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .ledger > div:first-child {
    padding-left: 0;
  }
  .ledger > div:last-child {
    border-right: 0;
  }
  .ledger dd {
    margin: 0;
  }
  .ledger strong {
    color: var(--fg);
    font-weight: 600;
  }
  /* One quiet panel, a row per inked pen, led by its ink. */
  .rows {
    display: grid;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
    list-style: none;
  }
  .row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto auto;
    gap: 0 16px;
    align-items: center;
    padding: 12px 14px;
  }
  .row + .row {
    border-top: 1px solid var(--line);
  }
  .row > :global(.swab) {
    justify-self: center;
    width: 46px;
    height: 36px;
  }
  .what {
    min-width: 0;
  }
  .what h3 {
    font-size: 18px;
    line-height: 1.15;
  }
  .meta {
    margin-top: 2px;
    overflow: hidden;
    color: var(--muted);
    font-size: 12.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta .pen {
    color: var(--fg);
    font-weight: 500;
  }
  /* Links that read as plain text, like a card's whole surface. */
  .plain {
    color: inherit;
    text-decoration: none;
  }
  .plain:focus-visible {
    border-radius: 2px;
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .time {
    display: grid;
    justify-items: end;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .time strong {
    font-size: 14px;
    font-weight: 600;
  }
  .time span {
    color: var(--muted);
    font-size: 12px;
  }
  .section-title {
    font-size: 19px;
    line-height: 1.2;
  }
  .inked,
  .recent {
    display: grid;
    gap: 10px;
  }
  .recent ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .recent li {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    font-size: 13.5px;
  }
  .recent .dot {
    display: grid;
    place-items: center;
    color: var(--muted);
  }
  .recent time {
    color: var(--muted);
    font-size: 12px;
  }
  .empty {
    display: grid;
    justify-items: start;
    gap: 12px;
    padding: 28px 0;
  }

  @container desk (max-width: 640px) {
    .ledger {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .ledger > div,
    .ledger > div:first-child {
      padding: 8px 0;
      border-right: 0;
    }
    .ledger > div:nth-child(n + 3) {
      border-top: 1px solid var(--line);
    }
  }
  /* Narrow: smaller swabs, the nib and the date left out. */
  @container desk (max-width: 520px) {
    .row {
      grid-template-columns: 40px minmax(0, 1fr) auto auto;
      gap: 0 12px;
      padding: 11px 8px 11px 12px;
    }
    .row > :global(.swab) {
      width: 34px;
      height: 27px;
    }
    .what h3 {
      font-size: 16px;
    }
    .meta {
      font-size: 12px;
    }
    .nib,
    .time span {
      display: none;
    }
    .time strong {
      font-size: 13px;
    }
  }
</style>
