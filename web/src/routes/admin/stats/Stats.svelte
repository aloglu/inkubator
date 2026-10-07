<script lang="ts">
  /**
   * Stats from fills and prices: the ink spectrum, four headline figures, the
   * rotation timeline (which ink was in which pen) and brand bars in gold.
   * Every mark has a tooltip on hover and focus, and every chart a table view.
   */
  import Segmented from '../../../lib/components/Segmented.svelte';
  import { daysBetween, formatDate, penName, plural } from '../../../lib/format';
  import { money } from '../../../lib/ink';
  import { sortInks } from '../../../lib/sorting';
  import { byBrand, headline, rangeStart, rotation, type Range } from '../../../lib/stats';
  import type { Collection } from '../../../lib/types/Collection';

  let { data }: { data: Collection } = $props();

  let period = $state<'30' | '90' | '365' | 'all'>('90');
  const range: Range = $derived(period === 'all' ? 'all' : (Number(period) as 30 | 90 | 365));
  const now = Date.now();

  const dateFormat = $derived(data.settings.defaults.date_format);
  const currency = $derived(data.settings.defaults.currency);
  const from = $derived(rangeStart(range, data.fills, now));
  const span = $derived(Math.max(1, now - from));
  const inUse = $derived(new Set(data.fills.filter((f) => f.emptied_at === null).map((f) => f.ink_id)));
  const spectrum = $derived(sortInks(data.inks, 'hue'));
  const figures = $derived(headline(data, from, now));
  const rows = $derived(rotation(data, from, now));
  /** Lane labels: the model, with the nib size when several pens share a model. */
  const laneLabel = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const pen of data.pens) counts.set(pen.model, (counts.get(pen.model) ?? 0) + 1);
    return (pen: (typeof data.pens)[number]) =>
      (counts.get(pen.model) ?? 0) > 1 && pen.nib_size ? `${pen.model} · ${pen.nib_size}` : pen.model;
  });
  const penSpend = $derived(byBrand(data.pens, (p) => p.price));
  const inkCounts = $derived(byBrand(data.inks, (i) => Math.max(1, i.amount)));
  const rangeLabel = $derived({ 30: 'Last 30 days', 90: 'Last 90 days', 365: 'Last year', all: 'All time' }[range]);

  /** Month ticks across the timeline, thinned to at most about eight. */
  const ticks = $derived.by(() => {
    const result: { at: number; label: string }[] = [];
    const date = new Date(from);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() + 1);
    while (date.getTime() < now) {
      result.push({
        at: date.getTime(),
        label: date.toLocaleDateString(undefined, date.getMonth() === 0 ? { month: 'short', year: 'numeric' } : { month: 'short' }),
      });
      date.setMonth(date.getMonth() + 1);
    }
    const step = Math.ceil(result.length / 8);
    return result.filter((_, i) => i % step === 0);
  });

  const x = (ms: number) => ((ms - from) / span) * 100;
  const short = (ms: number) => formatDate(ms, dateFormat, { short: true });

  // ---------- tooltip ----------

  let tip: { x: number; y: number; title: string; lines: string[] } | null = $state(null);

  function show(event: PointerEvent | FocusEvent, title: string, lines: string[]) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = event instanceof PointerEvent ? event.clientX : box.left + box.width / 2;
    tip = { x: Math.min(Math.max(px, 120), innerWidth - 120), y: box.top, title, lines };
  }
  const hide = () => (tip = null);
  const tipOn = (title: string, lines: string[]) => ({
    onpointerenter: (event: PointerEvent) => show(event, title, lines),
    onpointermove: (event: PointerEvent) => show(event, title, lines),
    onpointerleave: hide,
    onfocus: (event: FocusEvent) => show(event, title, lines),
    onblur: hide,
  });

  const maxSpend = $derived(Math.max(1, ...penSpend.map((b) => b.value)));
  const maxInks = $derived(Math.max(1, ...inkCounts.map((b) => b.value)));
  const compact = (value: number) =>
    money(value, currency)?.replace(/[.,]00(?=\D*$)/, '') ?? String(value);
</script>

<div class="page">
  <header class="head">
    <div>
      <h2>Stats</h2>
      <p class="sub">{rangeLabel}</p>
    </div>
    <Segmented
      label="Period"
      bind:value={period}
      options={[
        { value: '30', label: '30 days' },
        { value: '90', label: '90 days' },
        { value: '365', label: 'Year' },
        { value: 'all', label: 'All' },
      ]}
    />
  </header>

  <section aria-labelledby="spectrum-title">
    <h3 id="spectrum-title" class="visually-hidden">Ink spectrum</h3>
    <div class="spectrum">
      {#each spectrum as ink (ink.id)}
        <a
          href="/admin/inks?ink={encodeURIComponent(ink.id)}"
          style:--c={ink.base_color}
          class:on={inUse.has(ink.id)}
          aria-label="{ink.name}, {ink.brand}{inUse.has(ink.id) ? ', in a pen' : ''}"
          {...tipOn(ink.name, [ink.brand, inUse.has(ink.id) ? 'In a pen now' : ''].filter(Boolean))}
        ></a>
      {/each}
    </div>
    <div class="caption">
      <span>{plural(data.inks.length, 'ink')} by hue</span>
      <span><i class="marker"></i> in a pen now</span>
    </div>
  </section>

  <dl class="tiles">
    <div>
      <dt>Pens inked now</dt>
      <dd>{figures.inked} <small>of {figures.pens}</small></dd>
    </div>
    <div>
      <dt>Average fill</dt>
      <dd>{figures.averageFill === null ? '—' : plural(figures.averageFill, 'day')}</dd>
      <p class="note">Fills finished in this period</p>
    </div>
    <div>
      <dt>Inks swatched</dt>
      <dd>{figures.swatched} <small>of {figures.inks}</small></dd>
    </div>
    <div>
      <dt>Tracked spend</dt>
      <dd>{figures.spend === null ? '—' : compact(figures.spend)}</dd>
      <p class="note">Pens and inks with a price</p>
    </div>
  </dl>

  <section class="panel" aria-labelledby="rotation-title">
    <div class="panel-head">
      <h3 id="rotation-title">Rotation</h3>
      <span>Hover a bar for the ink and dates</span>
    </div>
    {#if rows.length}
      <div class="timeline">
        <div class="axis" aria-hidden="true">
          {#each ticks as tick (tick.at)}
            <span class="tick" style:left="{x(tick.at)}%">{tick.label}</span>
          {/each}
        </div>
        {#each rows as row (row.pen.id)}
          <div class="lane">
            <a class="pen" href="/admin/pens?pen={encodeURIComponent(row.pen.id)}" title={penName(row.pen)}>{laneLabel(row.pen)}</a>
            <div class="track">
              {#each ticks as tick (tick.at)}<span class="grid" style:left="{x(tick.at)}%"></span>{/each}
              {#each row.segments as segment (segment.fill.id)}
                {@const days = daysBetween(segment.fill.inked_at, segment.fill.emptied_at ?? now)}
                {@const lines = [
                  penName(row.pen),
                  `${short(segment.fill.inked_at)} – ${segment.open ? 'now' : short(segment.fill.emptied_at ?? now)}`,
                  plural(days, 'day'),
                ]}
                <a
                  class="segment"
                  class:open={segment.open}
                  href={segment.ink ? `/admin/inks?ink=${encodeURIComponent(segment.ink.id)}` : undefined}
                  style:left="{x(segment.start)}%"
                  style:width="max(4px, calc({x(segment.end) - x(segment.start)}% - 2px))"
                  style:--c={segment.ink?.base_color ?? 'var(--muted)'}
                  aria-label="{segment.ink?.name ?? 'Deleted ink'} in {penName(row.pen)}, {lines[1]}"
                  {...tipOn(segment.ink?.name ?? 'Deleted ink', lines)}
                ><span></span></a>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      <details>
        <summary>View as table</summary>
        <table>
          <thead><tr><th>Pen</th><th>Ink</th><th>From</th><th>To</th><th>Days</th></tr></thead>
          <tbody>
            {#each rows as row (row.pen.id)}
              {#each row.segments as segment (segment.fill.id)}
                <tr>
                  <td>{penName(row.pen)}</td>
                  <td>{segment.ink?.name ?? 'Deleted ink'}</td>
                  <td>{short(segment.fill.inked_at)}</td>
                  <td>{segment.open ? 'Still inked' : short(segment.fill.emptied_at ?? now)}</td>
                  <td class="num">{daysBetween(segment.fill.inked_at, segment.fill.emptied_at ?? now)}</td>
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </details>
    {:else}
      <p class="muted">No pens were inked in this period.</p>
    {/if}
  </section>

  <div class="two">
    {#snippet bars(title: string, unit: string, items: { brand: string; value: number }[], max: number, format: (v: number) => string, detail: (v: number) => string)}
      <section class="panel">
        <div class="panel-head"><h3>{title}</h3><span>{unit}</span></div>
        {#if items.length}
          <ul class="bars">
            {#each items as bar (bar.brand)}
              <li>
                <span class="brand">{bar.brand}</span>
                <span class="bar-track" role="img" aria-label="{bar.brand}: {detail(bar.value)}" {...tipOn(bar.brand, [detail(bar.value)])}>
                  <span class="bar" style:width="{(bar.value / max) * 100}%"></span>
                </span>
                <span class="value">{format(bar.value)}</span>
              </li>
            {/each}
          </ul>
          <details>
            <summary>View as table</summary>
            <table>
              <thead><tr><th>Brand</th><th>{unit}</th></tr></thead>
              <tbody>{#each items as bar (bar.brand)}<tr><td>{bar.brand}</td><td class="num">{format(bar.value)}</td></tr>{/each}</tbody>
            </table>
          </details>
        {:else}
          <p class="muted">Nothing to show yet.</p>
        {/if}
      </section>
    {/snippet}
    {@render bars('Pen spend by brand', currency, penSpend, maxSpend, compact, (v) => compact(v))}
    {@render bars('Inks by brand', 'bottles', inkCounts, maxInks, String, (v) => plural(v, 'bottle'))}
  </div>
</div>

{#if tip}
  <div class="tooltip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px">
    <b>{tip.title}</b>
    {#each tip.lines as line (line)}<span>{line}</span>{/each}
  </div>
{/if}

<style>
  .page {
    display: grid;
    gap: 26px;
    align-content: start;
    max-width: 1100px;
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
  .spectrum {
    display: flex;
    gap: 2px;
    height: 54px;
    overflow: hidden;
    border-radius: var(--radius-sm);
  }
  .spectrum a {
    position: relative;
    flex: 1;
    background: var(--c);
  }
  .spectrum a:focus-visible {
    outline: 2px solid var(--fg);
    outline-offset: -2px;
  }
  .spectrum a.on::after,
  .marker {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
  }
  .spectrum a.on::after {
    position: absolute;
    left: 50%;
    bottom: 7px;
    margin-left: -4px;
  }
  .caption {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
  }
  .caption .marker {
    margin-right: 4px;
    vertical-align: middle;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0;
    border-block: 1px solid var(--line);
  }
  .tiles > div {
    padding: 14px 18px;
    border-right: 1px solid var(--line);
  }
  .tiles > div:first-child {
    padding-left: 0;
  }
  .tiles > div:last-child {
    border-right: 0;
  }
  dt {
    color: var(--muted);
    font-size: 12.5px;
  }
  dd {
    margin: 4px 0 0;
    font-size: 26px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  dd small {
    color: var(--muted);
    font-size: 13px;
    font-weight: 400;
  }
  .note {
    margin-top: 2px;
    color: var(--muted);
    font-size: 11.5px;
  }
  .panel {
    display: grid;
    gap: 12px;
    align-content: start;
  }
  .panel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-strong);
  }
  .panel-head span {
    color: var(--muted);
    font-size: 12px;
  }
  .timeline {
    display: grid;
    gap: 2px;
  }
  .axis {
    position: relative;
    height: 18px;
    margin-left: 150px;
  }
  .tick {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    color: var(--muted);
    font-size: 11px;
    white-space: nowrap;
  }
  .lane {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    align-items: center;
    min-height: 28px;
  }
  .pen {
    overflow: hidden;
    padding-right: 12px;
    color: var(--fg);
    font-size: 12.5px;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pen:hover {
    text-decoration: underline;
  }
  .track {
    position: relative;
    height: 28px;
  }
  .grid {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--chart-grid);
  }
  /* The link is the whole lane height (a large hit target); the bar inside is 14px. */
  .segment {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
  }
  .segment span {
    width: 100%;
    height: 14px;
    border-radius: 4px;
    background: var(--c);
  }
  .segment.open span {
    border-radius: 4px 0 0 4px;
  }
  .segment:hover span,
  .segment:focus-visible span {
    box-shadow:
      0 0 0 2px var(--bg),
      0 0 0 3px var(--fg);
  }
  .segment:focus-visible {
    outline: none;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
  }
  .bars {
    display: grid;
    gap: 9px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .bars li {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr) 72px;
    gap: 10px;
    align-items: center;
    font-size: 12.5px;
  }
  .brand {
    overflow: hidden;
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar-track {
    display: flex;
    align-items: center;
    height: 20px;
  }
  .bar {
    min-width: 4px;
    height: 10px;
    border-radius: 0 4px 4px 0;
    background: var(--chart-mark);
  }
  .value {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  details {
    color: var(--muted);
    font-size: 12.5px;
  }
  summary {
    cursor: pointer;
  }
  table {
    width: 100%;
    margin-top: 8px;
    border-collapse: collapse;
    color: var(--fg);
  }
  th,
  td {
    padding: 5px 8px 5px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  th {
    color: var(--muted);
    font-weight: 500;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .tooltip {
    position: fixed;
    z-index: 60;
    display: grid;
    gap: 1px;
    padding: 7px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--raised);
    box-shadow: var(--shadow-pop);
    font-size: 12px;
    pointer-events: none;
    transform: translate(-50%, calc(-100% - 8px));
    white-space: nowrap;
  }
  .tooltip span {
    color: var(--muted);
  }
  @media (max-width: 800px) {
    .tiles {
      grid-template-columns: 1fr 1fr;
    }
    .tiles > div:nth-child(2) {
      border-right: 0;
    }
    .tiles > div:nth-child(3) {
      padding-left: 0;
    }
    .tiles > div:nth-child(n + 3) {
      border-top: 1px solid var(--line);
    }
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
    .axis {
      margin-left: 96px;
    }
    .lane {
      grid-template-columns: 96px minmax(0, 1fr);
    }
  }
</style>
