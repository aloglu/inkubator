/**
 * Whether a newer Inkubator is out, for the owner. Asked of the server once
 * while the app is open (the server asks GitHub at most twice a day), and
 * again when the setting changes.
 */
import { getUpdateStatus } from '../api';
import type { UpdateStatus } from '../types/UpdateStatus';

/** The step-by-step update guide for every kind of setup. */
export const updateGuide = 'https://github.com/aloglu/inkubator/blob/main/docs/updating.md';

class UpdateStore {
  status: UpdateStatus | null = $state(null);
  #asked = false;

  /** Asks once; later calls do nothing unless `again` is set. */
  async check(again = false) {
    if (this.#asked && !again) return;
    this.#asked = true;
    try {
      this.status = await getUpdateStatus();
    } catch {
      // Not knowing is fine; Settings shows the version from the status it has.
    }
  }
}

export const updates = new UpdateStore();
