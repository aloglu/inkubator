<script lang="ts">
  /** A color as a round swatch to pick from, next to its `#rrggbb` code, which can also be typed. */
  let { value = $bindable('#000000'), label }: { value?: string; label: string } = $props();

  // The typed code follows the picker, and is only taken over when it is a full color.
  let text = $state(value);
  $effect(() => {
    text = value;
  });
</script>

<span class="color">
  <input type="color" bind:value aria-label={label} />
  <input
    type="text"
    class="code"
    value={text}
    aria-label="{label} code"
    maxlength="7"
    spellcheck="false"
    autocomplete="off"
    oninput={(event) => {
      text = event.currentTarget.value.trim();
      const code = text.startsWith('#') ? text : `#${text}`;
      if (/^#[0-9a-f]{6}$/i.test(code)) value = code.toLowerCase();
    }}
    onblur={() => (text = value)}
  />
</span>

<style>
  .color {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  input[type='color'] {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }
  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  input[type='color']::-webkit-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  input[type='color']::-moz-color-swatch {
    border: 0;
    border-radius: 50%;
  }
  .code {
    width: 92px;
    padding: 5px 8px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-family: ui-monospace, monospace;
    font-size: 12.5px;
  }
  .code:focus-visible {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
</style>
