<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    disabled = false,
    onchange,
  }: { checked?: boolean; label: string; disabled?: boolean; onchange?: (checked: boolean) => void } =
    $props();
</script>

<button
  type="button"
  role="switch"
  class="switch"
  class:on={checked}
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => {
    checked = !checked;
    onchange?.(checked);
  }}
></button>

<style>
  .switch {
    width: 34px;
    height: 20px;
    border-radius: 99px;
    background: var(--line-strong);
    position: relative;
    flex: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    transition: background 0.15s;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--raised);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    transition: left 0.15s;
  }
  .on {
    background: var(--accent);
  }
  .on::after {
    left: 16px;
  }
  .switch:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
