/** Collection changes started from more than one screen. */
import { collection } from './stores/collection.svelte';
import { ui } from './stores/ui.svelte';
import type { Pen } from './types/Pen';

/** Empties a pen now, with a notice either way. */
export async function flushPen(pen: Pick<Pen, 'id' | 'model'>, inkName: string) {
  try {
    await collection.run({ type: 'flush_pen', pen_id: pen.id, at: null });
    notifyWithUndo(`Flushed ${inkName} from ${pen.model}.`, pen.id);
  } catch (error) {
    ui.fail(error);
  }
}

/** Confirms a pen's ink change just made, offering to take it back. */
export function notifyWithUndo(text: string, penId: string) {
  const changes = (collection.data?.fills ?? [])
    .filter((fill) => fill.pen_id === penId)
    .map((fill) => fill.emptied_at ?? fill.inked_at);
  if (!changes.length) {
    ui.notify(text);
    return;
  }
  const at = Math.max(...changes);
  ui.notify(text, 'info', {
    label: 'Undo',
    run: async () => {
      try {
        await collection.run({ type: 'undo_ink_change', pen_id: penId, at });
        ui.notify('Undone.');
      } catch (error) {
        ui.fail(error);
      }
    },
  });
}
