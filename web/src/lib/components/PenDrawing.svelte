<script lang="ts">
  /** A pen drawn in its body color, used when it has no photo. */
  let { colors, width = 150 }: { colors: readonly string[]; width?: number } = $props();

  const body = $derived(colors[0] ?? 'var(--muted)');
  const height = $derived(Math.round((width * 34) / 150));
</script>

<svg class="pen" {width} {height} viewBox="0 0 150 34" style:--b={body} aria-hidden="true">
  <path d="M4 11 Q4 6 10 6 L58 6 Q61 6 61 9 L61 25 Q61 28 58 28 L10 28 Q4 28 4 23 Z" class="body" />
  <rect x="22" y="4" width="30" height="3" rx="1.5" class="trim" />
  <rect x="61" y="9" width="4" height="16" class="trim" />
  <path d="M65 9 L112 10 Q116 10 116 14 L116 20 Q116 24 112 24 L65 25 Z" class="body" />
  <path d="M116 12 L126 13 L126 21 L116 22 Z" class="body section" />
  <path d="M126 12.5 L146 17 L126 21.5 Z" class="nib" />
  <path d="M131 17 L146 17" class="slit" />
</svg>

<style>
  .pen {
    display: block;
    flex: none;
  }
  .body {
    fill: var(--b);
    stroke: var(--line-strong);
    stroke-width: 0.6;
  }
  .section {
    opacity: 0.7;
    stroke: none;
  }
  .trim {
    fill: var(--accent);
    opacity: 0.85;
  }
  .nib {
    fill: var(--accent);
  }
  .slit {
    stroke: var(--bg);
    stroke-width: 0.8;
  }
</style>
