/**
 * The signed-in collection, kept in sync with the server.
 *
 * `run` sends one command. On a conflict (the collection changed elsewhere) it
 * reloads and reports the conflict instead of retrying, since the change was
 * made against data the user no longer sees.
 */
import * as api from '../api';
import type { Collection } from '../types/Collection';
import type { Command } from '../types/Command';

type Status = 'idle' | 'loading' | 'ready' | 'error';

class CollectionStore {
  data: Collection | null = $state(null);
  revision = $state('');
  status: Status = $state('idle');
  error: api.ApiError | null = $state(null);
  /** True while a command is being saved. */
  saving = $state(false);

  async load() {
    this.status = this.data ? this.status : 'loading';
    try {
      this.apply(await api.getCollection());
      this.status = 'ready';
      this.error = null;
    } catch (error) {
      this.error = asApiError(error);
      if (!this.data) this.status = 'error';
    }
  }

  /** Saves one change. Throws an `ApiError` the caller can show. */
  async run(command: Command): Promise<api.CommandResult> {
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
