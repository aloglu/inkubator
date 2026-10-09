<script lang="ts">
  /** Phones only: the sections that do not fit in the tab bar, and signing in or out. */
  import { listBackups } from '../../lib/api';
  import Icon from '../../lib/components/Icon.svelte';
  import { formatDate } from '../../lib/format';
  import type { IconName } from '../../lib/icons';
  import { updates } from '../../lib/stores/updates.svelte';
  import type { BackupFile } from '../../lib/types/BackupFile';
  import type { Collection } from '../../lib/types/Collection';

  let {
    data,
    sections,
    owner,
    onsignout,
    signInHref,
  }: {
    data: Collection;
    /** The secondary sections this viewer may open (Stats, Activity). */
    sections: { path: string; label: string; icon: IconName }[];
    owner: boolean;
    onsignout: () => void;
    signInHref: string;
  } = $props();

  const links: { href: string; label: string; icon: IconName; count?: number; note?: string }[] = $derived([
    ...sections.map((section) => ({ href: section.path, label: section.label, icon: section.icon })),
    ...(owner
      ? [
          {
            href: '/settings',
            label: 'Settings',
            icon: 'sliders-horizontal' as const,
            note: updates.status?.available ? 'Update available' : undefined,
          },
        ]
      : []),
  ]);

  let last = $state<BackupFile | null | undefined>(undefined);
  $effect(() => {
    if (!owner) return;
    listBackups().then(
      (result) => (last = result.scheduled.reduce<BackupFile | null>((a, b) => (!a || b.created_at > a.created_at ? b : a), null)),
      () => (last = null),
    );
  });
</script>

<div class="page">
  <h2>More</h2>
  <ul class="list">
    {#each links as link (link.href)}
      <li>
        <a href={link.href}>
          <Icon name={link.icon} size={18} />
          <span class="grow">{link.label}</span>
          {#if link.count !== undefined}<span class="count">{link.count}</span>{/if}
          {#if link.note}<span class="note">{link.note}</span>{/if}
          <Icon name="caret-right" size={14} />
        </a>
      </li>
    {/each}
    <li>
      {#if owner}
        <button type="button" onclick={onsignout}>
          <Icon name="sign-out" size={18} />
          <span class="grow">Log out</span>
        </button>
      {:else}
        <a href={signInHref}>
          <Icon name="sign-out" size={18} />
          <span class="grow">Sign in</span>
          <Icon name="caret-right" size={14} />
        </a>
      {/if}
    </li>
  </ul>

  {#if last !== undefined}
    <a class="backup" href="/settings#backups">
      <span class="ok" class:none={!last}><Icon name={last ? 'check' : 'warning'} size={14} /></span>
      <span>
        {#if last}Backed up {formatDate(last.created_at, data.settings.defaults.date_format, { short: true })}
        {:else}No automatic backups yet{/if}
      </span>
    </a>
  {/if}
</div>

<style>
  .page {
    display: grid;
    gap: 18px;
    align-content: start;
  }
  h2 {
    font-size: 32px;
  }
  .list {
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
    list-style: none;
  }
  li + li {
    border-top: 1px solid var(--line);
  }
  a,
  button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    border: 0;
    background: none;
    color: var(--fg);
    font-size: 15px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  a > :global(svg:first-child),
  button > :global(svg) {
    color: var(--muted);
  }
  a > :global(svg:last-child) {
    color: var(--muted);
  }
  .grow {
    flex: 1;
  }
  .note {
    color: var(--accent);
    font-size: 12.5px;
    font-weight: 500;
  }
  .count {
    color: var(--muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .backup {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: 13px;
  }
  .ok {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--ok) 16%, transparent);
    color: var(--ok);
  }
  .ok.none {
    background: color-mix(in srgb, var(--danger) 14%, transparent);
    color: var(--danger);
  }
</style>
