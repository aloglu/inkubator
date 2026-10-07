<script lang="ts">
  /**
   * A menu that opens under a button. Uses the popover API, so a click outside
   * or Esc closes it, and it sits above everything else. Items are elements with
   * role="menuitem"; arrow keys move between them.
   */
  import type { Snippet } from 'svelte';

  let {
    anchor,
    open,
    onclose,
    label,
    width = 290,
    children,
  }: {
    anchor: HTMLElement | undefined;
    open: boolean;
    onclose: () => void;
    label: string;
    width?: number;
    children: Snippet;
  } = $props();

  let menu: HTMLDivElement | undefined = $state();
  let position = $state('');

  const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];

  function place() {
    if (!anchor || !menu) return;
    const box = anchor.getBoundingClientRect();
    const height = menu.offsetHeight;
    const left = Math.max(8, Math.min(box.right - width, innerWidth - width - 8));
    const below = box.bottom + 6;
    const top = below + height > innerHeight - 8 && box.top - height - 6 > 8 ? box.top - height - 6 : below;
    position = `left:${left}px;top:${top}px;width:${width}px`;
  }

  $effect(() => {
    if (!menu) return;
    if (open && !menu.matches(':popover-open')) {
      menu.showPopover();
      place();
      items()[0]?.focus();
    } else if (!open && menu.matches(':popover-open')) {
      menu.hidePopover();
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

  function onkeydown(event: KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % list.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + list.length) % list.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else if (event.key === 'Tab') onclose();
    if (next >= 0) {
      event.preventDefault();
      list[next]?.focus();
    }
  }
</script>

<div
  bind:this={menu}
  popover="auto"
  role="menu"
  aria-label={label}
  class="menu"
  style={position}
  tabindex="-1"
  {onkeydown}
  ontoggle={(event) => {
    if ((event as ToggleEvent).newState === 'closed') {
      if (open) onclose();
      if (menu?.contains(document.activeElement)) anchor?.focus();
    }
  }}
>
  {#if open}{@render children()}{/if}
</div>

<style>
  .menu {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 6px;
    display: none;
    gap: 1px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--raised);
    color: var(--fg);
    box-shadow: var(--shadow-pop);
  }
  .menu:popover-open {
    display: grid;
  }
  .menu :global([role='menuitem']) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--fg);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .menu :global([role='menuitem']:hover),
  .menu :global([role='menuitem']:focus-visible) {
    background: var(--accent-soft);
    outline: none;
  }
  .menu :global([role='menuitem'] small) {
    margin-left: auto;
    color: var(--muted);
    font-size: 11.5px;
    white-space: nowrap;
  }
  .menu :global(.kicker) {
    padding: 6px 8px 4px;
  }
  .menu :global(hr) {
    margin: 4px 0;
    border: 0;
    border-top: 1px solid var(--line);
  }
  .menu :global(.note) {
    padding: 4px 8px 2px;
    color: var(--muted);
    font-size: 11.5px;
  }
</style>
