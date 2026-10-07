<script lang="ts">
  /**
   * One app for everyone. Signed in, the owner sees and edits the collection;
   * signed out, visitors see the showcase (the same screens, read-only), or only
   * the sign-in page when the showcase is off.
   */
  import { getSession, logout, setUnauthorizedHandler } from './lib/api';
  import SvgDefs from './lib/components/SvgDefs.svelte';
  import { router } from './lib/router.svelte';
  import { collection } from './lib/stores/collection.svelte';
  import { ui } from './lib/stores/ui.svelte';
  import Login from './routes/app/Login.svelte';
  import Shell from './routes/app/Shell.svelte';

  let checkError = $state('');
  /** True while signing in finishes, so the form stays up until we have moved on. */
  let entering = $state(false);

  async function start() {
    checkError = '';
    try {
      if (await getSession()) await collection.load();
      else await collection.loadPublic();
    } catch (error) {
      checkError = error instanceof Error ? error.message : String(error);
    }
  }

  $effect(() => {
    void start();
  });

  // The session ran out while working: fall back to the visitor's view.
  setUnauthorizedHandler(() => {
    if (collection.mode !== 'owner') return;
    ui.notify('You were signed out.', 'error');
    void collection.loadPublic();
  });

  /** After signing in: back to the page asked for, or stay on the page the sign-in form covered. */
  async function signedIn() {
    entering = true;
    try {
      await collection.load();
      if (router.path === '/sign-in') {
        const next = router.query.get('next');
        router.navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
      }
    } finally {
      entering = false;
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      await collection.loadPublic();
      router.navigate('/');
    }
  }

  const signingIn = $derived(entering || (router.path === '/sign-in' && collection.mode !== 'owner'));
</script>

<SvgDefs />
{#if checkError}
  <main class="center">
    <p>{checkError}</p>
    <button type="button" onclick={start}>Try again</button>
  </main>
{:else if signingIn || collection.status === 'private'}
  <Login onsignedin={signedIn} showcase={collection.status === 'ready'} />
{:else if collection.mode}
  <Shell onsignout={signOut} />
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
