<script lang="ts">
  /** Everything that happened, newest first, grouped by day and written as sentences. */
  import { changeLine, verb, type Context } from '../../../lib/activity';
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import Menu from '../../../lib/components/Menu.svelte';
  import SearchField from '../../../lib/components/SearchField.svelte';
  import Segmented from '../../../lib/components/Segmented.svelte';
  import Swab from '../../../lib/components/Swab.svelte';
  import { daysBetween, formatDate, formatLongDay, plural, startOfDay } from '../../../lib/format';
  import type { IconName } from '../../../lib/icons';
  import { swabSheen } from '../../../lib/ink';
  import { fold } from '../../../lib/search';
  import type { ActivityEntry } from '../../../lib/types/ActivityEntry';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Subject } from '../../../lib/types/Subject';
  import { collection } from '../../../lib/stores/collection.svelte';

  const PAGE = 100;
  const DAY = 24 * 60 * 60 * 1000;

  let { data }: { data: Collection } = $props();

  let query = $state('');
  let subject: 'all' | Subject = $state('all');
  let range: number | 'year' | null = $state(null);
  let limit = $state(PAGE);
  let rangeButton: HTMLButtonElement | undefined = $state();
  let choosingRange = $state(false);

  const ranges: { value: number | 'year' | null; label: string }[] = [
    { value: null, label: 'Any date' },
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 90, label: 'Last 90 days' },
    { value: 'year', label: 'This year' },
  ];

  const pens = $derived(new Map(data.pens.map((p) => [p.id, p])));
  const inks = $derived(new Map(data.inks.map((i) => [i.id, i])));
  const swatches = $derived(new Map(data.swatches.map((s) => [s.id, s])));
  const dateFormat = $derived(data.settings.defaults.date_format);
  const ctx: Context = $derived({
    currency: data.settings.defaults.currency,
    dateFormat,
    inkName: (id) => inks.get(id)?.name,
  });

  const owner = $derived(collection.canEdit);
  const filters = $derived(owner || data.settings.showcase.show_activity_filters);

  /**
   * The item's current name if it still exists, else the name it had then.
   * Visitors are not told the names of items they cannot see.
   */
  function name(entry: ActivityEntry): string {
    const unnamed = { pen: 'a pen', ink: 'an ink', swatch: 'an ink' }[entry.subject];
    if (entry.subject === 'pen') {
      const pen = pens.get(entry.subject_id);
      return pen ? [pen.brand, pen.model].filter(Boolean).join(' ') : entry.label || unnamed;
    }
    if (entry.subject === 'ink') return inks.get(entry.subject_id)?.name ?? (entry.label || unnamed);
    return swatchInk(entry)?.name ?? (entry.label || unnamed);
  }

  /** A swatch entry's ink: recorded for additions and deletions, looked up for edits. */
  function swatchInk(entry: ActivityEntry) {
    const id = entry.ink_id ?? swatches.get(entry.subject_id)?.ink_id;
    return id ? inks.get(id) : undefined;
  }

  function link(entry: ActivityEntry): string | null {
    const id = encodeURIComponent(entry.subject_id);
    if (entry.subject === 'pen') return pens.has(entry.subject_id) ? `/pens?pen=${id}` : null;
    if (entry.subject === 'ink') return inks.has(entry.subject_id) ? `/inks?ink=${id}` : null;
    return swatches.has(entry.subject_id) ? `/swatches?swatch=${id}` : null;
  }

  const icons: Record<ActivityEntry['action'], IconName> = {
    created: 'plus',
    updated: 'pencil-simple',
    deleted: 'trash',
    inked: 'drop',
    reinked: 'arrows-clockwise',
    flushed: 'arrows-counter-clockwise',
  };

  /** For a flush: which ink came out, and after how long. */
  function flushed(entry: ActivityEntry): string | null {
    const ink = entry.previous_ink_id ? inks.get(entry.previous_ink_id) : undefined;
    const fill = data.fills.find(
      (f) => f.pen_id === entry.subject_id && f.ink_id === entry.previous_ink_id && f.emptied_at === entry.at,
    );
    const parts = [ink?.name, fill ? plural(daysBetween(fill.inked_at, entry.at), 'day') : null].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  const since = $derived.by(() => {
    if (range === null) return -Infinity;
    if (range === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime();
    return startOfDay(Date.now()) - (range - 1) * DAY;
  });

  const entries = $derived.by(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return [...data.activity]
      .filter((entry) => subject === 'all' || entry.subject === subject)
      .filter((entry) => entry.at >= since)
      .filter((entry) => {
        if (!words.length) return true;
        const text = fold(
          [
            verb(entry),
            name(entry),
            entry.label,
            entry.ink_id ? inks.get(entry.ink_id)?.name : '',
            entry.previous_ink_id ? inks.get(entry.previous_ink_id)?.name : '',
            ...entry.changes.map((change) => changeLine(entry.subject, change, ctx).label),
          ].join(' '),
        );
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => b.at - a.at);
  });

  const days = $derived.by(() => {
    const groups: { day: number; entries: ActivityEntry[] }[] = [];
    for (const entry of entries.slice(0, limit)) {
      const day = startOfDay(entry.at);
      const last = groups.at(-1);
      if (last?.day === day) last.entries.push(entry);
      else groups.push({ day, entries: [entry] });
    }
    return groups;
  });

  function dayHeading(day: number): string {
    const today = startOfDay(Date.now());
    if (day === today) return 'Today';
    if (today - day <= DAY * 1.5) return 'Yesterday';
    return new Date(day).getFullYear() === new Date().getFullYear()
      ? formatLongDay(day, dateFormat)
      : formatDate(day, dateFormat);
  }

  const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const retention = $derived(data.settings.activity.retention);

  // A new search or filter starts from the top of the list again.
  $effect(() => {
    void [query, subject, range];
    limit = PAGE;
  });
</script>

<div class="page">
  <header class="head">
    <h2>Activity</h2>
    {#if filters}
    <div class="tools">
      <SearchField bind:value={query} label="Search activity" />
      <Segmented
        label="Show"
        bind:value={subject}
        options={[
          { value: 'all', label: 'All' },
          { value: 'pen', label: 'Pens' },
          { value: 'ink', label: 'Inks' },
          { value: 'swatch', label: 'Swatches' },
        ]}
      />
      <Button
        bind:element={rangeButton}
        variant="ghost"
        icon="calendar-blank"
        trailingIcon="caret-down"
        active={choosingRange || range !== null}
        aria-haspopup="menu"
        aria-expanded={choosingRange}
        onclick={() => (choosingRange = !choosingRange)}
      >
        {ranges.find((r) => r.value === range)?.label}
      </Button>
    </div>
    {/if}
  </header>

  {#each days as group (group.day)}
    <section class="day">
      <h3>{dayHeading(group.day)}</h3>
      <ul>
        {#each group.entries as entry (entry.id)}
          {@const ink =
            entry.subject === 'swatch'
              ? swatchInk(entry)
              : entry.ink_id
                ? inks.get(entry.ink_id)
                : entry.action === 'flushed' && entry.previous_ink_id
                  ? inks.get(entry.previous_ink_id)
                  : undefined}
          {@const href = link(entry)}
          {@const lines = entry.changes.map((change) => changeLine(entry.subject, change, ctx))}
          <li>
            <span class="icon">
              {#if ink}<Swab base={ink.base_color} sheen={swabSheen(ink)} size="xs" />{:else}<Icon name={icons[entry.action]} size={15} />{/if}
            </span>
            <div class="text">
              <p>
                <b>
                  {verb(entry)}
                  {#if entry.subject !== 'swatch'}
                    {#if href}<a {href}>{name(entry)}</a>{:else}{name(entry)}{/if}
                  {/if}
                </b>
                {#if entry.subject === 'swatch'}
                  of {#if href}<a {href}>{name(entry)}</a>{:else}{name(entry)}{/if}
                {:else if (entry.action === 'inked' || entry.action === 'reinked') && entry.ink_id}
                  with {inks.get(entry.ink_id)?.name ?? 'a deleted ink'}
                {/if}
              </p>
              {#if entry.action === 'flushed' && flushed(entry)}
                <small>{flushed(entry)}</small>
              {:else if entry.action === 'reinked' && entry.previous_ink_id}
                <small>{inks.get(entry.previous_ink_id)?.name ?? 'The previous ink'} flushed first</small>
              {:else if lines.length}
                <small class="changes">
                  {#each lines as line, i (i)}
                    <span class="change">
                      {line.label}{#if line.before && line.after}:
                        {@render shown(line.before)} → {@render shown(line.after)}{/if}{#if i < lines.length - 1}<span class="sep">·</span>{/if}
                    </span>
                  {/each}
                </small>
              {/if}
            </div>
            <time datetime={new Date(entry.at).toISOString()}>{time(entry.at)}</time>
          </li>
        {/each}
      </ul>
    </section>
  {:else}
    <p class="muted">{data.activity.length ? 'Nothing matches.' : 'Nothing has happened yet.'}</p>
  {/each}

  {#if entries.length > limit}
    <div class="more">
      <Button variant="ghost" onclick={() => (limit += PAGE)}>Show older ({entries.length - limit} more)</Button>
    </div>
  {/if}

  {#if owner}
    <p class="retention muted">
      {retention.keep === 'forever'
        ? 'Activity is kept forever.'
        : `Activity older than ${plural(retention.days, 'day')} is removed, with the ink history it covers.`}
      <a href="/settings">Change</a>
    </p>
  {/if}
</div>

{#snippet shown(value: { text: string } | { color: string })}
  {#if 'color' in value}<span class="dot" style:--c={value.color} title={value.color}></span>{:else}{value.text}{/if}
{/snippet}

<Menu anchor={rangeButton} open={choosingRange} onclose={() => (choosingRange = false)} label="Date range" width={200}>
  {#each ranges as option (option.label)}
    <button
      type="button"
      role="menuitemradio"
      aria-checked={range === option.value}
      onclick={() => {
        range = option.value;
        choosingRange = false;
      }}
    >
      <span class="tick">{#if range === option.value}<Icon name="check" size={14} />{/if}</span>
      {option.label}
    </button>
  {/each}
</Menu>

<style>
  .page {
    display: grid;
    gap: 22px;
    align-content: start;
    max-width: 900px;
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
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  @media (max-width: 600px) {
    .tools {
      width: 100%;
    }
    .tools > :global(.search) {
      flex: 1 0 100%;
      width: auto;
    }
    li {
      grid-template-columns: 28px minmax(0, 1fr) auto;
      gap: 10px;
      font-size: 13px;
    }
  }
  .day h3 {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-strong);
    font-size: 17px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    font-size: 13.5px;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--surface);
    color: var(--muted);
  }
  b {
    font-weight: 600;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  small {
    display: block;
    color: var(--muted);
    font-size: 12px;
  }
  .changes {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 0;
  }
  .change {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .sep {
    margin: 0 6px;
  }
  .dot {
    display: inline-block;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 0 1px var(--line-strong);
    vertical-align: middle;
  }
  time {
    color: var(--muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .more {
    display: flex;
    justify-content: center;
  }
  .retention {
    font-size: 12.5px;
  }
  .retention a {
    text-decoration: underline;
  }
  .tick {
    display: grid;
    width: 14px;
    color: var(--accent);
  }
</style>
