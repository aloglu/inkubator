<script lang="ts">
  import SvgDefs from './lib/components/SvgDefs.svelte';
  import { router } from './lib/router.svelte';
  import Admin from './routes/admin/Admin.svelte';
  import Showcase from './routes/showcase/Showcase.svelte';

  const isAdmin = $derived(router.path === '/admin' || router.path.startsWith('/admin/'));
</script>

<SvgDefs />
{#if isAdmin}
  <Admin />
{:else}
  <Showcase />
{/if}
