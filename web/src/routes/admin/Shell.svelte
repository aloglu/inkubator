<script lang="ts">
  /** Admin layout: side rail on wide screens, tab bar on phones. */
  import type { Component } from 'svelte';
  import { logout } from '../../lib/api';
  import Icon from '../../lib/components/Icon.svelte';
  import type { IconName } from '../../lib/icons';
  import { router } from '../../lib/router.svelte';
  import ConfirmDialog from '../../lib/components/ConfirmDialog.svelte';
  import Notices from '../../lib/components/Notices.svelte';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import Desk from './Desk.svelte';
  import InkFlow from './InkFlow.svelte';
  import Inks from './inks/Inks.svelte';
  import Pens from './pens/Pens.svelte';
  import Placeholder from './Placeholder.svelte';

  let { onsignedout }: { onsignedout: () => void } = $props();

  type Section = { path: string; label: string; icon: IconName; count?: () => number | undefined };
  const main: Section[] = [
    { path: '/admin', label: 'Desk', icon: 'lamp' },
    { path: '/admin/pens', label: 'Pens', icon: 'pen-nib', count: () => collection.data?.pens.length },
    { path: '/admin/inks', label: 'Inks', icon: 'drop', count: () => collection.data?.inks.length },
    {
      path: '/admin/swatches',
      label: 'Swatches',
      icon: 'palette',
      count: () => collection.data?.swatches.length,
    },
  ];
  const more: Section[] = [
    { path: '/admin/stats', label: 'Stats', icon: 'chart-line-up' },
    { path: '/admin/activity', label: 'Activity', icon: 'clock-counter-clockwise' },
  ];
  const settings: Section = { path: '/admin/settings', label: 'Settings', icon: 'sliders-horizontal' };
  const all = [...main, ...more, settings];

  const current = $derived(all.find((section) => section.path === router.path));

  // The theme setting: "auto" follows the system.
  $effect(() => {
    const theme = collection.data?.settings.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  });

  // The component gallery is a development aid and is left out of release builds.
  let gallery: Component | null = $state(null);
  $effect(() => {
    if (import.meta.env.DEV && router.path === '/admin/_components' && !gallery) {
      void import('./Gallery.svelte').then((module) => (gallery = module.default));
    }
  });

  async function signOut() {
    try {
      await logout();
    } finally {
      onsignedout();
    }
  }
</script>

{#snippet link(section: Section)}
  {@const count = section.count?.()}
  <a href={section.path} class="nav" aria-current={current === section ? 'page' : undefined}>
    <Icon name={section.icon} size={17} />
    {section.label}
    {#if count !== undefined}<b>{count}</b>{/if}
  </a>
{/snippet}

<div class="app">
  <div class="rail-column">
    <nav class="rail" aria-label="Sections">
      <a href="/admin" class="brand"><img src="/nib.png" alt="" width="28" height="28" />Inkubator</a>
      {#each main as section (section.path)}{@render link(section)}{/each}
      <div class="sep"></div>
      {#each more as section (section.path)}{@render link(section)}{/each}
      <div class="grow"></div>
      {@render link(settings)}
      <button type="button" class="nav" onclick={signOut}><Icon name="sign-out" size={17} />Log out</button>
    </nav>
  </div>

  <main>
    {#if router.path === '/admin/_components' && import.meta.env.DEV}
      {#if gallery}{@const Gallery = gallery}<Gallery />{/if}
    {:else if collection.status === 'error'}
      <p role="alert">{collection.error?.message}</p>
    {:else if !collection.data}
      <p class="muted">Loading…</p>
    {:else if router.path === '/admin'}
      <Desk data={collection.data} />
    {:else if router.path === '/admin/inks'}
      <Inks data={collection.data} />
    {:else if router.path === '/admin/pens'}
      <Pens data={collection.data} />
    {:else}
      <Placeholder title={current?.label ?? 'Not found'} />
    {/if}
  </main>

  <nav class="tabbar" aria-label="Sections">
    {@render tab(main[0]!)}
    {@render tab(main[1]!)}
    <button type="button" class="ink-tab" onclick={() => ui.openInkFlow()} disabled={!collection.data}>
      <span><Icon name="drop" size={20} /></span>
      Ink a pen
    </button>
    {@render tab(main[2]!)}
    {@render tab({ path: '/admin/more', label: 'More', icon: 'dots-three-outline' })}
  </nav>
</div>

{#snippet tab(section: Section)}
  <a href={section.path} aria-current={current === section ? 'page' : undefined}>
    <Icon name={section.icon} size={20} />
    {section.label}
  </a>
{/snippet}

{#if collection.data}<InkFlow />{/if}
<ConfirmDialog />
<Notices />

<style>
  .app {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 196px minmax(0, 1fr);
  }
  .rail-column {
    border-right: 1px solid var(--line);
    background: var(--surface);
  }
  .rail {
    position: sticky;
    top: 0;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 22px 12px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 18px;
    font-family: var(--font-display);
    font-size: 21px;
    color: inherit;
    text-decoration: none;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted);
    font-size: 14px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .nav:hover {
    color: var(--fg);
  }
  .nav b {
    margin-left: auto;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }
  .nav[aria-current='page'] {
    color: var(--fg);
    background: var(--accent-soft);
  }
  .nav[aria-current='page'] :global(svg),
  .nav[aria-current='page'] b {
    color: var(--accent);
    opacity: 1;
  }
  .sep {
    height: 1px;
    margin: 10px;
    background: var(--line);
  }
  .grow {
    flex: 1;
  }
  main {
    min-width: 0;
    padding: 28px 32px;
  }
  .tabbar {
    display: none;
  }

  @media (max-width: 700px) {
    .app {
      grid-template-columns: minmax(0, 1fr);
      padding-bottom: calc(64px + env(safe-area-inset-bottom));
    }
    .rail-column {
      display: none;
    }
    main {
      padding: 18px 16px;
    }
    .tabbar {
      position: fixed;
      inset: auto 0 0;
      z-index: 10;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      padding: 7px 4px calc(10px + env(safe-area-inset-bottom));
      border-top: 1px solid var(--line);
      background: var(--surface);
    }
    .tabbar a {
      display: grid;
      justify-items: center;
      gap: 2px;
      font-size: 10px;
      color: var(--muted);
      text-decoration: none;
    }
    .tabbar a[aria-current='page'] {
      color: var(--accent);
    }
    .ink-tab {
      display: grid;
      justify-items: center;
      gap: 2px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--fg);
      font-size: 10px;
    }
    .ink-tab span {
      display: grid;
      place-items: center;
      width: 40px;
      height: 28px;
      margin-top: -4px;
      border-radius: 99px;
      background: var(--accent);
      color: var(--accent-ink);
    }
  }
</style>
