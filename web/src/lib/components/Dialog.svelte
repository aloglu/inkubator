<script lang="ts">
  /** A small centered dialog for quick actions such as Ink a pen. */
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  let {
    open,
    onclose,
    title,
    footer,
    children,
  }: {
    open: boolean;
    onclose: () => void;
    title: string;
    footer?: Snippet;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="dialog"
  aria-label={title}
  onclose={onclose}
  onclick={(event) => {
    if (event.target === dialog) onclose();
  }}
>
  {#if open}
    <header>
      <h3>{title}</h3>
      <Button variant="ghost" icon="x" aria-label="Close" onclick={onclose} />
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  {/if}
</dialog>

<style>
  .dialog {
    margin: 64px auto auto;
    padding: 0;
    width: min(580px, calc(100vw - 32px));
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--fg);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  }
  .dialog::backdrop {
    background: var(--scrim);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px 12px 20px;
    border-bottom: 1px solid var(--line);
  }
  .body {
    padding: 18px 20px;
    display: grid;
    gap: 12px;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
  }
</style>
