<script lang="ts">
  /**
   * The app's frame: side rail on wide screens, tab bar on phones. The owner
   * sees every section; visitors see the sections the showcase allows.
   */
  import type { Component } from 'svelte';
  import Icon from '../../lib/components/Icon.svelte';
  import type { IconName } from '../../lib/icons';
  import { router } from '../../lib/router.svelte';
  import ConfirmDialog from '../../lib/components/ConfirmDialog.svelte';
  import Notices from '../../lib/components/Notices.svelte';
  import { collection } from '../../lib/stores/collection.svelte';
  import { ui } from '../../lib/stores/ui.svelte';
  import Activity from './activity/Activity.svelte';
  import Desk from './Desk.svelte';
  import InkFlow from './InkFlow.svelte';
  import ItemPanels from './ItemPanels.svelte';
  import Inks from './inks/Inks.svelte';
  import Pens from './pens/Pens.svelte';
  import Settings from './settings/Settings.svelte';
  import Stats from './stats/Stats.svelte';
  import Swatches from './swatches/Swatches.svelte';
  import More from './More.svelte';

  let { onsignout }: { onsignout: () => void } = $props();

  type Section = { path: string; label: string; icon: IconName; count?: () => number | undefined };
  const main: Section[] = [
    { path: '/', label: 'Desk', icon: 'lamp' },
    { path: '/pens', label: 'Pens', icon: 'pen-nib', count: () => collection.data?.pens.length },
    { path: '/inks', label: 'Inks', icon: 'drop', count: () => collection.data?.inks.length },
    {
      path: '/swatches',
      label: 'Swatches',
      icon: 'palette',
      count: () => collection.data?.swatches.length,
    },
  ];
  const more: Section[] = [
    { path: '/stats', label: 'Stats', icon: 'chart-line-up' },
    { path: '/activity', label: 'Activity', icon: 'clock-counter-clockwise' },
  ];
  const settings: Section = { path: '/settings', label: 'Settings', icon: 'sliders-horizontal' };
  const all = [...main, ...more, settings];

  const owner = $derived(collection.canEdit);
  const showcase = $derived(collection.data?.settings.showcase);

  /** Whether the current viewer may open a page; visitors follow the showcase settings. */
  function allowed(path: string): boolean {
    if (owner) return true;
    if (!showcase) return false;
    switch (path) {
      case '/':
        return showcase.show_pens && showcase.show_inks;
      case '/pens':
        return showcase.show_pens;
      case '/inks':
        return showcase.show_inks;
      case '/swatches':
        return showcase.show_swatches;
      case '/stats':
        return showcase.show_stats;
      case '/activity':
        return showcase.show_activity;
      case '/more':
        return true;
      default:
        return false;
    }
  }

  const visibleMain = $derived(main.filter((section) => allowed(section.path)));
  const visibleMore = $derived(more.filter((section) => allowed(section.path)));
  const current = $derived(all.find((section) => section.path === router.path));
  /** On phones these live under More: its tab stays lit and they get a back link. */
  const underMore = ['/stats', '/activity', '/settings'];
  const moreTab: Section = { path: '/more', label: 'More', icon: 'dots-three-outline' };
  const title = $derived(owner ? 'Inkubator' : showcase?.title || 'Inkubator');
  const signInHref = $derived(`/sign-in?next=${encodeURIComponent(router.path + location.search)}`);

  // A visitor arriving at a page the showcase hides goes to the first one it shows.
  $effect(() => {
    if (owner && router.path === '/sign-in') router.navigate('/', { replace: true });
    if (owner || !showcase || allowed(router.path) || router.path === '/_components') return;
    const first = [...main, ...more].find((section) => allowed(section.path));
    router.navigate(first?.path ?? '/more', { replace: true });
  });

  $effect(() => {
    document.title = title;
  });

  // The theme setting: "auto" follows the system.
  $effect(() => {
    const theme = collection.data?.settings.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  });

  // The component gallery is a development aid and is left out of release builds.
  let gallery: Component | null = $state(null);
  $effect(() => {
    if (import.meta.env.DEV && router.path === '/_components' && !gallery) {
      void import('./Gallery.svelte').then((module) => (gallery = module.default));
    }
  });

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
      <a href="/" class="brand"><img src="/icons/nib-128.png" alt="" height="28" />{title}</a>
      {#each visibleMain as section (section.path)}{@render link(section)}{/each}
      {#if visibleMore.length}
        <div class="sep"></div>
        {#each visibleMore as section (section.path)}{@render link(section)}{/each}
      {/if}
      <div class="grow"></div>
      {#if owner}
        {@render link(settings)}
        <button type="button" class="nav" onclick={onsignout}><Icon name="sign-out" size={17} />Log out</button>
      {:else}
        <a class="nav" href={signInHref}><Icon name="sign-out" size={17} />Sign in</a>
      {/if}
    </nav>
  </div>

  <main>
    {#if router.path === '/_components' && import.meta.env.DEV}
      {#if gallery}{@const Gallery = gallery}<Gallery />{/if}
    {:else if collection.status === 'error'}
      <p role="alert">{collection.error?.message}</p>
    {:else if !collection.data}
      <p class="muted">Loading…</p>
    {:else}
      {#if underMore.includes(router.path) && router.path !== '/more'}
        <a class="back" href="/more"><Icon name="caret-left" size={14} />More</a>
      {/if}
      {#if router.path === '/'}
        <Desk data={collection.data} />
      {:else if router.path === '/inks'}
        <Inks data={collection.data} />
      {:else if router.path === '/pens'}
        <Pens data={collection.data} />
      {:else if router.path === '/swatches'}
        <Swatches data={collection.data} />
      {:else if router.path === '/activity'}
        <Activity data={collection.data} />
      {:else if router.path === '/settings'}
        <Settings data={collection.data} />
      {:else if router.path === '/stats'}
        <Stats data={collection.data} />
      {:else if router.path === '/more'}
        <More data={collection.data} sections={visibleMore} {owner} {onsignout} {signInHref} />
      {:else}
        <h2>Page not found</h2>
        <p class="muted"><a href="/">Go to the Desk</a></p>
      {/if}
      <ItemPanels data={collection.data} />
    {/if}
  </main>

  <nav class="tabbar" aria-label="Sections">
    {#each visibleMain as section (section.path)}
      {@render tab(section)}
    {/each}
    {@render tab(moreTab)}
  </nav>
</div>

{#snippet tab(section: Section)}
  {@const active =
    section === moreTab ? router.path === moreTab.path || underMore.includes(router.path) : current === section}
  <a href={section.path} aria-current={active ? 'page' : undefined}>
    <Icon name={section.icon} size={20} />
    {section.label}
  </a>
{/snippet}

{#if collection.data && owner}<InkFlow />{/if}
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
  .back {
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
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 14px;
      text-decoration: none;
    }
    main {
      padding: 18px 16px;
    }
    .tabbar {
      position: fixed;
      inset: auto 0 0;
      z-index: 10;
      display: grid;
      grid-auto-columns: 1fr;
      grid-auto-flow: column;
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
  }
</style>
