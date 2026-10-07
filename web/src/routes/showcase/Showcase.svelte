<script lang="ts">
  /** The public showcase. Only the projection from /api/public is ever loaded here. */
  import { getPublic } from '../../lib/api';
  import type { PublicCollection } from '../../lib/types/PublicCollection';

  let data: PublicCollection | null = $state(null);
  let error = $state('');

  $effect(() => {
    getPublic().then(
      (loaded) => (data = loaded),
      (failure) => (error = failure instanceof Error ? failure.message : String(failure)),
    );
  });
</script>

<main>
  {#if error}
    <p role="alert">{error}</p>
  {:else if data}
    <h1>{data.title}</h1>
    <p class="muted">
      {data.pens.length} pens, {data.inks.length} inks, {data.swatches.length} swatches. The showcase is not built
      yet.
    </p>
  {/if}
</main>

<style>
  main {
    padding: 40px 32px;
    display: grid;
    gap: 8px;
  }
</style>
