<script lang="ts">
  /** Short-lived messages at the bottom of the screen. */
  import { ui } from '../stores/ui.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="notices" role="status" aria-live="polite">
  {#each ui.notices as notice (notice.id)}
    <div class="notice" class:error={notice.tone === 'error'}>
      {#if notice.tone === 'error'}<Icon name="warning" size={16} />{:else}<Icon name="check" size={16} />{/if}
      <span>{notice.text}</span>
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
  @media (max-width: 700px) {
    .notices {
      bottom: calc(80px + env(safe-area-inset-bottom));
    }
  }
</style>
