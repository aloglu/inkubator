/** Interface state shared across screens: the Ink a pen dialog and notices. */
import { ApiError } from '../api';

export type Notice = { id: number; text: string; tone: 'info' | 'error' };

const messages: Record<string, string> = {
  conflict: 'The collection changed in another window. It has been reloaded; please try again.',
  already_inked: 'That pen already holds this ink.',
  not_inked: 'That pen is not inked.',
  ink_in_use: 'That ink is in a pen. Flush the pen before deleting the ink.',
  too_early: "That date is before the pen's last ink change.",
  offline: 'Could not reach the server. Check your connection.',
};

/** A sentence for the user, from any error. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

class Ui {
  /** Ink a pen: closed, or open with either side prefilled. */
  inkFlow: { penId: string | null; inkId: string | null } | null = $state(null);
  notices: Notice[] = $state([]);
  private next = 1;

  openInkFlow({ penId = null, inkId = null }: { penId?: string | null; inkId?: string | null } = {}) {
    this.inkFlow = { penId, inkId };
  }

  closeInkFlow() {
    this.inkFlow = null;
  }

  notify(text: string, tone: Notice['tone'] = 'info') {
    const id = this.next++;
    this.notices.push({ id, text, tone });
    setTimeout(() => this.dismiss(id), tone === 'error' ? 8000 : 4000);
  }

  fail(error: unknown) {
    this.notify(describeError(error), 'error');
  }

  dismiss(id: number) {
    this.notices = this.notices.filter((notice) => notice.id !== id);
  }
}

export const ui = new Ui();
