/** Interface state shared across screens: the Ink a pen dialog and notices. */
import { ApiError } from '../api';

/** A button on a notice, such as Undo. */
export type NoticeAction = { label: string; run: () => void };

export type Notice = { id: number; text: string; tone: 'info' | 'error'; action?: NoticeAction; key?: string };

export type ConfirmRequest = {
  title: string;
  message: string;
  confirm: string;
  danger?: boolean;
};

const messages: Record<string, string> = {
  conflict: 'The collection changed in another window. It has been reloaded; please try again.',
  already_inked: 'That pen already holds this ink.',
  not_inked: 'That pen is not inked.',
  ink_in_use: 'That ink is in a pen. Flush the pen before deleting the ink.',
  too_early: "That date is before the pen's last ink change.",
  nothing_to_undo: 'That change can no longer be undone.',
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
  /** The open confirmation, if any; answered through `answer`. */
  confirming: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null = $state(null);
  private next = 1;

  /** Asks the user to confirm; resolves to false if they cancel. */
  confirm(request: ConfirmRequest): Promise<boolean> {
    this.confirming?.resolve(false);
    return new Promise((resolve) => {
      this.confirming = { ...request, resolve };
    });
  }

  answer(ok: boolean) {
    this.confirming?.resolve(ok);
    this.confirming = null;
  }

  openInkFlow({ penId = null, inkId = null }: { penId?: string | null; inkId?: string | null } = {}) {
    this.inkFlow = { penId, inkId };
  }

  closeInkFlow() {
    this.inkFlow = null;
  }

  /**
   * Shows a notice; one with an action (Undo) stays longer, to give time to use
   * it. A notice with a `key` replaces the one before it with the same key, so
   * repeated changes (each saved setting) do not stack up.
   */
  notify(text: string, tone: Notice['tone'] = 'info', action?: NoticeAction, key?: string) {
    const id = this.next++;
    if (key) this.notices = this.notices.filter((notice) => notice.key !== key);
    this.notices.push({ id, text, tone, action, key });
    setTimeout(() => this.dismiss(id), tone === 'error' || action ? 8000 : 4000);
  }

  fail(error: unknown) {
    this.notify(describeError(error), 'error');
  }

  dismiss(id: number) {
    this.notices = this.notices.filter((notice) => notice.id !== id);
  }
}

export const ui = new Ui();
