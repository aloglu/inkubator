<script lang="ts">
  import { icons, type IconName } from '../icons';

  let { name, size = 16, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<!-- The SVGs are bundled Phosphor assets, never user content. -->
<span
  class="icon"
  style:width="{size}px"
  style:height="{size}px"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {@html icons[name]}
</span>

<style>
  .icon {
    display: inline-grid;
    flex: none;
    line-height: 0;
  }
  .icon :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
