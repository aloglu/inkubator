<script lang="ts">
  /** Shared SVG definitions, rendered once at the root of the app. */
</script>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <!-- Roughens a swab's edge so it reads as ink on paper. -->
  <filter id="swab-bleed">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
    <feDisplacementMap in="SourceGraphic" scale="5" />
  </filter>
</svg>
