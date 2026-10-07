/** Collection changes started from more than one screen. */
import { collection } from './stores/collection.svelte';
import { ui } from './stores/ui.svelte';
import type { Pen } from './types/Pen';

/** Empties a pen now, with a notice either way. */
export async function flushPen(pen: Pick<Pen, 'id' | 'model'>, inkName: string) {
  try {
    await collection.run({ type: 'flush_pen', pen_id: pen.id, at: null });
    ui.notify(`Flushed ${inkName} from ${pen.model}.`);
  } catch (error) {
    ui.fail(error);
  }
}
