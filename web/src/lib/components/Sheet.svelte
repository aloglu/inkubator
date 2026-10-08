<script lang="ts">
  /**
   * A side panel for details and editors. Uses a native modal <dialog>, so focus
   * stays inside, Esc closes it and the page behind is inert. Full screen on
   * narrow windows.
   */
  import type { Snippet } from 'svelte';
  import type { IconName } from '../icons';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  let {
    open,
    onclose,
    kicker,
    icon,
    title,
    wide = false,
    actions,
    footer,
    children,
  }: {
    open: boolean;
    onclose: () => void;
    kicker?: string;
    /** The section's icon, shown before the kicker. */
    icon?: IconName;
    title?: string;
    wide?: boolean;
    actions?: Snippet;
    footer?: Snippet;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus the panel itself, not its first button (often Delete).
      dialog.focus();
    }
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  tabindex="-1"
  class="sheet"
  class:wide
  aria-label={title ?? kicker}
  onclose={onclose}
  onclick={(event) => {
    if (event.target === dialog) onclose();
  }}
>
  {#if open}
    <div class="panel">
      <header>
        <div class="heading">
          {#if icon}<span class="icon"><Icon name={icon} size={15} /></span>{/if}
          {#if kicker}<span class="kicker">{kicker}</span>{/if}
          {#if title}<h3>{title}</h3>{/if}
        </div>
        <div class="actions">
          {@render actions?.()}
          <Button variant="ghost" icon="x" aria-label="Close" onclick={onclose} />
        </div>
      </header>
      <div class="body">{@render children()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  {/if}
</dialog>

<style>
  .sheet {
    margin: 0 0 0 auto;
    padding: 0;
    height: 100dvh;
    max-height: none;
    width: min(780px, 78vw);
    max-width: 100vw;
    border: 0;
    border-left: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    box-shadow: -20px 0 40px rgba(0, 0, 0, 0.18);
  }
  .sheet.wide {
    width: min(860px, 82vw);
  }
  .sheet:focus-visible {
    outline: none;
  }
  .sheet::backdrop {
    background: var(--scrim);
  }
  .panel {
    display: grid;
    grid-template-rows: auto 1fr auto;
    height: 100%;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 14px 20px 14px 24px;
    border-bottom: 1px solid var(--line);
  }
  .heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .heading .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    align-self: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .body {
    overflow-y: auto;
    min-height: 0;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
  }
  @media (max-width: 700px) {
    .sheet,
    .sheet.wide {
      width: 100vw;
      border-left: 0;
    }
    header {
      padding: 10px 12px 10px 16px;
    }
    footer {
      flex-wrap: wrap;
      padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    }
  }
</style>
