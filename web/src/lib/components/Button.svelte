<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './Icon.svelte';
  import type { IconName } from '../icons';

  let {
    variant = 'primary',
    size = 'md',
    icon,
    trailingIcon,
    active = false,
    element = $bindable(),
    type = 'button',
    children,
    ...rest
  }: HTMLButtonAttributes & {
    variant?: 'primary' | 'ghost' | 'danger';
    size?: 'md' | 'sm';
    icon?: IconName;
    trailingIcon?: IconName;
    /** Highlight, e.g. while the button's menu is open. */
    active?: boolean;
    /** The <button> element, e.g. to anchor a menu. */
    element?: HTMLButtonElement;
    children?: Snippet;
  } = $props();
</script>

<button
  bind:this={element}
  {type}
  class="btn {variant} {size}"
  class:active
  class:icon-only={!children}
  {...rest}
>
  {#if icon}<Icon name={icon} size={size === 'sm' ? 14 : 15} />{/if}
  {@render children?.()}
  {#if trailingIcon}<Icon name={trailingIcon} size={12} />{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    font-weight: 500;
    font-size: 13px;
    padding: 7px 14px;
    cursor: pointer;
    white-space: nowrap;
    line-height: 1.2;
  }
  .btn.sm {
    padding: 4px 10px;
    font-size: 12px;
  }
  .btn.icon-only {
    padding: 7px;
  }
  .btn.icon-only.sm {
    padding: 4px;
  }
  .primary {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .ghost {
    background: transparent;
    border-color: var(--line-strong);
  }
  .ghost:hover:not(:disabled) {
    background: var(--accent-soft);
  }
  .danger {
    background: transparent;
    border-color: var(--line-strong);
    color: var(--danger);
  }
  .active {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
