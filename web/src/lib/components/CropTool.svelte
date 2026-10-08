<script lang="ts">
  /**
   * Sets how a photo is cropped into a fixed frame: drag the window to move it,
   * pull a corner to make it smaller or larger (the frame keeps its shape),
   * pinch or scroll to zoom, rotate in quarter turns. Arrow keys move and + / −
   * zoom. The stored file is never changed.
   */
  import { MAX_ZOOM, MIN_ZOOM, clampFocus, cropWindow, resizeFromCorner, turnedRatio } from '../crop';
  import type { Image } from '../types/Image';
  import Button from './Button.svelte';

  let {
    src,
    image = $bindable(),
    ratio,
    label,
    ondone,
  }: {
    src: string;
    image: Image;
    /** The frame's width / height, e.g. 16 / 9. */
    ratio: number;
    /** e.g. "Card crop (16:9)". */
    label: string;
    /** Shows a Done button. */
    ondone?: () => void;
  } = $props();

  type Corner = { x: 1 | -1; y: 1 | -1 };
  const corners: { name: string; corner: Corner }[] = [
    { name: 'top left', corner: { x: -1, y: -1 } },
    { name: 'top right', corner: { x: 1, y: -1 } },
    { name: 'bottom left', corner: { x: -1, y: 1 } },
    { name: 'bottom right', corner: { x: 1, y: 1 } },
  ];

  let natural = $state<{ width: number; height: number } | null>(null);
  let boxWidth = $state(0);
  let photo: HTMLDivElement | undefined = $state();
  /** What the pointer is doing: moving the window, resizing it, or pinching. */
  let gesture:
    | { kind: 'move'; x: number; y: number; focusX: number; focusY: number }
    | { kind: 'resize'; anchor: { x: number; y: number }; corner: Corner }
    | { kind: 'pinch'; distance: number; zoom: number }
    | null = $state(null);
  const pointers = new Map<number, { x: number; y: number }>();

  $effect(() => {
    void src;
    natural = null;
  });

  const photoRatio = $derived(natural ? turnedRatio(natural.width, natural.height, image.rotation) : 1);
  const box = $derived({ width: boxWidth, height: boxWidth / photoRatio });
  const full = $derived(cropWindow(ratio, photoRatio, 1));
  const win = $derived(cropWindow(ratio, photoRatio, image.zoom));
  const focus = $derived(clampFocus({ x: image.focus_x, y: image.focus_y }, win));
  const turned = $derived(image.rotation === 90 || image.rotation === 270);

  const round = (value: number) => Math.round(value * 1000) / 1000;

  function setFocus(x: number, y: number) {
    const next = clampFocus({ x, y }, win);
    image = { ...image, focus_x: round(next.x), focus_y: round(next.y) };
  }

  /** Zooms around the window's centre. */
  function setZoom(zoom: number) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    const next = clampFocus({ x: image.focus_x, y: image.focus_y }, cropWindow(ratio, photoRatio, clamped));
    image = { ...image, zoom: round(clamped), focus_x: round(next.x), focus_y: round(next.y) };
  }

  function rotate() {
    // Focus is measured on the turned photo, so start again from the centre.
    image = { ...image, rotation: (image.rotation + 90) % 360, focus_x: 0.5, focus_y: 0.5, zoom: 1 };
  }

  function reset() {
    image = { ...image, rotation: 0, focus_x: 0.5, focus_y: 0.5, zoom: 1 };
  }

  /** The pointer's position as fractions of the photo. */
  function onPhoto(event: PointerEvent) {
    const rect = photo!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function spread() {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function onpointerdown(event: PointerEvent) {
    if (!box.width) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      gesture = { kind: 'pinch', distance: spread(), zoom: image.zoom };
      return;
    }
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-corner]');
    if (handle) {
      const corner = corners[Number(handle.dataset.corner)]!.corner;
      gesture = {
        kind: 'resize',
        corner,
        anchor: { x: focus.x - (corner.x * win.width) / 2, y: focus.y - (corner.y * win.height) / 2 },
      };
    } else {
      gesture = { kind: 'move', x: event.clientX, y: event.clientY, focusX: focus.x, focusY: focus.y };
    }
  }

  function onpointermove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture?.kind === 'pinch') {
      if (gesture.distance) setZoom(gesture.zoom * (spread() / gesture.distance));
    } else if (gesture?.kind === 'resize') {
      const next = resizeFromCorner(gesture.anchor, gesture.corner, onPhoto(event), full);
      const clamped = clampFocus(next.focus, cropWindow(ratio, photoRatio, next.zoom));
      image = { ...image, zoom: round(next.zoom), focus_x: round(clamped.x), focus_y: round(clamped.y) };
    } else if (gesture?.kind === 'move') {
      setFocus(
        gesture.focusX + (event.clientX - gesture.x) / box.width,
        gesture.focusY + (event.clientY - gesture.y) / box.height,
      );
    }
  }

  function onpointerup(event: PointerEvent) {
    pointers.delete(event.pointerId);
    // Lifting one finger of a pinch ends it; the other one does not start a drag.
    gesture = null;
  }

  // Scrolling zooms. Added by hand: it has to be able to stop the page from scrolling.
  $effect(() => {
    if (!photo) return;
    const onwheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(image.zoom * Math.exp(-event.deltaY * 0.002));
    };
    photo.addEventListener('wheel', onwheel, { passive: false });
    return () => photo?.removeEventListener('wheel', onwheel);
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(image.zoom * 1.1);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      setZoom(image.zoom / 1.1);
      return;
    }
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
    <span>Drag to move, pull a corner to resize</span>
  </div>
  <div
    class="photo"
    class:dragging={gesture !== null}
    bind:this={photo}
    bind:clientWidth={boxWidth}
    style:height="{box.height}px"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    role="presentation"
  >
    <div class="clip">
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
          aria-label="Crop position. Arrow keys move it, plus and minus zoom."
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(focus.x * 100)}
          aria-valuetext="{Math.round(focus.x * 100)}% across, {Math.round(focus.y * 100)}% down, zoom {image.zoom.toFixed(1)}×"
          {onkeydown}
          style:left="{(focus.x - win.width / 2) * 100}%"
          style:top="{(focus.y - win.height / 2) * 100}%"
          style:width="{win.width * 100}%"
          style:height="{win.height * 100}%"
        ></div>
      {/if}
    </div>
    {#if natural}
      <!-- Outside the clipped layer, so handles at the photo's edge stay whole. -->
      <div
        class="handles"
        style:left="{(focus.x - win.width / 2) * 100}%"
        style:top="{(focus.y - win.height / 2) * 100}%"
        style:width="{win.width * 100}%"
        style:height="{win.height * 100}%"
      >
        {#each corners as { name, corner }, index (name)}
          <span
            class="handle"
            data-corner={index}
            style:left={corner.x < 0 ? '0' : '100%'}
            style:top={corner.y < 0 ? '0' : '100%'}
            style:cursor={corner.x === corner.y ? 'nwse-resize' : 'nesw-resize'}
            aria-hidden="true"
          ></span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="buttons">
    <Button variant="ghost" size="sm" icon="arrow-clockwise" onclick={rotate}>Rotate</Button>
    <Button variant="ghost" size="sm" onclick={reset}>Reset</Button>
    {#if ondone}<span class="done"><Button size="sm" icon="check" onclick={ondone}>Done</Button></span>{/if}
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
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2px 12px;
  }
  .photo {
    position: relative;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .clip {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  .handles {
    position: absolute;
    pointer-events: none;
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
  /* Small to look at, large enough for a finger. */
  .handle {
    position: absolute;
    pointer-events: auto;
    width: 14px;
    height: 14px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: #fff;
    transform: translate(-50%, -50%);
  }
  .handle::before {
    content: '';
    position: absolute;
    inset: -14px;
  }
  @media (pointer: coarse) {
    .handle {
      width: 18px;
      height: 18px;
    }
  }
  .buttons {
    display: flex;
    gap: 6px;
  }
  .done {
    margin-left: auto;
  }
</style>
