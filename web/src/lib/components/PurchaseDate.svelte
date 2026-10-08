<script lang="ts">
  /**
   * A date picker that can also hold just a month, for when you only remember
   * when you bought something roughly. The value is `YYYY-MM-DD`, `YYYY-MM` or
   * empty. A plain date picker plus a checkbox works in every browser, unlike
   * month pickers.
   */
  import { toDateInput } from '../format';

  let { label, value = $bindable('') }: { label: string; value?: string } = $props();

  const id = $props.id();
  let monthOnly = $state(value.length === 7);
  // The picker always holds a full day; a month-only value shows as its first day.
  let day = $state(value.length === 7 ? `${value}-01` : value);

  function update() {
    value = day ? (monthOnly ? day.slice(0, 7) : day) : '';
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="row">
    <input {id} type="date" bind:value={day} max={toDateInput(Date.now())} oninput={update} onchange={update} />
    <label class="month">
      <input type="checkbox" bind:checked={monthOnly} onchange={update} />
      Only the month
    </label>
  </div>
</div>

<style>
  .field {
    display: grid;
    align-content: start;
    gap: 4px;
    min-width: 0;
  }
  .field > label {
    color: var(--muted);
    font-size: 12px;
  }
  /* The picker fills its column like the text fields beside it; the month choice goes under it. */
  .row {
    display: grid;
    gap: 6px;
  }
  input[type='date'] {
    width: 100%;
    min-height: 36px;
    padding: 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--field);
    font-size: 13px;
  }
  input[type='date']:focus-visible {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .month {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  .month input {
    accent-color: var(--accent);
  }
</style>
