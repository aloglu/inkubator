<script lang="ts">
  /** A swatch's main photo in a 4:3 frame, or the ink's swab on paper when it has none. */
  import { photoUrl } from '../api';
  import { swabSheen } from '../ink';
  import type { Ink } from '../types/Ink';
  import type { Swatch } from '../types/Swatch';
  import PhotoFrame from './PhotoFrame.svelte';
  import Swab from './Swab.svelte';

  let {
    swatch,
    ink,
    radius = 'var(--radius-sm)',
    thumb = true,
  }: { swatch: Pick<Swatch, 'images'>; ink: Ink | undefined; radius?: string; thumb?: boolean } = $props();

  const image = $derived(swatch.images.find((i) => i.primary) ?? swatch.images[0]);
</script>

{#snippet paper()}
  <div class="paper" style:border-radius={radius}>
    {#if ink}<Swab base={ink.base_color} sheen={swabSheen(ink)} size="lg" />{/if}
  </div>
{/snippet}

{#if image}
  <PhotoFrame src={photoUrl(image.path, thumb)} {image} ratio={4 / 3} {radius} alt={ink ? `Swatch of ${ink.name}` : 'Swatch'}>
    {#snippet fallback()}{@render paper()}{/snippet}
  </PhotoFrame>
{:else}
  {@render paper()}
{/if}

<style>
  .paper {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 4 / 3;
    background: repeating-linear-gradient(-6deg, transparent 0 20px, var(--paper-line) 20px 21px), var(--paper);
  }
</style>
