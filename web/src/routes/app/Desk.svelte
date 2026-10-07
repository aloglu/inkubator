<script lang="ts">
  /** The Desk: every inked pen, with what's in it and for how long. */
  import { flushPen } from '../../lib/actions';
  import Button from '../../lib/components/Button.svelte';
  import PenMedia from '../../lib/components/PenMedia.svelte';
  import Swab from '../../lib/components/Swab.svelte';
  import { swabSheen } from '../../lib/ink';
  import { daysBetween, formatDate, formatLongDay, inkMaker, penDetails } from '../../lib/format';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import type { Collection } from '../../lib/types/Collection';
  import { verb } from '../../lib/activity';
  import Icon from '../../lib/components/Icon.svelte';
  import type { ActivityEntry } from '../../lib/types/ActivityEntry';
  import ReinkMenu from './ReinkMenu.svelte';

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

  // Visitors may see the latest few events here, when the showcase allows it.
  const recent = $derived(
    !collection.canEdit && data.settings.showcase.show_recent_activity ? data.activity.slice(0, 5) : [],
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
      <span class="head-action"><Button icon="drop" onclick={() => ui.openInkFlow()}>Ink a pen</Button></span>
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

  {#if rows.length}
    <ul class="rows">
      {#each rows as { fill, pen, ink, days } (fill.id)}
        <li class="row">
          <div class="media"><PenMedia {pen} radius="var(--radius-sm)" /></div>
          <div class="pen">
            <h3>{pen.model}</h3>
            <p class="meta">{penDetails(pen)}</p>
          </div>
          <div class="ink">
            <Swab base={ink.base_color} sheen={swabSheen(ink)} />
            <div>
              <a class="ink-name" href="/inks?ink={encodeURIComponent(ink.id)}">{ink.name}</a>
              <p class="meta">{inkMaker(ink)}</p>
            </div>
          </div>
          <div class="since">
            {#if days === 0}
              <p class="big">Today</p>
            {:else}
              <p class="big">{days}<small>{days === 1 ? 'day' : 'days'}</small></p>
            {/if}
            <p class="meta">since {formatDate(fill.inked_at, dateFormat, { short: true })}</p>
          </div>
          {#if collection.canEdit}
          <div class="actions">
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
  {#if recent.length}
    <section class="recent" aria-labelledby="recent-title">
      <h3 id="recent-title" class="kicker">Recent activity</h3>
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
  .rows {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: grid;
    grid-template-columns: 128px minmax(0, 1fr) minmax(0, 1.4fr) 110px auto;
    gap: 22px;
    align-items: center;
    padding: 18px 22px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
  }
  .pen h3 {
    font-size: 22px;
    line-height: 1.1;
  }
  .meta {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .ink {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .ink-name {
    color: inherit;
    font-weight: 500;
    text-decoration: none;
  }
  .ink-name:hover {
    text-decoration: underline;
  }
  .since {
    font-variant-numeric: tabular-nums;
  }
  .big {
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 1;
  }
  .big small {
    margin-left: 4px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .recent {
    display: grid;
    gap: 6px;
  }
  h3.kicker {
    font-family: var(--font-body);
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

  @media (max-width: 1100px) {
    .row {
      grid-template-columns: 112px minmax(0, 1fr) auto;
      grid-template-areas:
        'media pen since'
        'media ink actions';
      gap: 10px 18px;
    }
    .media {
      grid-area: media;
    }
    .pen {
      grid-area: pen;
    }
    .ink {
      grid-area: ink;
    }
    .since {
      grid-area: since;
      text-align: right;
    }
    .actions {
      grid-area: actions;
    }
  }
  @media (max-width: 700px) {
    /* The tab bar has its own Ink a pen button. */
    .head-action {
      display: none;
    }
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
  @media (max-width: 560px) {
    .row {
      grid-template-columns: 88px minmax(0, 1fr);
      grid-template-areas:
        'media pen'
        'ink ink'
        'since actions';
      padding: 14px;
    }
    .since {
      text-align: left;
    }
    .pen h3 {
      font-size: 19px;
    }
  }
</style>
