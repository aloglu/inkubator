<script lang="ts">
  /** An ink swatch: the base color as a blot, with the sheen color showing at its edge. */
  let {
    base,
    sheen = null,
    size = 'md',
    label,
  }: {
    base: string;
    sheen?: string | null;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'shelf';
    label?: string;
  } = $props();
</script>

<span
  class="swab {size}"
  style:--c={base}
  style:--s={sheen ?? 'transparent'}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
></span>

<style>
  .swab {
    position: relative;
    display: inline-block;
    flex: none;
    filter: url(#swab-bleed);
  }
  .swab::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 46% 54% 42% 58% / 55% 45% 55% 45%;
    background: radial-gradient(
      120% 90% at 30% 30%,
      color-mix(in srgb, var(--c) 55%, #fff) 0%,
      var(--c) 55%,
      color-mix(in srgb, var(--c) 70%, #000) 100%
    );
    box-shadow: inset -3px -3px 0 0 var(--s);
  }
  .xs {
    width: 14px;
    height: 12px;
    filter: none;
  }
  .xs::before {
    border-radius: 50%;
    box-shadow: none;
  }
  .sm {
    width: 30px;
    height: 24px;
  }
  .md {
    width: 58px;
    height: 46px;
  }
  .shelf {
    width: 100px;
    height: 80px;
  }
  .lg {
    width: 150px;
    height: 118px;
  }
  .lg::before,
  .shelf::before {
    box-shadow: inset -6px -5px 0 0 var(--s);
  }
</style>
