<script lang="ts">
  /**
   * Settings, one column with a section index. Every change is saved as it is
   * made; text fields save when you leave them. Saves run one after another so
   * quick changes never collide.
   */
  import type { Snippet } from 'svelte';
  import { exportUrl, getAppInfo, listBackups, restoreBackup } from '../../../lib/api';
  import Button from '../../../lib/components/Button.svelte';
  import Icon from '../../../lib/components/Icon.svelte';
  import Segmented from '../../../lib/components/Segmented.svelte';
  import Select from '../../../lib/components/Select.svelte';
  import Switch from '../../../lib/components/Switch.svelte';
  import { formatDate, plural } from '../../../lib/format';
  import { kinds } from '../../../lib/ink';
  import { nibMaterials, nibSizes } from '../../../lib/pen';
  import { retentionChoices, retentionKey, retentionLoss } from '../../../lib/retention';
  import { inkSorts, penSorts, swatchSorts } from '../../../lib/sorting';
  import { collection } from '../../../lib/stores/collection.svelte';
  import { ui } from '../../../lib/stores/ui.svelte';
  import type { BackupFile } from '../../../lib/types/BackupFile';
  import type { Collection } from '../../../lib/types/Collection';
  import type { Retention } from '../../../lib/types/Retention';
  import type { Settings } from '../../../lib/types/Settings';
  import type { ShowcaseSettings } from '../../../lib/types/ShowcaseSettings';

  let { data }: { data: Collection } = $props();

  const s = $derived(data.settings);

  let queue: Promise<void> = Promise.resolve();
  /** Saves a change to the settings, after any change still being saved. */
  function update(change: (next: Settings) => void, done?: string) {
    queue = queue.then(async () => {
      const current = collection.data?.settings;
      if (!current) return;
      const next = structuredClone($state.snapshot(current)) as Settings;
      change(next);
      try {
        await collection.run({ type: 'update_settings', settings: next });
        ui.notify(done ?? 'Settings saved.', 'info', undefined, 'settings');
      } catch (error) {
        ui.fail(error);
      }
    });
  }

  // ---------- backups ----------

  let backups = $state<BackupFile[] | null>(null);
  let version = $state('');
  let restoreInput: HTMLInputElement | undefined = $state();
  let restoring = $state(false);

  $effect(() => {
    listBackups().then(
      (result) => (backups = result.scheduled),
      () => (backups = []),
    );
    getAppInfo().then(
      (info) => (version = info.version),
      () => {},
    );
  });

  const lastBackup = $derived(backups?.reduce<BackupFile | null>((a, b) => (!a || b.created_at > a.created_at ? b : a), null));
  const size = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const frequencyLabel = $derived({ off: 'Off', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[s.backups.frequency]);

  async function restore(file: File | undefined) {
    if (restoreInput) restoreInput.value = '';
    if (!file) return;
    const ok = await ui.confirm({
      title: 'Replace your collection with this backup?',
      message: `Everything in Inkubator will be replaced by the contents of ${file.name}. A safety backup of your current collection is made first.`,
      confirm: 'Replace collection',
      danger: true,
    });
    if (!ok) return;
    restoring = true;
    try {
      collection.apply(await restoreBackup(file, collection.revision));
      ui.notify('Backup restored. A safety backup of the previous collection was kept.');
      backups = (await listBackups()).scheduled;
    } catch (error) {
      ui.fail(error);
      if (error instanceof Error && 'isConflict' in error && error.isConflict) await collection.load();
    } finally {
      restoring = false;
    }
  }

  // ---------- activity ----------

  const retentionOptions = $derived.by(() => {
    const options = retentionChoices.map((c) => ({ value: retentionKey(c.retention), label: c.label }));
    const current = retentionKey(s.activity.retention);
    if (!options.some((o) => o.value === current) && s.activity.retention.keep === 'days') {
      options.push({ value: current, label: plural(s.activity.retention.days, 'day') });
    }
    return options;
  });

  async function setRetention(key: string) {
    const retention: Retention = key === 'forever' ? { keep: 'forever' } : { keep: 'days', days: Number(key) };
    const loss = retentionLoss(data, retention, Date.now());
    if (loss.activity || loss.fills) {
      const parts = [
        loss.activity ? plural(loss.activity, 'activity entry', 'activity entries') : null,
        loss.fills ? `${plural(loss.fills, 'finished fill')} from your pens' ink history` : null,
      ].filter(Boolean);
      const ok = await ui.confirm({
        title: 'Remove older history?',
        message: `Keeping ${retentionChoices.find((c) => retentionKey(c.retention) === key)?.label.toLowerCase() ?? `${key} days`} removes ${parts.join(' and ')} right away. This cannot be undone.`,
        confirm: 'Remove and save',
        danger: true,
      });
      if (!ok) return;
    }
    update((next) => (next.activity.retention = retention));
  }

  // ---------- defaults ----------

  const currencies = ['USD', 'EUR', 'GBP', 'TRY', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'CNY', 'KRW', 'TWD', 'HKD', 'SGD', 'INR'];
  const currencyOptions = $derived(
    [...new Set([s.defaults.currency, ...currencies])].map((code) => {
      let symbol = '';
      try {
        symbol =
          new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
            .formatToParts(0)
            .find((part) => part.type === 'currency')?.value ?? '';
      } catch {
        /* unknown code */
      }
      return { value: code, label: symbol && symbol !== code ? `${code} (${symbol})` : code };
    }),
  );
  const sample = new Date(new Date().getFullYear(), 2, 9, 12).getTime();
  const dateOptions = $derived(
    (['system', 'us', 'eu', 'iso'] as const).map((value) => ({
      value,
      label: `${{ system: 'System', us: 'US', eu: 'European', iso: 'ISO' }[value]} — ${formatDate(sample, value)}`,
    })),
  );

  // ---------- visitors ----------

  const visibility: { key: keyof ShowcaseSettings; label: string }[] = [
    { key: 'show_pens', label: 'Pens' },
    { key: 'show_inks', label: 'Inks' },
    { key: 'show_swatches', label: 'Swatches' },
    { key: 'show_prices', label: 'Prices' },
    { key: 'show_purchase_dates', label: 'Purchase dates' },
    { key: 'show_purchased_from', label: 'Where bought' },
    { key: 'show_notes', label: 'Notes' },
    { key: 'show_stats', label: 'Stats' },
    { key: 'show_charts', label: 'Charts' },
    { key: 'show_activity', label: 'Activity' },
    { key: 'show_activity_filters', label: 'Activity filters' },
    { key: 'show_recent_activity', label: 'Recent activity' },
  ];

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'backups', label: 'Backups' },
    { id: 'visitors', label: 'Visitors' },
    { id: 'activity', label: 'Activity log' },
    { id: 'stats', label: 'Stats' },
    { id: 'defaults', label: 'Formats and defaults' },
    { id: 'about', label: 'About' },
  ];
  let current = $state('general');
  /** While a jump from the index scrolls, the clicked section stays highlighted. */
  let jumping = false;

  function jump(id: string) {
    current = id;
    jumping = true;
    const done = () => {
      jumping = false;
      removeEventListener('scrollend', done);
    };
    addEventListener('scrollend', done);
    // Browsers without scrollend, or no scroll needed at all.
    setTimeout(done, 1200);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Links such as /settings#backups open at that section.
  $effect(() => {
    const id = location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  });

  $effect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        // Sections near the end may never reach the top of a short window; a
        // click on them keeps its highlight rather than being overruled here.
        if (visible[0] && !jumping) current = visible[0].target.id;
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  });
</script>

{#snippet row(label: string, help: string, control: Snippet)}
  <div class="row">
    <div>
      <p class="label">{label}</p>
      {#if help}<p class="help">{help}</p>{/if}
    </div>
    <div class="control">{@render control()}</div>
  </div>
{/snippet}

<div class="page">
  <header class="head"><h2>Settings</h2></header>
  <div class="layout">
    <nav class="index" aria-label="Settings sections">
      {#each sections as section (section.id)}
        <button
          type="button"
          aria-current={current === section.id ? 'true' : undefined}
          onclick={() => jump(section.id)}
        >
          {section.label}
        </button>
      {/each}
    </nav>

    <div class="sections">
      <section id="general">
        <h3>General</h3>
        {#snippet theme()}
          <Segmented
            label="Theme"
            value={s.theme}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onchange={(value) => update((next) => (next.theme = value))}
          />
        {/snippet}
        {@render row('Theme', 'Auto follows your device’s light or dark setting.', theme)}
        {#snippet editMode()}
          <Switch
            label="Open items in edit mode"
            checked={s.open_items_in_edit_mode}
            onchange={(on) => update((next) => (next.open_items_in_edit_mode = on))}
          />
        {/snippet}
        {@render row('Open items in edit mode', 'Clicking a pen, ink or swatch opens it for editing instead of showing its details.', editMode)}
        {#snippet confirmDelete()}
          <Switch
            label="Ask before deleting"
            checked={s.confirm_destructive_actions}
            onchange={(on) => update((next) => (next.confirm_destructive_actions = on))}
          />
        {/snippet}
        {@render row('Ask before deleting', 'Asks for confirmation before a pen, ink or swatch is deleted.', confirmDelete)}
      </section>

      <section id="backups">
        <h3>Backups</h3>
        <div class="status">
          <span class="ok" class:none={!lastBackup}><Icon name={lastBackup ? 'check' : 'warning'} size={16} /></span>
          <div class="grow">
            <p class="label">
              {#if backups === null}Checking backups…
              {:else if lastBackup}Last automatic backup {formatDate(lastBackup.created_at, s.defaults.date_format)} at
                {new Date(lastBackup.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {:else}No automatic backups yet{/if}
            </p>
            <p class="help">
              {[
                frequencyLabel,
                backups ? `${backups.length} of ${s.backups.keep} kept` : null,
                lastBackup ? size(lastBackup.bytes) : null,
                'includes photos',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div class="buttons">
            <Button variant="ghost" size="sm" icon="upload-simple" disabled={restoring} onclick={() => restoreInput?.click()}>
              {restoring ? 'Restoring…' : 'Restore…'}
            </Button>
            <a class="download" href={exportUrl} download><Icon name="download-simple" size={14} />Export backup</a>
            <input
              bind:this={restoreInput}
              type="file"
              accept=".zip,application/zip"
              hidden
              onchange={(event) => restore(event.currentTarget.files?.[0])}
            />
          </div>
        </div>
        {#snippet frequency()}
          <Segmented
            label="Automatic backups"
            value={s.backups.frequency}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
            onchange={(value) => update((next) => (next.backups.frequency = value))}
          />
        {/snippet}
        {@render row('Automatic backups', 'How often a full copy of your collection, photos included, is saved to the backups folder.', frequency)}
        {#snippet keep()}
          <input
            class="number"
            type="number"
            min="1"
            max="365"
            value={s.backups.keep}
            aria-label="Backups to keep"
            onchange={(event) => {
              const value = Math.round(Number(event.currentTarget.value));
              if (value >= 1) update((next) => (next.backups.keep = value));
              else event.currentTarget.value = String(s.backups.keep);
            }}
          />
        {/snippet}
        {@render row('Backups to keep', 'When there are more automatic backups than this, the oldest are deleted.', keep)}
        {#snippet replaced()}
          <Switch
            label="Keep replaced photos"
            checked={s.backups.keep_replaced_photos}
            onchange={(on) => update((next) => (next.backups.keep_replaced_photos = on))}
          />
        {/snippet}
        {@render row('Keep replaced photos', 'When you replace or remove a photo, the old file is moved to the replaced-photos folder instead of being deleted.', replaced)}
        {#snippet validateImport()}
          <Switch
            label="Check backups before restoring"
            checked={s.backups.validate_on_import}
            onchange={(on) => update((next) => (next.backups.validate_on_import = on))}
          />
        {/snippet}
        {@render row('Check backups before restoring', 'Makes sure a backup file is complete and readable before it replaces your collection.', validateImport)}
      </section>

      <section id="visitors">
        <h3>Visitors</h3>
        {#snippet enabled()}
          <Switch
            label="Let visitors see the collection"
            checked={s.showcase.enabled}
            onchange={(on) => update((next) => (next.showcase.enabled = on))}
          />
        {/snippet}
        {@render row(
          'Let visitors see the collection',
          s.showcase.enabled
            ? 'Anyone who opens this address without signing in can browse what you choose below, but cannot change anything. Fill notes and private notes are never shown.'
            : 'Only you see the collection. Anyone else who opens this address gets the sign-in page.',
          enabled,
        )}
        {#snippet title()}
          <input
            class="text"
            type="text"
            value={s.showcase.title}
            aria-label="Name for visitors"
            onchange={(event) => {
              const value = event.currentTarget.value.trim();
              if (!value) event.currentTarget.value = s.showcase.title;
              else if (value !== s.showcase.title) update((next) => (next.showcase.title = value));
            }}
          />
        {/snippet}
        {@render row('Name for visitors', 'Shown to visitors in place of “Inkubator”, at the top and in the browser tab.', title)}
        {#snippet showcaseTheme()}
          <Segmented
            label="Theme for visitors"
            value={s.showcase.theme}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onchange={(value) => update((next) => (next.showcase.theme = value))}
          />
        {/snippet}
        {@render row('Theme for visitors', 'Auto follows each visitor’s own light or dark setting.', showcaseTheme)}
        <p class="kicker sub">Visitors can see</p>
        <div class="grid">
          {#each visibility as item (item.key)}
            <div class="cell">
              <span>{item.label}</span>
              <Switch
                label="Show {item.label.toLowerCase()} to visitors"
                checked={s.showcase[item.key] as boolean}
                onchange={(on) => update((next) => ((next.showcase[item.key] as boolean) = on))}
              />
            </div>
          {/each}
        </div>
        <p class="help note">
          A note is shown only when Notes is on here and “Show to visitors” is on for that pen, ink or swatch.
        </p>
        <p class="kicker sub">Visitors’ lists are sorted by</p>
        <div class="grid">
          <div class="cell">
            <span>Pens</span>
            <Select
              label="Pens are sorted by"
              value={s.showcase.pen_sort}
              options={penSorts}
              onchange={(value) => update((next) => (next.showcase.pen_sort = value))}
            />
          </div>
          <div class="cell">
            <span>Inks</span>
            <Select
              label="Inks are sorted by"
              value={s.showcase.ink_sort}
              options={inkSorts}
              onchange={(value) => update((next) => (next.showcase.ink_sort = value))}
            />
          </div>
          <div class="cell">
            <span>Swatches</span>
            <Select
              label="Swatches are sorted by"
              value={s.showcase.swatch_sort}
              options={swatchSorts}
              onchange={(value) => update((next) => (next.showcase.swatch_sort = value))}
            />
          </div>
        </div>
        <p class="help note">Visitors can still sort a list another way; this is how it opens.</p>
      </section>

      <section id="activity">
        <h3>Activity log</h3>
        {#snippet retention()}
          <Select
            label="Keep activity for"
            value={retentionKey(s.activity.retention)}
            options={retentionOptions}
            onchange={setRetention}
          />
        {/snippet}
        {@render row(
          'Keep activity for',
          'Older entries are deleted, along with the ink history from that time. What is in your pens now is always kept.',
          retention,
        )}
        {#snippet detail()}
          <Segmented
            label="Detail"
            value={s.activity.detail}
            options={[
              { value: 'brief', label: 'Brief' },
              { value: 'normal', label: 'Normal' },
              { value: 'detailed', label: 'Detailed' },
            ]}
            onchange={(value) => update((next) => (next.activity.detail = value))}
          />
        {/snippet}
        {@render row('Detail', 'Brief records only what happened to which item. Normal also names the fields you changed, and Detailed adds their old and new values.', detail)}
        <p class="kicker sub">What to record</p>
        <div class="grid">
          {#each [
            { key: 'record_pen_changes', label: 'Pen changes' },
            { key: 'record_ink_changes', label: 'Ink changes' },
            { key: 'record_swatches', label: 'Swatches' },
            { key: 'record_deletions', label: 'Deletions' },
          ] as const as item (item.key)}
            <div class="cell">
              <span>{item.label}</span>
              <Switch
                label="Record {item.label.toLowerCase()}"
                checked={s.activity[item.key]}
                onchange={(on) => update((next) => (next.activity[item.key] = on))}
              />
            </div>
          {/each}
        </div>
        <p class="help note">Inking, re-inking and flushing are always recorded.</p>
      </section>

      <section id="stats">
        <h3>Stats</h3>
        {#snippet statsRange()}
          <Segmented
            label="Stats opens with"
            value={s.stats.default_range}
            options={[
              { value: 'last_30_days', label: '30 days' },
              { value: 'last_90_days', label: '90 days' },
              { value: 'last_year', label: 'Year' },
              { value: 'all_time', label: 'All' },
            ]}
            onchange={(value) => update((next) => (next.stats.default_range = value))}
          />
        {/snippet}
        {@render row('Opens with', 'The period Stats shows when you open it, for you and for visitors. You can still switch it there.', statsRange)}
      </section>

      <section id="defaults">
        <h3>Formats and defaults</h3>
        {#snippet currency()}
          <Select
            label="Currency"
            value={s.defaults.currency}
            options={currencyOptions}
            onchange={(value) => update((next) => (next.defaults.currency = value))}
          />
        {/snippet}
        {@render row('Currency', 'Used for all prices.', currency)}
        {#snippet dateFormat()}
          <Select
            label="Date format"
            value={s.defaults.date_format}
            options={dateOptions}
            onchange={(value) => update((next) => (next.defaults.date_format = value))}
          />
        {/snippet}
        {@render row('Date format', 'How dates are shown everywhere, for you and for visitors.', dateFormat)}
        {#snippet nibSize()}
          <input
            class="text short"
            type="text"
            list="default-nib-sizes"
            value={s.defaults.nib_size}
            aria-label="Default nib size"
            onchange={(event) => update((next) => (next.defaults.nib_size = event.currentTarget.value.trim()))}
          />
          <datalist id="default-nib-sizes">{#each nibSizes as v (v)}<option value={v}></option>{/each}</datalist>
        {/snippet}
        {@render row('Nib size for new pens', 'Filled in when you add a pen. Leave empty for none.', nibSize)}
        {#snippet nibMaterial()}
          <input
            class="text short"
            type="text"
            list="default-nib-materials"
            value={s.defaults.nib_material}
            aria-label="Default nib material"
            onchange={(event) => update((next) => (next.defaults.nib_material = event.currentTarget.value.trim()))}
          />
          <datalist id="default-nib-materials">{#each nibMaterials as v (v)}<option value={v}></option>{/each}</datalist>
        {/snippet}
        {@render row('Nib material for new pens', 'Filled in when you add a pen. Leave empty for none.', nibMaterial)}
        {#snippet inkKind()}
          <Segmented
            label="Ink type"
            value={s.defaults.ink_kind}
            options={kinds}
            onchange={(value) => update((next) => (next.defaults.ink_kind = value))}
          />
        {/snippet}
        {@render row('Type for new inks', 'Selected when you add an ink.', inkKind)}
      </section>

      <section id="about">
        <h3>About</h3>
        {#snippet nothing()}{/snippet}
        {@render row(version ? `Inkubator ${version}` : 'Inkubator', 'Your collection, on your own computer or server.', nothing)}
      </section>
    </div>
  </div>
</div>

<style>
  .page {
    display: grid;
    gap: 22px;
    align-content: start;
  }
  .head h2 {
    font-size: 32px;
  }
  .layout {
    display: grid;
    grid-template-columns: 190px minmax(0, 760px);
    gap: 32px;
    align-items: start;
  }
  .index {
    position: sticky;
    top: 20px;
    display: grid;
    gap: 2px;
  }
  .index button {
    padding: 6px 10px;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .index button[aria-current] {
    color: var(--fg);
    box-shadow: inset 2px 0 0 var(--accent);
  }
  .sections {
    display: grid;
    gap: 34px;
  }
  section {
    scroll-margin-top: 20px;
  }
  h3 {
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-strong);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 24px;
    align-items: center;
    padding-block: 12px;
    border-bottom: 1px solid var(--line);
  }
  .label {
    font-size: 13.5px;
    font-weight: 500;
  }
  .help {
    max-width: 56ch;
    margin-top: 2px;
    color: var(--muted);
    font-size: 12.5px;
  }
  .note {
    padding-top: 8px;
  }
  .control {
    display: flex;
    justify-content: flex-end;
  }
  .sub {
    padding-top: 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0 24px;
  }
  .cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-block: 10px;
    border-bottom: 1px solid var(--line);
    font-size: 13.5px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 12px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
  }
  .ok {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--ok) 16%, transparent);
    color: var(--ok);
  }
  .ok.none {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .download {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 12.5px;
    font-weight: 500;
    text-decoration: none;
  }
  .text,
  .number {
    padding: 6px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-size: 13px;
  }
  .text {
    width: 240px;
  }
  .text.short {
    width: 140px;
  }
  .number {
    width: 80px;
  }
  .text:focus-visible,
  .number:focus-visible {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  @media (max-width: 900px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .index {
      display: none;
    }
  }
  @media (max-width: 600px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }
    .control {
      justify-content: flex-start;
    }
    .status {
      flex-wrap: wrap;
    }
    .status .grow {
      flex-basis: calc(100% - 50px);
    }
    .status .buttons {
      width: 100%;
    }
  }
</style>
