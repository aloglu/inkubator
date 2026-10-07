<script lang="ts">
  /**
   * A panel that opens under a button. Uses the popover API, so a click outside
   * or Esc closes it and it sits above everything else. Flips above the button
   * when there is no room below.
   */
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    anchor,
    open,
    onclose,
    width = 290,
    onopen,
    children,
    class: className = '',
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    anchor: HTMLElement | undefined;
    open: boolean;
    onclose: () => void;
    width?: number;
    /** Called once the panel is showing, e.g. to move focus into it. */
    onopen?: (panel: HTMLDivElement) => void;
    children: Snippet;
  } = $props();

  let panel: HTMLDivElement | undefined = $state();
  let position = $state('');

  /** On phones the panel is a bottom sheet instead of hanging off its button. */
  const phone = () => matchMedia('(max-width: 600px)').matches;

  function place() {
    if (!anchor || !panel) return;
    if (phone()) {
      position = 'left:0;right:0;bottom:0;top:auto;width:100%';
      return;
    }
    const box = anchor.getBoundingClientRect();
    const w = Math.min(width, innerWidth - 16);
    const height = panel.offsetHeight;
    const left = Math.max(8, Math.min(box.right - w, innerWidth - w - 8));
    const below = box.bottom + 6;
    const top = below + height > innerHeight - 8 && box.top - height - 6 > 8 ? box.top - height - 6 : below;
    position = `left:${left}px;top:${top}px;width:${w}px`;
  }

  $effect(() => {
    if (!panel) return;
    if (open && !panel.matches(':popover-open')) {
      panel.showPopover();
      place();
      onopen?.(panel);
    } else if (!open && panel.matches(':popover-open')) {
      panel.hidePopover();
    }
  });

  $effect(() => {
    if (!open) return;
    const update = () => place();
    addEventListener('resize', update);
    addEventListener('scroll', update, true);
    return () => {
      removeEventListener('resize', update);
      removeEventListener('scroll', update, true);
    };
  });
</script>

<div
  bind:this={panel}
  popover="auto"
  class="popover {className}"
  style={position}
  tabindex="-1"
  {...rest}
  ontoggle={(event) => {
    if ((event as ToggleEvent).newState === 'closed') {
      if (open) onclose();
      if (panel?.contains(document.activeElement)) anchor?.focus();
    }
  }}
>
  {#if open}{@render children()}{/if}
</div>

<style>
  .popover {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 0;
    overflow: auto;
    max-height: calc(100dvh - 16px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--raised);
    color: var(--fg);
    box-shadow: var(--shadow-pop);
  }
  .popover:focus-visible {
    outline: none;
  }
  @media (max-width: 600px) {
    .popover {
      max-height: 85dvh;
      padding-bottom: env(safe-area-inset-bottom);
      border-width: 1px 0 0;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
    .popover::backdrop {
      background: var(--scrim);
    }
  }
</style>
