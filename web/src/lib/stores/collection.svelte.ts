/**
 * The collection on screen, kept in sync with the server: the owner's full
 * collection when signed in, or the public view when a visitor looks.
 *
 * `run` sends one command (owner only). On a conflict (the collection changed
 * elsewhere) it reloads and reports the conflict instead of retrying, since the
 * change was made against data the user no longer sees.
 */
import * as api from '../api';
import type { Collection } from '../types/Collection';
import type { Command } from '../types/Command';
import { visitorCollection } from '../visitor';
import { lists } from './lists.svelte';

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'private';

class CollectionStore {
  data: Collection | null = $state(null);
  /** Who is looking: the signed-in owner, or a visitor seeing the showcase. */
  mode: 'owner' | 'visitor' | null = $state(null);
  revision = $state('');
  status: Status = $state('idle');
  error: api.ApiError | null = $state(null);
  /** True while a command is being saved. */
  saving = $state(false);

  get canEdit() {
    return this.mode === 'owner';
  }

  /** Loads the full collection for the signed-in owner. */
  async load() {
    this.mode = 'owner';
    api.usePublicPhotos(false);
    if (!this.data) this.status = 'loading';
    try {
      this.apply(await api.getCollection());
      this.status = 'ready';
      this.error = null;
    } catch (error) {
      this.error = asApiError(error);
      if (!this.data) this.status = 'error';
    }
  }

  /** Loads what visitors may see; status "private" when the showcase is off. */
  async loadPublic() {
    this.mode = 'visitor';
    api.usePublicPhotos(true);
    this.data = null;
    this.status = 'loading';
    try {
      const visible = await api.getPublic();
      this.data = visitorCollection(visible);
      lists.pens.prefer(visible.pen_sort);
      lists.inks.prefer(visible.ink_sort);
      lists.swatches.prefer(visible.swatch_sort);
      this.revision = '';
      this.status = 'ready';
      this.error = null;
    } catch (error) {
      const failure = asApiError(error);
      this.status = failure.code === 'showcase_off' ? 'private' : 'error';
      this.error = failure;
    }
  }

  /** Saves one change. Throws an `ApiError` the caller can show. */
  async run(command: Command): Promise<api.CommandResult> {
    if (!this.canEdit) throw new api.ApiError(401, 'unauthorized', 'Sign in to make changes.');
    this.saving = true;
    try {
      const result = await api.runCommand(command, this.revision);
      this.apply(result);
      return result;
    } catch (error) {
      const failure = asApiError(error);
      if (failure.isConflict) await this.load();
      throw failure;
    } finally {
      this.saving = false;
    }
  }

  /** Replaces the collection with what the server returned (e.g. after a restore). */
  apply(loaded: api.Loaded) {
    this.data = loaded.collection;
    this.revision = loaded.revision;
  }

  clear() {
    this.data = null;
    this.mode = null;
    this.revision = '';
    this.status = 'idle';
    this.error = null;
  }
}

function asApiError(error: unknown): api.ApiError {
  if (error instanceof api.ApiError) return error;
  return new api.ApiError(0, 'error', error instanceof Error ? error.message : String(error));
}

export const collection = new CollectionStore();
