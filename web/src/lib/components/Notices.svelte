<script lang="ts">
  /**
   * Short-lived messages at the bottom of the screen. An open modal panel sits
   * in the browser's top layer and makes the page behind it inert, so while one
   * is open the notices move into it, where they show and their buttons work.
   */
  import { ui } from '../stores/ui.svelte';
  import Icon from './Icon.svelte';

  let element: HTMLDivElement | undefined = $state();

  $effect(() => {
    const notices = element;
    const home = notices?.parentElement;
    if (!notices || !home) return;
    /** Modal dialogs in the order they opened; the last is on top. */
    let stack: HTMLDialogElement[] = [];
    const place = () => {
      const open = [...document.querySelectorAll('dialog')].filter((d) => d.open && d.matches(':modal'));
      stack = [...stack.filter((d) => open.includes(d)), ...open.filter((d) => !stack.includes(d))];
      const target = stack.at(-1) ?? home;
      if (notices.parentElement !== target) target.append(notices);
    };
    const observer = new MutationObserver(place);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    place();
    return () => {
      observer.disconnect();
      home.append(notices);
    };
  });
</script>

<div class="notices" role="status" aria-live="polite" bind:this={element}>
  {#each ui.notices as notice (notice.id)}
    <div class="notice" class:error={notice.tone === 'error'}>
      {#if notice.tone === 'error'}<Icon name="warning" size={16} />{:else}<Icon name="check" size={16} />{/if}
      <span>{notice.text}</span>
      {#if notice.action}
        {@const action = notice.action}
        <button
          type="button"
          class="action"
          onclick={() => {
            ui.dismiss(notice.id);
            action.run();
          }}
        >
          {action.label}
        </button>
      {/if}
      <button type="button" aria-label="Dismiss" onclick={() => ui.dismiss(notice.id)}><Icon name="x" size={14} /></button>
    </div>
  {/each}
</div>

<style>
  .notices {
    position: fixed;
    left: 50%;
    bottom: calc(20px + env(safe-area-inset-bottom));
    z-index: 50;
    display: grid;
    gap: 8px;
    width: min(440px, calc(100vw - 32px));
    transform: translateX(-50%);
    pointer-events: none;
  }
  .notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 14px;
    border-radius: var(--radius);
    background: var(--fg);
    color: var(--bg);
    box-shadow: var(--shadow-pop);
    font-size: 13px;
    pointer-events: auto;
  }
  .notice > :global(svg:first-child) {
    flex: none;
    color: var(--accent);
  }
  .notice.error > :global(svg:first-child) {
    color: var(--danger);
  }
  span {
    flex: 1;
  }
  button {
    display: grid;
    place-items: center;
    padding: 4px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
  }
  button:hover {
    opacity: 1;
  }
  .action {
    padding: 4px 8px;
    color: var(--accent);
    font-size: 13px;
    font-weight: 600;
    opacity: 1;
  }
  @media (max-width: 700px) {
    .notices {
      bottom: calc(80px + env(safe-area-inset-bottom));
    }
  }
</style>
