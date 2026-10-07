<script lang="ts">
  import { ApiError, login } from '../../lib/api';
  import Button from '../../lib/components/Button.svelte';
  import TextField from '../../lib/components/TextField.svelte';

  let { onsignedin }: { onsignedin: () => void } = $props();

  let username = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    try {
      await login(username, password);
      onsignedin();
    } catch (failure) {
      error = failure instanceof ApiError ? failure.message : 'Could not sign in.';
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <form onsubmit={submit}>
    <div class="brand">
      <img src="/nib.png" alt="" width="40" height="40" />
      <h1>Inkubator</h1>
    </div>
    <TextField label="Username" bind:value={username} autocomplete="username" required />
    <TextField label="Password" bind:value={password} type="password" autocomplete="current-password" required />
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
  </form>
</main>

<style>
  main {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 16px;
  }
  form {
    width: min(340px, 100%);
    display: grid;
    gap: 14px;
    padding: 28px;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .error {
    color: var(--danger);
    font-size: 13px;
  }
</style>
