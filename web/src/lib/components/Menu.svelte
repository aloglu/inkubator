<script lang="ts">
  /**
   * A menu that opens under a button. Items are elements with role="menuitem"
   * (or menuitemradio); arrow keys move between them.
   */
  import type { Snippet } from 'svelte';
  import Popover from './Popover.svelte';

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

  const items = (menu: HTMLElement) => [
    ...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])'),
  ];

  function onkeydown(event: KeyboardEvent) {
    const list = items(event.currentTarget as HTMLElement);
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

<Popover
  {anchor}
  {open}
  {onclose}
  {width}
  role="menu"
  aria-label={label}
  {onkeydown}
  onopen={(panel) => (items(panel).find((item) => item.getAttribute('aria-checked') === 'true') ?? items(panel)[0])?.focus()}
>
  <div class="items">{@render children()}</div>
</Popover>

<style>
  .items {
    display: grid;
    gap: 1px;
    padding: 6px;
  }
  .items :global([role^='menuitem']) {
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
  .items :global([role^='menuitem']:hover),
  .items :global([role^='menuitem']:focus-visible) {
    background: var(--accent-soft);
    outline: none;
  }
  .items :global([role^='menuitem'] small) {
    margin-left: auto;
    color: var(--muted);
    font-size: 11.5px;
    white-space: nowrap;
  }
  .items :global(.kicker) {
    padding: 6px 8px 4px;
  }
  .items :global(hr) {
    margin: 4px 0;
    border: 0;
    border-top: 1px solid var(--line);
  }
  .items :global(.note) {
    padding: 4px 8px 2px;
    color: var(--muted);
    font-size: 11.5px;
  }
</style>
