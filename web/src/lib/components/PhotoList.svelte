<script lang="ts">
  /**
   * Photos of one item: add (upload), remove, and choose the main one. Uploads
   * go to the server straight away; the item keeps them only when it is saved.
   */
  import { photoUrl, uploadPhoto, type PhotoSection } from '../api';
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
  }: {
    images?: Image[];
    section: PhotoSection;
    /** Used to name the stored file, e.g. the ink's name. */
    name: string;
    ratio: number;
    label?: string;
  } = $props();

  let uploading = $state(0);
  let error = $state('');
  let input: HTMLInputElement | undefined = $state();

  async function add(files: FileList | null) {
    error = '';
    for (const file of files ?? []) {
      uploading++;
      try {
        const path = await uploadPhoto(section, file, name);
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
      } catch (failure) {
        error = describeError(failure);
      } finally {
        uploading--;
      }
    }
    if (input) input.value = '';
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
    <figure class:primary={image.primary}>
      <PhotoFrame src={photoUrl(image.path, true)} {image} {ratio} mode="fit" radius="var(--radius-sm)" />
      <div class="actions">
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
  <label class="add" style:aspect-ratio={ratio}>
    <input bind:this={input} type="file" accept="image/*" multiple onchange={(event) => add(event.currentTarget.files)} />
    <Icon name={uploading ? 'arrows-clockwise' : 'image'} size={20} />
    <span>{uploading ? 'Uploading…' : label}</span>
  </label>
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
  .add {
    position: relative;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    padding: 6px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-size: 12px;
    text-align: center;
    cursor: pointer;
  }
  .add:hover,
  .add:focus-within {
    border-color: var(--accent);
    color: var(--fg);
  }
  .add input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .error {
    margin-top: 6px;
    color: var(--danger);
    font-size: 12px;
  }
</style>
