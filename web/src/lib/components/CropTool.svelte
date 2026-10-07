<script lang="ts">
  /**
   * Sets how a photo is cropped into a fixed frame: drag the window (or use the
   * arrow keys) to move the focus, zoom with the slider, rotate in quarter turns.
   * The stored file is never changed.
   */
  import { clampFocus, cropWindow, turnedRatio } from '../crop';
  import type { Image } from '../types/Image';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  let {
    src,
    image = $bindable(),
    ratio,
    label,
  }: {
    src: string;
    image: Image;
    /** The frame's width / height, e.g. 16 / 9. */
    ratio: number;
    /** e.g. "Card crop (16:9)". */
    label: string;
  } = $props();

  let natural = $state<{ width: number; height: number } | null>(null);
  let boxWidth = $state(0);
  let dragging: { x: number; y: number; focusX: number; focusY: number } | null = $state(null);

  $effect(() => {
    void src;
    natural = null;
  });

  const photoRatio = $derived(natural ? turnedRatio(natural.width, natural.height, image.rotation) : 1);
  const box = $derived({ width: boxWidth, height: boxWidth / photoRatio });
  const win = $derived(cropWindow(ratio, photoRatio, image.zoom));
  const focus = $derived(clampFocus({ x: image.focus_x, y: image.focus_y }, win));
  const turned = $derived(image.rotation === 90 || image.rotation === 270);

  function setFocus(x: number, y: number) {
    const next = clampFocus({ x, y }, win);
    image = { ...image, focus_x: round(next.x), focus_y: round(next.y) };
  }
  const round = (value: number) => Math.round(value * 1000) / 1000;

  function setZoom(zoom: number) {
    const next = clampFocus({ x: image.focus_x, y: image.focus_y }, cropWindow(ratio, photoRatio, zoom));
    image = { ...image, zoom, focus_x: round(next.x), focus_y: round(next.y) };
  }

  function rotate() {
    // Focus is measured on the turned photo, so start again from the centre.
    image = { ...image, rotation: (image.rotation + 90) % 360, focus_x: 0.5, focus_y: 0.5, zoom: 1 };
  }

  function reset() {
    image = { ...image, rotation: 0, focus_x: 0.5, focus_y: 0.5, zoom: 1 };
  }

  function onpointerdown(event: PointerEvent) {
    if (!box.width) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY, focusX: focus.x, focusY: focus.y };
  }

  function onpointermove(event: PointerEvent) {
    if (!dragging) return;
    setFocus(
      dragging.focusX + (event.clientX - dragging.x) / box.width,
      dragging.focusY + (event.clientY - dragging.y) / box.height,
    );
  }

  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setFocus(focus.x + move[0], focus.y + move[1]);
  }

  const imgStyle = $derived.by(() => {
    if (!natural || !box.width) return 'visibility:hidden';
    // Size the unturned photo so that, once turned, it fills the box.
    const scale = box.width / (turned ? natural.height : natural.width);
    return `width:${natural.width * scale}px;height:${natural.height * scale}px;transform:translate(-50%,-50%) rotate(${image.rotation}deg)`;
  });
</script>

<div class="crop">
  <div class="head">
    <span>{label}</span>
    <span>Drag to move</span>
  </div>
  <div
    class="photo"
    class:dragging
    bind:clientWidth={boxWidth}
    style:height="{box.height}px"
    {onpointerdown}
    {onpointermove}
    onpointerup={() => (dragging = null)}
    onpointercancel={() => (dragging = null)}
    role="presentation"
  >
    <img
      {src}
      alt=""
      draggable="false"
      style={imgStyle}
      onload={(event) => {
        const el = event.currentTarget as HTMLImageElement;
        natural = { width: el.naturalWidth, height: el.naturalHeight };
      }}
    />
    {#if natural}
      <div
        class="window"
        role="slider"
        tabindex="0"
        aria-label="Crop position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(focus.x * 100)}
        aria-valuetext="{Math.round(focus.x * 100)}% across, {Math.round(focus.y * 100)}% down"
        {onkeydown}
        style:left="{(focus.x - win.width / 2) * 100}%"
        style:top="{(focus.y - win.height / 2) * 100}%"
        style:width="{win.width * 100}%"
        style:height="{win.height * 100}%"
      ></div>
    {/if}
  </div>
  <label class="zoom">
    <Icon name="magnifying-glass-minus" size={14} />
    <span class="visually-hidden">Zoom</span>
    <input
      type="range"
      min="1"
      max="4"
      step="0.05"
      value={image.zoom}
      oninput={(event) => setZoom(Number(event.currentTarget.value))}
    />
    <Icon name="magnifying-glass-plus" size={14} />
  </label>
  <div class="buttons">
    <Button variant="ghost" size="sm" icon="arrow-clockwise" onclick={rotate}>Rotate</Button>
    <Button variant="ghost" size="sm" onclick={reset}>Reset</Button>
  </div>
</div>

<style>
  .crop {
    display: grid;
    gap: 8px;
    width: 100%;
    color: var(--muted);
    font-size: 11.5px;
    text-align: left;
  }
  .head {
    display: flex;
    justify-content: space-between;
  }
  .photo {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--surface);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .photo.dragging {
    cursor: grabbing;
  }
  img {
    position: absolute;
    left: 50%;
    top: 50%;
    max-width: none;
    pointer-events: none;
  }
  .window {
    position: absolute;
    border: 2px solid #fff;
    border-radius: 2px;
    box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.55);
  }
  .window:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .zoom {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .zoom input {
    flex: 1;
    accent-color: var(--accent);
  }
  .buttons {
    display: flex;
    gap: 6px;
  }
</style>
