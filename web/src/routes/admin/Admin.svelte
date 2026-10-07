<script lang="ts">
  /** Signed-in area: checks the session, then shows the shell or the sign-in form. */
  import { getSession, setUnauthorizedHandler } from '../../lib/api';
  import { collection } from '../../lib/stores/collection.svelte';
  import Login from './Login.svelte';
  import Shell from './Shell.svelte';

  let signedIn: boolean | null = $state(null);
  let checkError = $state('');

  setUnauthorizedHandler(() => {
    signedIn = false;
    collection.clear();
  });

  async function check() {
    checkError = '';
    try {
      signedIn = await getSession();
    } catch (error) {
      checkError = error instanceof Error ? error.message : String(error);
    }
  }

  $effect(() => {
    void check();
  });

  $effect(() => {
    if (signedIn && collection.status === 'idle') void collection.load();
  });
</script>

{#if checkError}
  <main class="center">
    <p>{checkError}</p>
    <button type="button" onclick={check}>Try again</button>
  </main>
{:else if signedIn === false}
  <Login onsignedin={() => (signedIn = true)} />
{:else if signedIn}
  <Shell
    onsignedout={() => {
      signedIn = false;
      collection.clear();
    }}
  />
{/if}

<style>
  .center {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    gap: 12px;
    text-align: center;
  }
</style>
