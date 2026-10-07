<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  let {
    label,
    value = $bindable(''),
    prefix,
    suffix,
    multiline = false,
    ...rest
  }: Omit<HTMLInputAttributes, 'value' | 'prefix'> & {
    label: string;
    value?: string;
    /** Text shown before the input, e.g. a currency symbol. */
    prefix?: string;
    /** Text shown after the input, e.g. "ml". */
    suffix?: string;
    multiline?: boolean;
  } = $props();

  const id = $props.id();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box" class:multiline>
    {#if prefix}<span class="affix">{prefix}</span>{/if}
    {#if multiline}
      <textarea {id} bind:value rows="3" placeholder={rest.placeholder as string | undefined}></textarea>
    {:else}
      <input {id} bind:value {...rest} />
    {/if}
    {#if suffix}<span class="affix">{suffix}</span>{/if}
  </div>
</div>

<style>
  .field {
    display: grid;
    align-content: start;
    gap: 4px;
    min-width: 0;
  }
  label {
    font-size: 12px;
    color: var(--muted);
  }
  .box {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--field);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 0 10px;
    min-height: 34px;
    min-width: 0;
  }
  .box:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .box.multiline {
    align-items: flex-start;
    padding-block: 7px;
  }
  input,
  textarea {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
    font-size: 13px;
    padding: 7px 0;
  }
  textarea {
    padding: 0;
    resize: vertical;
  }
  .affix {
    color: var(--muted);
    font-size: 13px;
  }
</style>
