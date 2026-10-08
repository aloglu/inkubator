<script lang="ts">
  /**
   * Photos of one item: add (upload), remove, and choose the main one. Uploads
   * go to the server straight away; the item keeps them only when it is saved.
   */
  import { photoFromUrl, photoUrl, uploadPhoto, type PhotoSection } from '../api';
  import { heicToJpeg, isHeic } from '../heic';
  import { newId } from '../ids';
  import { describeError } from '../stores/ui.svelte';
  import type { Image } from '../types/Image';
  import Icon from './Icon.svelte';
  import PhotoFrame from './PhotoFrame.svelte';

  let {
    images = $bindable([]),
    section,
    name,
    ratio,
    label = 'Add a photo',
    adjusting,
    onadjust,
    lookup,
  }: {
    images?: Image[];
    section: PhotoSection;
    /** Used to name the stored file, e.g. the ink's name. */
    name: string;
    ratio: number;
    label?: string;
    /** The photo being adjusted (cropped or rotated) elsewhere, highlighted here. */
    adjusting?: string;
    /** Offers an Adjust button on each photo. */
    onadjust?: (id: string) => void;
    /** An extra way to find a photo online, e.g. on inkswatch.com; returns its address. */
    lookup?: { label: string; find: () => Promise<string> };
  } = $props();

  let uploading = $state(0);
  /** A HEIC photo is being turned into JPEG before upload. */
  let converting = $state(false);
  let error = $state('');
  let input: HTMLInputElement | undefined = $state();
  let linking = $state(false);
  /** A drag with files is over the drop area. */
  let over = $state(false);
  let link = $state('');

  /** Stores a photo on the server and adds it to the list. */
  async function store(save: () => Promise<string>): Promise<boolean> {
    uploading++;
    try {
      const path = await save();
      const image: Image = {
        id: newId('img'),
        path,
        primary: images.length === 0,
        rotation: 0,
        focus_x: 0.5,
        focus_y: 0.5,
        zoom: 1,
      };
      images = [...images, image];
      return true;
    } catch (failure) {
      error = describeError(failure);
      return false;
    } finally {
      uploading--;
    }
  }

  async function add(files: FileList | null) {
    error = '';
    for (const file of files ?? []) {
      await store(async () => {
        let photo = file;
        if (await isHeic(file)) {
          converting = true;
          try {
            photo = await heicToJpeg(file);
          } finally {
            converting = false;
          }
        }
        return uploadPhoto(section, photo, name);
      });
    }
    if (input) input.value = '';
  }

  async function addLink(event: Event) {
    event.preventDefault();
    error = '';
    const url = link.trim();
    if (!url) return;
    if (await store(() => photoFromUrl(section, url, name))) {
      link = '';
      linking = false;
    }
  }

  async function addFound() {
    if (!lookup) return;
    error = '';
    const find = lookup.find;
    await store(async () => photoFromUrl(section, await find(), name));
  }

  function remove(id: string) {
    const rest = images.filter((image) => image.id !== id);
    if (rest.length && !rest.some((image) => image.primary)) rest[0] = { ...rest[0]!, primary: true };
    images = rest;
  }

  function makePrimary(id: string) {
    images = images.map((image) => ({ ...image, primary: image.id === id }));
  }
</script>

<div class="photos">
  {#each images as image (image.id)}
    <figure class:primary={image.primary} class:selected={adjusting === image.id}>
      <PhotoFrame src={photoUrl(image.path, true)} {image} {ratio} mode="fit" radius="var(--radius-sm)" />
      <div class="actions">
        {#if onadjust}
          <button type="button" aria-label="Adjust photo" title="Crop and rotate" onclick={() => onadjust(image.id)}>
            <Icon name="pencil-simple" size={13} />
          </button>
        {/if}
        {#if images.length > 1}
          <button
            type="button"
            aria-pressed={image.primary}
            aria-label={image.primary ? 'Main photo' : 'Make main photo'}
            title={image.primary ? 'Main photo' : 'Make main photo'}
            onclick={() => makePrimary(image.id)}
          >
            <Icon name="star" size={13} />
          </button>
        {/if}
        <button type="button" aria-label="Remove photo" title="Remove photo" onclick={() => remove(image.id)}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </figure>
  {/each}
  <label
    class="add"
    class:over
    ondragover={(event) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      over = true;
    }}
    ondragleave={() => (over = false)}
    ondrop={(event) => {
      event.preventDefault();
      over = false;
      void add(event.dataTransfer?.files ?? null);
    }}
  >
    <input bind:this={input} type="file" accept="image/*,.heic,.heif" multiple onchange={(event) => add(event.currentTarget.files)} />
    <Icon name={uploading ? 'arrows-clockwise' : 'image'} size={24} />
    <span class="title">{converting ? 'Converting HEIC photo…' : uploading ? 'Uploading…' : label}</span>
    {#if !uploading}<span class="hint">Drop photos here, or choose</span>{/if}
  </label>
</div>
<div class="more">
  {#if linking}
    <div class="link-row">
      <input
        type="url"
        bind:value={link}
        placeholder="https://…"
        aria-label="Photo address"
        onkeydown={(event) => {
          if (event.key === 'Enter') void addLink(event);
          if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();
            linking = false;
          }
        }}
      />
      <button type="button" class="text" onclick={addLink} disabled={!link.trim() || uploading > 0}>Add</button>
    </div>
  {:else}
    <button type="button" class="text" onclick={() => (linking = true)}>From a link</button>
  {/if}
  {#if lookup}
    <button type="button" class="text" onclick={addFound} disabled={uploading > 0}>{lookup.label}</button>
  {/if}
</div>
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
  .photos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
    width: 100%;
  }
  figure {
    position: relative;
    margin: 0;
  }
  figure.primary :global(.frame) {
    box-shadow: 0 0 0 1px var(--line-strong);
  }
  figure.selected :global(.frame) {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .actions {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    gap: 3px;
  }
  .actions button {
    display: grid;
    place-items: center;
    padding: 4px;
    border: 0;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    cursor: pointer;
  }
  .actions button[aria-pressed='true'] {
    color: #f3c74f;
  }
  /* The drop area spans the whole row and stays comfortably large. */
  .add {
    position: relative;
    grid-column: 1 / -1;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    min-height: 120px;
    padding: 16px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 12px;
    text-align: center;
    cursor: pointer;
  }
  .add:hover,
  .add:focus-within,
  .add.over {
    border-color: var(--accent);
    color: var(--fg);
  }
  .add.over {
    background: var(--accent-soft);
  }
  .add .title {
    font-size: 13px;
    font-weight: 500;
  }
  .add .hint {
    font-size: 11.5px;
  }
  .add input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .more {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 12px;
    width: 100%;
    margin-top: 6px;
  }
  .link-row {
    display: flex;
    gap: 6px;
    width: 100%;
  }
  .link-row input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-size: 12px;
  }
  .text {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
  }
  .text:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .error {
    margin-top: 6px;
    color: var(--danger);
    font-size: 12px;
  }
</style>
