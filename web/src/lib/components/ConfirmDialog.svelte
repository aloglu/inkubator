<script lang="ts">
  /** Answers `ui.confirm` requests. Rendered once in the admin shell. */
  import { ui } from '../stores/ui.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  const request = $derived(ui.confirming);
</script>

<Dialog open={request !== null} onclose={() => ui.answer(false)} title={request?.title ?? ''}>
  <p>{request?.message}</p>
  {#snippet footer()}
    <span></span>
    <div class="buttons">
      <Button variant="ghost" onclick={() => ui.answer(false)}>Cancel</Button>
      <Button variant={request?.danger ? 'danger' : 'primary'} onclick={() => ui.answer(true)}>{request?.confirm}</Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .buttons {
    display: flex;
    gap: 8px;
  }
</style>
