<script lang="ts">
  /**
   * Shows a photo in a fixed-ratio frame.
   *
   * `cover` fills the frame, cropped around the stored focus point and enlarged
   * by the stored zoom. `fit` shows the whole photo over a blurred copy of itself.
   * Rotation is applied first; the focus point refers to the rotated photo.
   */
  import type { Snippet } from 'svelte';
  import type { Image } from '../types/Image';

  let {
    src,
    image,
    ratio,
    mode = 'cover',
    alt = '',
    radius = 'var(--radius)',
    fallback,
  }: {
    src: string;
    image: Pick<Image, 'rotation' | 'focus_x' | 'focus_y' | 'zoom'>;
    /** Width / height, e.g. 16 / 9. */
    ratio: number;
    mode?: 'cover' | 'fit';
    alt?: string;
    radius?: string;
    /** Shown while loading and if the photo cannot be loaded. */
    fallback?: Snippet;
  } = $props();

  let frameWidth = $state(0);
  let frameHeight = $state(0);
  let natural: { width: number; height: number } | null = $state(null);
  let failed = $state(false);

  $effect(() => {
    void src;
    natural = null;
    failed = false;
  });

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  // A turned backdrop must grow to still cover a non-square frame.
  const backdropScale = $derived(
    (image.rotation === 90 || image.rotation === 270 ? Math.max(ratio, 1 / ratio) : 1) * 1.15,
  );

  const layout = $derived.by(() => {
    if (!natural || !frameWidth || !frameHeight) return null;
    const turned = image.rotation === 90 || image.rotation === 270;
    const shownW = turned ? natural.height : natural.width;
    const shownH = turned ? natural.width : natural.height;
    const scale =
      mode === 'cover'
        ? Math.max(frameWidth / shownW, frameHeight / shownH) * clamp(image.zoom, 1, 4)
        : Math.min(frameWidth / shownW, frameHeight / shownH);
    const w = shownW * scale;
    const h = shownH * scale;
    const left =
      mode === 'cover'
        ? clamp(frameWidth / 2 - image.focus_x * w, frameWidth - w, 0)
        : (frameWidth - w) / 2;
    const top =
      mode === 'cover'
        ? clamp(frameHeight / 2 - image.focus_y * h, frameHeight - h, 0)
        : (frameHeight - h) / 2;
    return {
      box: `left:${left}px;top:${top}px;width:${w}px;height:${h}px`,
      img: `width:${natural.width * scale}px;height:${natural.height * scale}px;transform:translate(-50%,-50%) rotate(${image.rotation}deg)`,
    };
  });
</script>

<div
  class="frame"
  style:aspect-ratio={ratio}
  style:border-radius={radius}
  bind:clientWidth={frameWidth}
  bind:clientHeight={frameHeight}
>
  {#if (!layout || failed) && fallback}
    <div class="fallback">{@render fallback()}</div>
  {/if}
  {#if !failed}
    {#if mode === 'fit' && layout}
      <img class="backdrop" {src} alt="" aria-hidden="true" style:transform="rotate({image.rotation}deg) scale({backdropScale})" />
    {/if}
    <div class="box" style={layout?.box ?? 'visibility:hidden'}>
      <img
        {src}
        {alt}
        style={layout?.img}
        decoding="async"
        onload={(event) => {
          const el = event.currentTarget as HTMLImageElement;
          natural = { width: el.naturalWidth, height: el.naturalHeight };
        }}
        onerror={() => (failed = true)}
      />
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    overflow: hidden;
    width: 100%;
    background: var(--field);
  }
  .fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  .box {
    position: absolute;
  }
  .box img {
    position: absolute;
    left: 50%;
    top: 50%;
    max-width: none;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(18px) saturate(1.1) brightness(0.85);
  }
</style>
