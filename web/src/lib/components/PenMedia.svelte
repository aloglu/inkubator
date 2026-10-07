<script lang="ts">
  /** A pen's primary photo in a 16:9 frame, or its drawing when it has none. */
  import { photoUrl } from '../api';
  import type { Pen } from '../types/Pen';
  import PenDrawing from './PenDrawing.svelte';
  import PhotoFrame from './PhotoFrame.svelte';

  let {
    pen,
    thumb = true,
    radius,
  }: { pen: Pick<Pen, 'images' | 'colors'>; thumb?: boolean; radius?: string } = $props();

  const image = $derived(pen.images.find((i) => i.primary) ?? pen.images[0]);
  let width = $state(0);
</script>

<div class="media" bind:clientWidth={width}>
  {#if image}
    <PhotoFrame src={photoUrl(image.path, thumb)} {image} ratio={16 / 9} {radius}>
      {#snippet fallback()}<PenDrawing colors={pen.colors} width={Math.round(width * 0.82)} />{/snippet}
    </PhotoFrame>
  {:else}
    <div class="drawing" style:border-radius={radius ?? 'var(--radius)'}>
      <PenDrawing colors={pen.colors} width={Math.round(width * 0.82)} />
    </div>
  {/if}
</div>

<style>
  .media {
    width: 100%;
  }
  .drawing {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    background: var(--surface);
  }
</style>
