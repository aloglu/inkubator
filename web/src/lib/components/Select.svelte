<script lang="ts" generics="T extends string">
  /** A native select in the app's style. */
  let {
    label,
    value,
    options,
    onchange,
    width,
  }: {
    label: string;
    value: T;
    options: readonly { value: T; label: string }[];
    onchange: (value: T) => void;
    width?: string;
  } = $props();
</script>

<!-- Shows the saved value until the change comes back, so a cancelled change snaps back. -->
<select
  aria-label={label}
  {value}
  style:width={width}
  onchange={(event) => {
    const chosen = event.currentTarget.value as T;
    event.currentTarget.value = value;
    onchange(chosen);
  }}
>
  {#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
</select>

<style>
  select {
    max-width: 100%;
    padding: 6px 28px 6px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%2388857e' stroke-width='1.5'/%3E%3C/svg%3E")
      no-repeat right 10px center;
    font-size: 13px;
    appearance: none;
    cursor: pointer;
  }
  select:focus-visible {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
</style>
